// REVISI (21 Okt 2026, tema Forest Mist): emoji bulatan warna diganti ikon
// garis (centang / lingkaran-! / segitiga-!) supaya status tidak dibedakan
// oleh warna saja. Label & logika status TIDAK berubah.
const LABELS = {
  LOW: ["low", "check", "Low"],
  MODERATE: ["moderate", "info", "Moderate"],
  HIGH: ["high", "warn", "High"],
  RED_FLAG: ["redflag", "", "Red Flag"],
};

function StatusIcon({ kind }) {
  const common = {
    width: 13, height: 13, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
    strokeWidth: 2.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true,
  };
  if (kind === "check") return <svg {...common}><path d="M20 6 9 17l-5-5" /></svg>;
  if (kind === "info") return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></svg>;
  if (kind === "warn") return <svg {...common}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></svg>;
  return null;
}

export default function RiskBadge({ status }) {
  const [cls, icon, text] = LABELS[status] || ["low", "", status || "-"];
  const isRedFlag = status === "RED_FLAG";
  return (
    <span className={`badge ${cls}`}>
      {isRedFlag ? <span className="beacon" /> : icon ? <span className="dot-blink badge-icon"><StatusIcon kind={icon} /></span> : null}
      {text}
    </span>
  );
}
