import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { callApi } from "../lib/api";
import Layout from "../components/Layout";

const TYPE_LABEL = {
  screening: "🩺 Screening",
  risk_assessment: "📊 Hasil Risiko",
  clinical_review: "👨‍⚕️ Clinical Review",
  followup: "📅 Follow-up",
};

export default function PatientHistory() {
  const [params] = useSearchParams();
  const patientId = params.get("patientId") || "";
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!patientId) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await callApi("patientHistory", { patientId });
        setTimeline(res.data.timeline || []);
      } catch (e) {
        setError(e.message || "Gagal memuat riwayat.");
      } finally {
        setLoading(false);
      }
    })();
  }, [patientId]);

  return (
    <Layout title="Riwayat Pasien" meta={patientId ? `Pasien: ${patientId}` : "Buka dari Daftar Pasien"}>
      <div className="card">
        {!patientId ? (
          <div className="stat-sub">Buka halaman ini dari Daftar Pasien.</div>
        ) : loading ? (
          <div className="stat-sub">Memuat riwayat...</div>
        ) : error ? (
          <div className="error-text">{error}</div>
        ) : timeline.length === 0 ? (
          <div className="stat-sub">Belum ada riwayat untuk pasien ini.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {timeline.map((item, i) => (
              <div key={i} className="card" style={{ background: "var(--surface-2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <strong>{TYPE_LABEL[item.type] || item.type}</strong>
                  <span className="stat-sub mono">
                    {item.date ? new Date(item.date).toLocaleString("id-ID") : "-"}
                  </span>
                </div>
                <div>{item.summary}</div>
                {item.type === "screening" && item.detail.redFlags.length > 0 && (
                  <div className="stat-sub" style={{ marginTop: 4 }}>
                    Red flag: {item.detail.redFlags.join(", ")}
                  </div>
                )}
                {item.type === "clinical_review" && item.detail.decisionNotes && (
                  <div className="stat-sub" style={{ marginTop: 4 }}>
                    Catatan: {item.detail.decisionNotes}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
