const LABELS = {
  LOW: ["low", "🟢 Low"],
  MODERATE: ["moderate", "🟡 Moderate"],
  HIGH: ["high", "🔴 High"],
  RED_FLAG: ["redflag", "🚨 Red Flag"],
};

export default function RiskBadge({ status }) {
  const [cls, label] = LABELS[status] || ["low", status || "-"];
  return (
    <span className={`badge ${cls}`}>
      <span className="dot"></span>
      {label}
    </span>
  );
}
