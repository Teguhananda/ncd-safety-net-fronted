import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

/**
 * TrendChart — grafik tren mingguan/harian untuk dashboard PMKP (Fase 1 §11).
 * data: array snapshot analytics_summary, terurut TERLAMA -> TERBARU (dibalik
 * dari urutan query orderBy desc).
 * lines: [{ key: "totalScreenings", label: "Total Screening", color: "..." }]
 */
export default function TrendChart({ data, lines, height = 220 }) {
  if (!data || data.length === 0) {
    return <div className="stat-sub">Belum ada data tren.</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
        <XAxis dataKey="periodId" tick={{ fontSize: 11, fill: "var(--ink-soft)" }} />
        <YAxis tick={{ fontSize: 11, fill: "var(--ink-soft)" }} />
        <Tooltip
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid var(--line)",
            fontFamily: "Inter, sans-serif",
          }}
        />
        {lines.map((l) => (
          <Line
            key={l.key}
            type="monotone"
            dataKey={l.key}
            name={l.label}
            stroke={l.color}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
