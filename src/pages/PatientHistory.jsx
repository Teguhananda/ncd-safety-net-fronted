import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { callApi } from "../lib/api";
import Layout from "../components/Layout";
import TrendChart from "../components/TrendChart";

const TYPE_LABEL = {
  screening: "🩺 Screening",
  risk_assessment: "📊 Hasil Risiko",
  clinical_review: "👨‍⚕️ Clinical Review",
  followup: "📅 Follow-up",
};

const PARAM_LABEL = {
  systolicBP: "Tensi Sistolik",
  diastolicBP: "Tensi Diastolik",
  bloodGlucose: "Gula Darah",
};

function fmtDateTime(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Susun ulang entri home_monitoring jadi format yang dipahami TrendChart
// (array titik dengan periodId + nilai per parameter), supaya tren tensi &
// gula darah dari monitoring mandiri pasien di rumah bisa dilihat sebagai
// grafik oleh dokter/petugas — bukan cuma daftar mentah.
function buildTrendData(entries) {
  const byTime = {};
  for (const e of entries) {
    const label = e.timestamp
      ? new Date(e.timestamp).toLocaleString("id-ID", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
      : "-";
    if (!byTime[label]) byTime[label] = { periodId: label };
    if (typeof e.value === "number") byTime[label][e.parameterType] = e.value;
  }
  return Object.values(byTime);
}

export default function PatientHistory() {
  const [params] = useSearchParams();
  const patientId = params.get("patientId") || "";
  const [timeline, setTimeline] = useState([]);
  const [homeSafetySummary, setHomeSafetySummary] = useState(null);
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
        setHomeSafetySummary(res.data.homeSafetySummary || null);
      } catch (e) {
        setError(e.message || "Gagal memuat riwayat.");
      } finally {
        setLoading(false);
      }
    })();
  }, [patientId]);

  const bpEntries = (homeSafetySummary?.monitoringEntries || []).filter((e) => e.parameterType === "systolicBP" || e.parameterType === "diastolicBP");
  const glucoseEntries = (homeSafetySummary?.monitoringEntries || []).filter((e) => e.parameterType === "bloodGlucose");

  return (
    <Layout title="Riwayat Pasien" meta={patientId ? `Pasien: ${patientId}` : "Buka dari Daftar Pasien"}>
      {!patientId ? (
        <div className="card"><div className="stat-sub">Buka halaman ini dari Daftar Pasien.</div></div>
      ) : loading ? (
        <div className="card"><div className="stat-sub">Memuat riwayat...</div></div>
      ) : error ? (
        <div className="card"><div className="error-text">{error}</div></div>
      ) : (
        <>
          {/* ==== BAGIAN BARU: Home Safety Summary — data monitoring mandiri
              pasien dari rumah (bagian M spesifikasi). Backend sudah lama
              mengirim data ini, tapi sebelumnya tidak pernah ditampilkan
              di halaman ini sama sekali. ==== */}
          {homeSafetySummary && (
            <div className="card" style={{ marginBottom: 20 }}>
              <h3>🏠 Home Safety Summary — {homeSafetySummary.periodDays} Hari Terakhir</h3>
              <div className="stat-sub" style={{ marginBottom: 12 }}>
                Data yang dikirim pasien sendiri dari rumah lewat Portal My NCD Safety.
              </div>

              {(homeSafetySummary.monitoringEntries || []).length === 0 ? (
                <div className="stat-sub">Pasien belum mengisi monitoring mandiri dalam periode ini.</div>
              ) : (
                <div className="grid cols-2">
                  {bpEntries.length > 0 && (
                    <div>
                      <div className="stat-label">Tren Tekanan Darah</div>
                      <TrendChart
                        data={buildTrendData(bpEntries)}
                        lines={[
                          { key: "systolicBP", label: "Sistolik", color: "#ff5c50" },
                          { key: "diastolicBP", label: "Diastolik", color: "#17b8a6" },
                        ]}
                        height={180}
                      />
                    </div>
                  )}
                  {glucoseEntries.length > 0 && (
                    <div>
                      <div className="stat-label">Tren Gula Darah</div>
                      <TrendChart
                        data={buildTrendData(glucoseEntries)}
                        lines={[{ key: "bloodGlucose", label: "Gula Darah", color: "#f5a623" }]}
                        height={180}
                      />
                    </div>
                  )}
                </div>
              )}

              {(homeSafetySummary.monitoringEntries || []).length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div className="stat-label">Data Mentah Monitoring</div>
                  <table>
                    <thead>
                      <tr><th>Tanggal &amp; Jam</th><th>Parameter</th><th>Nilai</th><th>Keluhan</th></tr>
                    </thead>
                    <tbody>
                      {homeSafetySummary.monitoringEntries.slice().reverse().map((e) => (
                        <tr key={e.id}>
                          <td className="mono">{fmtDateTime(e.timestamp)}</td>
                          <td>{PARAM_LABEL[e.parameterType] || e.parameterType}</td>
                          <td>{e.value} {e.unit}</td>
                          <td>{e.symptom || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {(homeSafetySummary.checkins || []).length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div className="stat-label">Safety Check-In</div>
                  <table>
                    <thead>
                      <tr><th>Tanggal &amp; Jam</th><th>Obat Sesuai</th><th>Keluhan Baru</th><th>Merasa Lebih Buruk</th></tr>
                    </thead>
                    <tbody>
                      {homeSafetySummary.checkins.slice().reverse().map((c) => (
                        <tr key={c.id}>
                          <td className="mono">{fmtDateTime(c.submittedAt)}</td>
                          <td>{c.answers?.medicationAsPlanned === false ? "❌ Tidak" : "✅ Ya"}</td>
                          <td>{c.answers?.newComplaint ? "⚠️ Ya" : "Tidak"}</td>
                          <td>{c.answers?.feelsWorse ? "🔴 Ya" : "Tidak"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <div className="card">
            <h3>Linimasa Kunjungan &amp; Tindakan Klinis</h3>
            {timeline.length === 0 ? (
              <div className="stat-sub">Belum ada riwayat untuk pasien ini.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {timeline.map((item, i) => (
                  <div key={i} className="card" style={{ background: "var(--glass-bg-strong)" }}>
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
        </>
      )}
    </Layout>
  );
}
