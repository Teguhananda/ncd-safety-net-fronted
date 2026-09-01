import { useEffect, useRef, useState } from "react";

/**
 * QRScanner — memakai BarcodeDetector API bawaan browser (didukung Chrome/
 * Edge/Android; belum didukung penuh di semua Safari versi). Jika tidak
 * didukung, komponen menampilkan pesan dan pengguna tetap bisa pakai input
 * manual No. RM yang sudah ada di halaman Daftar Pasien.
 */
export default function QRScanner({ onDetected }) {
  const videoRef = useRef(null);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState("");
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!("BarcodeDetector" in window)) {
      setSupported(false);
      return;
    }
    let stream;
    let detector;
    let rafId;

    async function start() {
      try {
        detector = new window.BarcodeDetector({ formats: ["qr_code"] });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setActive(true);
          scanLoop();
        }
      } catch (e) {
        setError("Tidak bisa mengakses kamera: " + e.message);
      }
    }

    async function scanLoop() {
      if (!videoRef.current) return;
      try {
        const codes = await detector.detect(videoRef.current);
        if (codes.length > 0) {
          onDetected(codes[0].rawValue);
          return; // berhenti setelah 1 hasil terbaca
        }
      } catch (e) {
        // frame belum siap / error sesaat — abaikan, lanjut loop
      }
      rafId = requestAnimationFrame(scanLoop);
    }

    start();
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [onDetected]);

  if (!supported) {
    return (
      <div className="alert warn">
        <span>ℹ️</span>
        <div>
          <strong>Scan kamera tidak didukung browser ini.</strong>
          Gunakan input manual No. Rekam Medis di bawah.
        </div>
      </div>
    );
  }

  return (
    <div>
      <video ref={videoRef} style={{ width: "100%", borderRadius: 8, background: "#000" }} muted playsInline />
      {error && <div className="error-text">{error}</div>}
      {active && <div className="stat-sub" style={{ marginTop: 8 }}>Arahkan kamera ke QR code pasien...</div>}
    </div>
  );
}
