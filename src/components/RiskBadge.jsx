const LABELS = {
  LOW: ["low", "\u{1F7E2}", "Low"],
  MODERATE: ["moderate", "\u{1F7E1}", "Moderate"],
  HIGH: ["high", "\u{1F534}", "High"],
  RED_FLAG: ["redflag", "", "Red Flag"],
};

export default function RiskBadge({ status }) {
  const [cls, emoji, text] = LABELS[status] || ["low", "", status || "-"];
  const isRedFlag = status === "RED_FLAG";
  return (
    <span className={`badge ${cls}`}>
      {isRedFlag ? <span className="beacon" /> : <span className="dot-blink">{emoji}</span>}
      {text}
    </span>
  );
}
