import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, limit, query } from "firebase/firestore";
import { db } from "../lib/firebase";
import Layout from "../components/Layout";
import RiskBadge from "../components/RiskBadge";
import TrendChart from "../components/TrendChart";

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [attentionList, setAttentionList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // Ambil 7 snapshot terakhir (dihasilkan scheduled function computeAnalyticsSummary)
      const summarySnap = await getDocs(
        query(collection(db, "analytics_summary"), orderBy("generatedAt", "desc"), limit(7))
      );
      const summaries = summarySnap.docs.map((d) => ({ periodId: d.id, ...d.data() }));
      if (summaries.length > 0) setSummary(summaries[0]);
      setHistory([...summaries].reverse());

      // Pasien dengan status HIGH/RED_FLAG terbaru
      const riskSnap = await getDocs(
        query(collection(db, "risk_assessments"), orderBy("createdAt", "desc"), limit(20))
      );
      const attention = riskSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((r) => r.riskStatus === "HIGH" || r.riskStatus === "RED_FLAG")
        .slice(0, 5);
      setAttentionList(attention);
      setLoading(false);
    }
    load();
  }, []);

  const dist = summary?.riskDistribution || { low: 0, moderate: 0, high: 0, redFlag: 0 };
  const total = dist.low + dist.moderate + dist.high + dist.redFlag || 1;
  const pct = (n) => Math.round((n / total) * 100);

  return (
    <Layout title="Dashboard" meta="Ringkasan keselamatan pasien NCD">
      <div className="grid cols-3">
        <div className="card">
          <div className="stat-label">Total Skrining</div>
          <div className="stat-value mono">{summary ? summary.totalScreenings : "-"}</div>
          <div className="stat-sub">Data agregat (snapshot harian)</div>
        </div>
        <div className="card">
          <div className="stat-label">Red Flag Aktif</div>
          <div className="stat-value mono" style={{ color: "var(--redflag)" }}>
            {dist.redFlag}
          </div>
          <div className="stat-sub">Menunggu tinjauan klinis</div>
        </div>
        <div className="card">
          <div className="stat-label">Hilang dari Tindak Lanjut</div>
          <div className="stat-value mono" style={{ color: "var(--moderate)" }}>
            {summary ? summary.lostToFollowupCount : "-"}
          </div>
          <div className="stat-sub">Perlu tindak lanjut</div>
        </div>
      </div>

      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>Distribusi Risiko</h3>
          {[
            ["🟢 Low", dist.low, "var(--low)"],
            ["🟡 Moderate", dist.moderate, "var(--moderate)"],
            ["🔴 High", dist.high, "var(--high)"],
            ["🚨 Red Flag", dist.redFlag, "var(--redflag)"],
          ].map(([label, val, color]) => (
            <div key={label} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                <span>{label}</span>
                <span className="mono">{val}</span>
              </div>
              <div style={{ height: 7, background: "var(--surface-2)", borderRadius: 4 }}>
                <div style={{ height: "100%", width: pct(val) + "%", background: color, borderRadius: 4 }}></div>
              </div>
            </div>
          ))}
        </div>
        <div className="card">
          <h3>Pasien Perlu Perhatian</h3>
          {loading ? (
            <div className="stat-sub">Memuat...</div>
          ) : attentionList.length === 0 ? (
            <div className="stat-sub">Tidak ada pasien High/Red Flag saat ini.</div>
          ) : (
            <table>
              <tbody>
                {attentionList.map((r) => (
                  <tr key={r.id} className={r.riskStatus === "RED_FLAG" ? "row-redflag" : ""}>
                    <td className="mono">{r.patientId}</td>
                    <td>
                      <RiskBadge status={r.riskStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Tren 7 Hari Terakhir</h3>
        <TrendChart
          data={history}
          height={180}
          lines={[
            { key: "totalScreenings", label: "Total Skrining", color: "#3B5670" },
            { key: "lostToFollowupCount", label: "Hilang dari Tindak Lanjut", color: "#C8552B" },
          ]}
        />
      </div>
    </Layout>
  );
}
