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

// ==== BAGIAN BARU (Sept 2026): tampilan Laporan Kepatuhan Obat & TTV ====
const SLOT_LABEL_STAFF = { pagi: "Pagi", siang: "Siang", malam: "Malam" };
const MED_STATUS = {
  taken: { icon: "✅", label: "Diminum" },
  skipped: { icon: "⏭️", label: "Tidak diminum (dikonfirmasi pasien)" },
  missed: { icon: "❌", label: "Tidak ada konfirmasi" },
  pending: { icon: "⏳", label: "Hari ini, belum dikonfirmasi" },
};
const TTV_STATUS = {
  done: { icon: "✅", label: "Diisi" },
  missed: { icon: "❌", label: "Terlewat" },
  pending: { icon: "⏳", label: "Hari ini, belum diisi" },
};

function shortDate(dateStr) {
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

function pctColor(p) {
  if (p === null || p === undefined) return "inherit";
  if (p >= 80) return "#34d399";
  if (p >= 50) return "#f5a623";
  return "#ff5c50";
}

function ComplianceCard({ compliance }) {
  const meds = compliance.medications || [];
  const ttv = compliance.ttv || { parameters: [], daily: [] };
  const last7 = (arr) => (arr || []).slice(-7);

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h3>💊 Kepatuhan Obat &amp; TTV — {compliance.periodDays} Hari Terakhir</h3>
      <div className="stat-sub" style={{ marginBottom: 12 }}>
        Obat diambil dari rekonsiliasi obat RS yang masih aktif. Kepatuhan dihitung dari konfirmasi pasien di
        Portal (tombol "Sudah Minum"), mulai hari berikutnya setelah obat diresepkan.
      </div>

      <div className="stat-label">Ringkasan Obat</div>
      {meds.length === 0 ? (
        <div className="stat-sub" style={{ marginBottom: 16 }}>
          Belum ada obat aktif berjadwal (Pagi/Siang/Malam) dari rekonsiliasi obat untuk pasien ini.
        </div>
      ) : (
        <table style={{ marginBottom: 16 }}>
          <thead>
            <tr><th>Obat</th><th>Sumber</th><th>Jadwal</th><th>Diminum</th><th>Tidak Diminum</th><th>Tanpa Konfirmasi</th><th>Kepatuhan</th></tr>
          </thead>
          <tbody>
            {meds.map((m) => (
              <tr key={m.id}>
                <td><b>{m.name}</b>{m.dose ? ` ${m.dose}` : ""}</td>
                <td>{m.source && m.source !== "unknown" ? m.source : "-"}</td>
                <td>{m.slots.map((s) => SLOT_LABEL_STAFF[s] || s).join(", ")}</td>
                <td>{m.taken}/{m.expected}</td>
                <td>{m.skipped}</td>
                <td style={{ color: m.missed > 0 ? "#ff5c50" : "inherit", fontWeight: m.missed > 0 ? 700 : 400 }}>{m.missed}</td>
                <td style={{ color: pctColor(m.percent), fontWeight: 700 }}>{m.percent === null ? "-" : `${m.percent}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {meds.length > 0 && (
        <>
          <div className="stat-label">Detail 7 Hari Terakhir (Obat)</div>
          <table style={{ marginBottom: 16 }}>
            <thead>
              <tr>
                <th>Obat / Jadwal</th>
                {last7(meds[0].daily).map((d) => <th key={d.date} className="mono">{shortDate(d.date)}</th>)}
              </tr>
            </thead>
            <tbody>
              {meds.flatMap((m) => m.slots.map((slot) => (
                <tr key={`${m.id}_${slot}`}>
                  <td>{m.name} — {SLOT_LABEL_STAFF[slot] || slot}</td>
                  {last7(m.daily).map((d) => {
                    const st = d.slots[slot];
                    const info = st ? MED_STATUS[st] : null;
                    return <td key={d.date} title={info ? info.label : "Belum berlaku"} style={{ textAlign: "center" }}>{info ? info.icon : "—"}</td>;
                  })}
                </tr>
              )))}
            </tbody>
          </table>
        </>
      )}

      <div className="stat-label">Monitoring TTV di Rumah</div>
      {ttv.parameters.length === 0 ? (
        <div className="stat-sub">Belum ada Safety Plan aktif dengan parameter TTV yang wajib dipantau.</div>
      ) : (
        <>
          <div style={{ marginBottom: 8 }}>
            Diisi <b>{ttv.done}/{ttv.expected}</b> hari-parameter
            {ttv.missed > 0 && <span style={{ color: "#ff5c50", fontWeight: 700 }}> — {ttv.missed} terlewat</span>}
            {ttv.percent !== null && <span style={{ color: pctColor(ttv.percent), fontWeight: 700 }}> ({ttv.percent}%)</span>}
            {ttv.frequency && <span className="stat-sub"> · Target: {ttv.frequency}</span>}
          </div>
          <table>
            <thead>
              <tr>
                <th>Parameter</th>
                {last7(ttv.daily).map((d) => <th key={d.date} className="mono">{shortDate(d.date)}</th>)}
              </tr>
            </thead>
            <tbody>
              {ttv.parameters.map((p) => (
                <tr key={p}>
                  <td>{PARAM_LABEL[p] || p}</td>
                  {last7(ttv.daily).map((d) => {
                    const st = d.status[p];
                    const info = st ? TTV_STATUS[st] : null;
                    return <td key={d.date} title={info ? info.label : "Belum berlaku"} style={{ textAlign: "center" }}>{info ? info.icon : "—"}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div className="stat-sub" style={{ marginTop: 12 }}>
        Keterangan: ✅ diminum/diisi · ⏭️ pasien menyatakan tidak minum · ❌ tidak ada konfirmasi/terlewat · ⏳ hari ini belum · — belum berlaku
      </div>
    </div>
  );
}

export default function PatientHistory() {
  const [params] = useSearchParams();
  const patientId = params.get("patientId") || "";
  const [timeline, setTimeline] = useState([]);
  const [homeSafetySummary, setHomeSafetySummary] = useState(null);
  const [compliance, setCompliance] = useState(null);
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
        setCompliance(res.data.compliance || null);
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
          {compliance && <ComplianceCard compliance={compliance} />}

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
