import { QRCodeCanvas } from "qrcode.react";

export default function PatientQRModal({ patient, onClose }) {
  const handlePrint = () => window.print();

  const handleDownload = () => {
    const canvas = document.getElementById("patient-qr-canvas");
    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = `QR-${patient.mrn || patient.id}.png`;
    link.click();
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(23,38,43,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
      }}
    >
      <div className="card" style={{ width: 340, textAlign: "center" }}>
        <h3 style={{ marginBottom: 4 }}>QR Pasien</h3>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 12 }}>
          {patient.name} \u2014 No. RM: {patient.mrn}
        </p>
        <div style={{ background: "#fff", padding: 16, borderRadius: 12, display: "inline-block" }}>
          <QRCodeCanvas id="patient-qr-canvas" value={patient.mrn || patient.id} size={200} />
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 16 }}>
          <button className="btn btn-primary" onClick={handleDownload}>Unduh PNG</button>
          <button className="btn btn-ghost" onClick={handlePrint}>Cetak</button>
        </div>
        <button className="btn btn-ghost" style={{ width: "100%", marginTop: 10 }} onClick={onClose}>
          Tutup
        </button>
      </div>
    </div>
  );
}
