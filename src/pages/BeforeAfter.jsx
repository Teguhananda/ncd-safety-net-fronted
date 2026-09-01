import { useEffect, useState } from "react";
import { doc, getDoc, collection, getDocs, orderBy, query, limit } from "firebase/firestore";
import { db } from "../lib/firebase";
import Layout from "../components/Layout";

const INDICATOR_LABELS = {
  highRiskIdentified: "Identifikasi pasien high risk",
  medReconciliation: "Medication reconciliation lengkap",
  educationDocumented: "Dokumentasi edukasi",
  redFlagReviewed: "Clinical review red flag",
  followupCompletion: "Follow-up completion",
  lostToFollowup: "Lost to follow-up",
};

// Pemetaan indikator "before" (dari config/before_baseline, diisi manual
// oleh Admin) ke field yang sepadan di analytics_summary ("after").
const AFTER_FIELD_MAP = {
  highRiskIdentified: "highRiskIdentifiedRate",
  medReconciliation: "medicationReconciliationRate",
  educationDocumented: "educationCompletionRate",
  followupCompletion: "followupCompletionRate",
};

export default function BeforeAfter() {
  const [baseline, setBaseline] = useState(null);
  const [latest, setLatest] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [baselineSnap, summarySnap] = await Promise.all([
        getDoc(doc(db, "config", "before_baseline")),
        getDocs(query(collection(db, "analytics_summary"), orderBy("generatedAt", "desc"), limit(1))),
      ]);
      if (baselineSnap.exists()) setBaseline(baselineSnap.data());
      if (!summarySnap.empty) setLatest(summarySnap.docs[0].data());
      setLoading(false);
    }
    load();
  }, []);

  const pct = (v) => (v === null || v === undefined ? "-" : Math.round(v * 100) + "%");
  const delta = (before, after) => {
    if (before === undefined || after === undefined || before === null || after === null) return "-";
    if (before === 0) return "-";
    const d = ((after - before) / before) * 100;
    return (d >= 0 ? "+" : "") + Math.round(d) + "%";
  };

  return (
    <Layout title="Before–After Dashboard" meta="Impact of NCD Safety Net">
      {loading ? (
        <div className="stat-sub">Memuat...</div>
      ) : !baseline ? (
        <div className="card">
          <div className="stat-sub">
            Baseline "before implementation" belum diisi. Admin perlu mengisi lewat menu Administration →
            Before Baseline, berdasarkan data historis RS (kertas/Excel) sebelum sistem ini berjalan.
          </div>
        </div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Indikator</th>
                <th>Before</th>
                <th>After</th>
                <th>Δ%</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(baseline.indicators || {}).map(([key, beforeVal]) => {
                const afterField = AFTER_FIELD_MAP[key];
                const afterVal = afterField && latest ? latest[afterField] : undefined;
                return (
                  <tr key={key}>
                    <td>{INDICATOR_LABELS[key] || key}</td>
                    <td className="mono">{pct(beforeVal)}</td>
                    <td className="mono">{afterVal !== undefined ? pct(afterVal) : "belum ada field pemetaan"}</td>
                    <td className="mono" style={{ color: "var(--low)" }}>{delta(beforeVal, afterVal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {baseline.sourceNote && (
            <div className="hint">Sumber data before: {baseline.sourceNote}</div>
          )}
        </div>
      )}
    </Layout>
  );
}
