import { PieChart, Pie, Cell, Tooltip } from "recharts";

const G = { Low: ["#5be08a","#2fae6f"], Moderate: ["#ffc266","#f5a623"], High: ["#ff8a70","#e6553f"], "Red Flag": ["#e0605a","#a5281f"] };

function CustomTooltip({ active, payload, total }) {
  if (!active || !payload || !payload.length) return null;
  const { name, value } = payload[0];
  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
  return (
    <div style={{ background: "rgba(10,17,40,0.95)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10, padding: "8px 12px", color: "#fff", fontSize: 13 }}>
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
        <filter id="pieShadow3d" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="7" stdDeviation="7" floodColor="#000" floodOpacity="0.5"/></filter>
      </defs></svg>
      <PieChart width={size} height={size}>
        <Pie data={d} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={size*0.22} outerRadius={size*0.42} paddingAngle={3} startAngle={90} endAngle={-270} stroke="rgba(255,255,255,0.18)" strokeWidth={1} style={{ filter:"url(#pieShadow3d)" }}>
          {d.map((e) => <Cell key={e.name} fill={`url(#pg-${e.name.replace(" ","")})`} />)}
        </Pie>
        <Tooltip content={<CustomTooltip total={total} />} />
      </PieChart>
      <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", textAlign:"center", pointerEvents:"none" }}>
        <div style={{ fontSize:24, fontWeight:700, color:"#fff" }}>{total}</div>
        <div style={{ fontSize:11, color:"rgba(244,253,251,0.7)" }}>Pasien</div>
      </div>
    </div>
  );
}
