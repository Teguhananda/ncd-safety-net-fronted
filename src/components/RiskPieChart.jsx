import { PieChart, Pie, Cell, Tooltip } from "recharts";

// 21 Okt 2026 (tema Forest Mist): warna status disesuaikan palet baru.
const G = { Low: ["#3fae84","#16845B"], Moderate: ["#f2b850","#D99018"], High: ["#ffa395","#FF7A6B"], "Red Flag": ["#d65a5e","#B23439"] };

function CustomTooltip({ active, payload, total }) {
  if (!active || !payload || !payload.length) return null;
  const { name, value } = payload[0];
  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
  return (
    <div style={{ background: "#174F46", border: "1px solid #174F46", borderRadius: 10, padding: "8px 12px", color: "#fff", fontSize: 13 }}>
      <div style={{ fontWeight: 700 }}>{name}</div>
      <div>{value} pasien ({pct}%)</div>
    </div>
  );
}

export default function RiskPieChart({ data, size = 220 }) {
  const d = [{ name:"Low", value:data.low||0 },{ name:"Moderate", value:data.moderate||0 },{ name:"High", value:data.high||0 },{ name:"Red Flag", value:data.redFlag||0 }];
  const total = d.reduce((s,x)=>s+x.value,0);
  return (
    <div style={{ position:"relative", width:size, margin:"8px auto 0" }}>
      <svg width="0" height="0"><defs>
        {Object.entries(G).map(([k,[a,b]]) => <radialGradient id={`pg-${k.replace(" ","")}`} key={k} cx="35%" cy="30%" r="75%"><stop offset="0%" stopColor={a}/><stop offset="100%" stopColor={b}/></radialGradient>)}
        <filter id="pieShadow3d" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="7" stdDeviation="7" floodColor="#174F46" floodOpacity="0.22"/></filter>
      </defs></svg>
      <PieChart width={size} height={size}>
        <Pie data={d} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={size*0.22} outerRadius={size*0.42} paddingAngle={3} startAngle={90} endAngle={-270} stroke="#ffffff" strokeWidth={1} style={{ filter:"url(#pieShadow3d)" }}>
          {d.map((e) => <Cell key={e.name} fill={`url(#pg-${e.name.replace(" ","")})`} />)}
        </Pie>
        <Tooltip content={<CustomTooltip total={total} />} />
      </PieChart>
      <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", textAlign:"center", pointerEvents:"none" }}>
        <div style={{ fontSize:24, fontWeight:700, color:"var(--ink)" }}>{total}</div>
        <div style={{ fontSize:12, color:"var(--ink-soft)" }}>Pasien</div>
      </div>
    </div>
  );
}
