import { useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { callApi } from "../lib/api";

// GANTI dengan URL frontend production Bapak (sama seperti yang dipakai di
// browser untuk buka aplikasi staff), supaya QR yang dicetak mengarah ke
// domain yang benar.
const FRONTEND_URL = "https://ncd-safety-net-fronted.vercel.app";

export default function PatientPortalQRModal({ patient, onClose }) {
  const [token, setToken] = useState(patient.qrLoginToken || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generate = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await callApi("adminConfig", { action: "regenerateQrToken", patientId: patient.id });
      setToken(res.data.token);
    } catch (err) {
      setError(err.message || "Gagal membuat QR.");
    } finally {
      setLoading(false);
    }
  };

  const loginUrl = token ? `${FRONTEND_URL}/portal/login?pid=${patient.id}&token=${token}` : null;

  const handleDownload = () => {
    const canvas = document.getElementById("patient-portal-qr-canvas");
    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = `Portal-QR-${patient.mrn || patient.id}.png`;
    link.click();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(23,38,43,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div className="card" style={{ width: 340, textAlign: "center" }}>
        <h3 style={{ marginBottom: 4 }}>QR Portal Pasien — My NCD Safety</h3>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 12 }}>
          {patient.name} — No. RM: {patient.mrn}
        </p>
        <p style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 12 }}>
          QR ini BERBEDA dari QR identitas biasa. Pasien scan pakai kamera HP-nya sendiri untuk login ke aplikasi pemantauan mandiri di rumah.
        </p>

        {loginUrl ? (
          <div style={{ background: "#fff", padding: 16, borderRadius: 12, display: "inline-block" }}>
            <QRCodeCanvas id="patient-portal-qr-canvas" value={loginUrl} size={200} />
          </div>
        ) : (
          <p className="stat-sub">Belum ada QR Portal untuk pasien ini.</p>
        )}

        {error && <div className="error-text" style={{ marginTop: 8 }}>{error}</div>}

        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 16 }}>
          {loginUrl && <button className="btn btn-primary" onClick={handleDownload}>Unduh PNG</button>}
          <button className="btn btn-ghost" disabled={loading} onClick={generate}>
            {loading ? "Membuat..." : loginUrl ? "Cetak Ulang QR" : "Buat QR"}
          </button>
        </div>
        <button className="btn btn-ghost" style={{ width: "100%", marginTop: 10 }} onClick={onClose}>
          Tutup
        </button>
      </div>
    </div>
  );
}
