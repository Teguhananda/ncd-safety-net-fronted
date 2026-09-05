import { useEffect, useRef, useState } from "react";

// jsQR dimuat dari CDN saat komponen ini dipakai (bukan npm dependency) —
// supaya tidak perlu ubah package.json/package-lock.json project Bapak
// (menghindari risiko build gagal karena lockfile tidak sinkron).
const JSQR_CDN_URL = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";

function loadJsQR() {
  return new Promise((resolve, reject) => {
    if (window.jsQR) return resolve(window.jsQR);
    const script = document.createElement("script");
    script.src = JSQR_CDN_URL;
    script.onload = () => resolve(window.jsQR);
    script.onerror = () => reject(new Error("Gagal memuat pustaka scanner QR."));
    document.head.appendChild(script);
  });
}

/**
 * PortalQRScanner — pengganti QRScanner.jsx (staff) KHUSUS untuk Portal
 * Pasien. QRScanner.jsx staff memakai BarcodeDetector API bawaan browser
 * — API ini TIDAK didukung Safari sama sekali (di iPhone manapun,
 * bagaimanapun versinya), cuma jalan di Chrome/Edge. Karena pasien
 * mayoritas pakai iPhone/Safari, dipakai jsQR (murni JavaScript, decode
 * manual dari frame kamera lewat canvas) yang jalan di semua browser.
 */
export default function PortalQRScanner({ onDetected }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [status, setStatus] = useState("loading"); // loading | scanning | error
  const [error, setError] = useState("");

  useEffect(() => {
    let stream;
    let rafId;
    let stopped = false;

    async function start() {
      try {
        const jsQR = await loadJsQR();
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (stopped) return;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setStatus("scanning");
          scanLoop(jsQR);
        }
      } catch (e) {
        setStatus("error");
        setError(e.message || "Tidak bisa mengakses kamera.");
      }
    }

    function scanLoop(jsQR) {
      if (stopped || !videoRef.current || !canvasRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data) {
          onDetected(code.data);
          return; // berhenti setelah 1 hasil terbaca
        }
      }
      rafId = requestAnimationFrame(() => scanLoop(jsQR));
    }

    start();
    return () => {
      stopped = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <video ref={videoRef} style={{ width: "100%", borderRadius: 12, background: "#000" }} muted playsInline />
      <canvas ref={canvasRef} style={{ display: "none" }} />
      {status === "loading" && <p className="portal-sub" style={{ marginTop: 8 }}>Menyiapkan kamera...</p>}
      {status === "scanning" && <p className="portal-sub" style={{ marginTop: 8 }}>Arahkan kamera ke QR Portal Pasien Anda...</p>}
      {status === "error" && <p className="portal-error" style={{ marginTop: 8 }}>{error}</p>}
    </div>
  );
}
