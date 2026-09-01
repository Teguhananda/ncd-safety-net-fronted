import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, orderBy, query, limit } from "firebase/firestore";
import { db } from "../lib/firebase";
import Layout from "../components/Layout";
import TrendChart from "../components/TrendChart";

function pct(v) {
  if (v === null || v === undefined) return "-";
  return Math.round(v * 100) + "%";
}

const PERIOD_OPTIONS = [
  ["7", "7 hari terakhir"],
  ["14", "14 hari terakhir"],
  ["30", "30 hari terakhir"],
];

export default function Analytics() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodDays, setPeriodDays] = useState("14");

  useEffect(() => {
    async function load() {
      // Ambil 30 snapshot terakhir sekali saja; filter periode dilakukan di
      // client supaya ganti periode tidak perlu query ulang ke Firestore.
      const snap = await getDocs(query(collection(db, "analytics_summary"), orderBy("generatedAt", "desc"), limit(30)));
      setRows(snap.docs.map((d) => ({ periodId: d.id, ...d.data() })));
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => rows.slice(0, Number(periodDays)), [rows, periodDays]);
  const chartData = useMemo(() => [...filtered].reverse(), [filtered]); // terlama -> terbaru untuk chart
  const latest = filtered[0];

  // Rata-rata sederhana untuk KPI ringkasan periode (bukan snapshot tunggal)
  const avg = (key) => {
    const vals = filtered.map((r) => r[key]).filter((v) => v !== null && v !== undefined);
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };

  const totalScreeningPeriod = filtered.reduce((sum, r) => sum + (r.totalScreenings || 0), 0);
  const totalSafetyEvents = filtered.reduce((sum, r) => sum + (r.safetyEventCount || 0), 0);
  const totalLost = filtered.reduce((sum, r) => sum + (r.lostToFollowupCount || 0), 0);

  return (
    <Layout title="Analytics PMKP" meta="Dashboard mutu &amp; keselamatan pasien NCD">
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
        <select value={periodDays} onChange={(e) => setPeriodDays(e.target.value)} style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13 }}>
          {PERIOD_OPTIONS.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="stat-sub">Memuat...</div>
      ) : rows.length === 0 ? (
        <div className="card">
          <div className="stat-sub">
            Belum ada snapshot. Fungsi <span className="mono">computeAnalyticsSummary</span> berjalan otomatis tiap
            malam jam 23:30 WIB — snapshot pertama akan muncul setelah dijalankan minimal sekali.
          </div>
        </div>
      ) : (
        <>
          <div className="grid cols-3">
            <div className="card">
              <div className="stat-label">Total Screening (periode)</div>
              <div className="stat-value mono">{totalScreeningPeriod}</div>
            </div>
            <div className="card">
              <div className="stat-label">Safety Events (periode)</div>
              <div className="stat-value mono">{totalSafetyEvents}</div>
            </div>
            <div className="card">
              <div className="stat-label">Lost to Follow-up (periode)</div>
              <div className="stat-value mono" style={{ color: "var(--moderate)" }}>{totalLost}</div>
            </div>
          </div>

          <div className="grid cols-2" style={{ marginTop: 16 }}>
            <div className="card">
              <h3>Rata-rata Indikator Completion (periode)</h3>
              <div className="score-row"><span>Medication Reconciliation Rate</span><span className="mono">{pct(avg("medicationReconciliationRate"))}</span></div>
              <div className="score-row"><span>Red Flag Response Rate</span><span className="mono">{pct(avg("redFlagResponseRate"))}</span></div>
              <div className="score-row"><span>Education Completion Rate</span><span className="mono">{pct(avg("educationCompletionRate"))}</span></div>
              <div className="score-row"><span>Follow-up Completion Rate</span><span className="mono">{pct(avg("followupCompletionRate"))}</span></div>
            </div>
            <div className="card">
              <h3>Distribusi Risiko (Snapshot Terbaru — {latest?.periodId})</h3>
              {latest?.riskDistribution ? (
                <div>
                  <div className="score-row"><span>🟢 Low</span><span className="mono">{latest.riskDistribution.low}</span></div>
                  <div className="score-row"><span>🟡 Moderate</span><span className="mono">{latest.riskDistribution.moderate}</span></div>
                  <div className="score-row"><span>🔴 High</span><span className="mono">{latest.riskDistribution.high}</span></div>
                  <div className="score-row"><span>🚨 Red Flag</span><span className="mono">{latest.riskDistribution.redFlag}</span></div>
                </div>
              ) : (
                <div className="stat-sub">Tidak ada data.</div>
              )}
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Tren Total Screening &amp; Lost to Follow-up</h3>
            <TrendChart
              data={chartData}
              lines={[
                { key: "totalScreenings", label: "Total Screening", color: "#3B5670" },
                { key: "lostToFollowupCount", label: "Lost to Follow-up", color: "#C8552B" },
              ]}
            />
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Tren Completion Rate</h3>
            <TrendChart
              data={chartData.map((r) => ({
                periodId: r.periodId,
                medRecon: r.medicationReconciliationRate !== undefined && r.medicationReconciliationRate !== null ? Math.round(r.medicationReconciliationRate * 100) : null,
                education: r.educationCompletionRate !== undefined && r.educationCompletionRate !== null ? Math.round(r.educationCompletionRate * 100) : null,
                followup: r.followupCompletionRate !== undefined && r.followupCompletionRate !== null ? Math.round(r.followupCompletionRate * 100) : null,
              }))}
              lines={[
                { key: "medRecon", label: "Med. Reconciliation %", color: "#2E9E6D" },
                { key: "education", label: "Education %", color: "#B8862E" },
                { key: "followup", label: "Follow-up %", color: "#3B5670" },
              ]}
            />
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Rincian per Hari</h3>
            <table>
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Total Screening</th>
                  <th>Med. Reconciliation</th>
                  <th>Follow-up Completion</th>
                  <th>Lost to Follow-up</th>
                  <th>Safety Events</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.periodId}>
                    <td className="mono">{r.periodId}</td>
                    <td className="mono">{r.totalScreenings}</td>
                    <td className="mono">{pct(r.medicationReconciliationRate)}</td>
                    <td className="mono">{pct(r.followupCompletionRate)}</td>
                    <td className="mono">{r.lostToFollowupCount}</td>
                    <td className="mono">{r.safetyEventCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Layout>
  );
}
