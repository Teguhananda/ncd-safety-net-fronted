import { useEffect, useRef, useState } from "react";

/**
 * QRScanner — scan QR pasien lewat kamera PC/laptop/HP petugas.
 *
 * REVISI (20 Okt 2026): sebelumnya HANYA memakai BarcodeDetector bawaan
 * browser, yang tidak ada di Safari (Mac/iPhone) & Firefox → muncul pesan
 * "Scan kamera tidak didukung browser ini". Sekarang:
 *   1. Pakai BarcodeDetector bila tersedia (Chrome/Edge — cepat & hemat).
 *   2. Bila tidak tersedia, otomatis pakai jsQR (pustaka JavaScript murni,
 *      dimuat dari CDN — sama seperti PortalQRScanner.jsx di Portal Pasien)
 *      sehingga jalan di Safari/Firefox juga.
 * Kamera depan laptop/webcam USB juga bisa dipakai ("environment" hanya
 * preferensi, bukan syarat). Input manual No. RM & USB scanner tetap ada.
 */
const JSQR_CDN_URL = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";

function loadJsQR() {
  return new Promise((resolve, reject) => {
    if (window.jsQR) return resolve(window.jsQR);
    const existing = document.querySelector(`script[src="${JSQR_CDN_URL}"]`);
    const script = existing || document.createElement("script");
    script.addEventListener("load", () => resolve(window.jsQR));
    script.addEventListener("error", () => reject(new Error("Gagal memuat pustaka pemindai QR. Periksa koneksi internet.")));
    if (!existing) {
      script.src = JSQR_CDN_URL;
      document.head.appendChild(script);
    }
  });
}

function cameraErrorText(e) {
  const name = e && e.name;
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Izin kamera ditolak. Klik ikon kamera/gembok di kolom alamat browser, pilih Izinkan (Allow), lalu tekan Coba Lagi.";
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return "Kamera tidak ditemukan di perangkat ini. Pasang webcam, atau gunakan pencarian manual / USB scanner.";
  if (name === "NotReadableError")
    return "Kamera sedang dipakai aplikasi lain (mis. Zoom/WhatsApp). Tutup aplikasi itu lalu tekan Coba Lagi.";
  return "Tidak bisa mengakses kamera: " + ((e && e.message) || "kesalahan tidak diketahui");
}

export default function QRScanner({ onDetected }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;
  const [status, setStatus] = useState("loading"); // loading | scanning | error
  const [error, setError] = useState("");
  const [engine, setEngine] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let stream;
    let rafId;
    let stopped = false;
    setStatus("loading");
    setError("");

    async function start() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw Object.assign(new Error("Browser ini tidak mengizinkan akses kamera (halaman harus dibuka lewat https)."), { name: "Unsupported" });
        }
        let detectFrame;
        if ("BarcodeDetector" in window) {
          const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
          detectFrame = async (video) => {
            const codes = await detector.detect(video);
            return codes.length > 0 ? codes[0].rawValue : null;
          };
          setEngine("bawaan browser");
        } else {
          const jsQR = await loadJsQR();
          detectFrame = async (video) => {
            const canvas = canvasRef.current;
            if (!canvas || !video.videoWidth) return null;
            // diperkecil maks. 640px supaya ringan di laptop lama
            const scale = Math.min(1, 640 / video.videoWidth);
            canvas.width = Math.round(video.videoWidth * scale);
            canvas.height = Math.round(video.videoHeight * scale);
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
            return code && code.data ? code.data : null;
          };
          setEngine("jsQR");
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (stopped) return;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setStatus("scanning");

        const loop = async () => {
          if (stopped) return;
          try {
            if (video.readyState >= 2) {
              const value = await detectFrame(video);
              if (value && !stopped) {
                stopped = true;
                onDetectedRef.current && onDetectedRef.current(value);
                return; // berhenti setelah 1 hasil terbaca
              }
            }
          } catch (_) {
            // frame belum siap / error sesaat — lanjut loop
          }
          rafId = requestAnimationFrame(loop);
        };
        loop();
      } catch (e) {
        if (stopped) return;
        setStatus("error");
        setError(e && e.name === "Unsupported" ? e.message : cameraErrorText(e));
      }
    }

    start();
    return () => {
      stopped = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [attempt]);

  return (
    <div>
      <video
        ref={videoRef}
        style={{ width: "100%", maxWidth: 520, borderRadius: 12, background: "#000", display: status === "error" ? "none" : "block" }}
        muted
        playsInline
      />
      <canvas ref={canvasRef} style={{ display: "none" }} />
      {status === "loading" && <div className="stat-sub" style={{ marginTop: 8 }}>Menyiapkan kamera... (bila muncul pertanyaan izin kamera, pilih Izinkan)</div>}
      {status === "scanning" && (
        <div className="stat-sub" style={{ marginTop: 8 }}>
          Arahkan QR pasien ke kamera, jarak ± 15–25 cm, sampai terbaca otomatis.
          <span style={{ opacity: 0.7 }}> (mesin: {engine})</span>
        </div>
      )}
      {status === "error" && (
        <div className="alert warn" style={{ marginTop: 4 }}>
          <span>⚠️</span>
          <div>
            <div>{error}</div>
            <button className="btn btn-ghost" style={{ marginTop: 10 }} onClick={() => setAttempt((n) => n + 1)}>
              Coba Lagi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
