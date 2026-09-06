import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { callApi } from "../lib/api";
import { Link } from "react-router-dom";

const SEVERITY_LABEL = {
  URGENT: { emoji: "🔴", text: "URGENT" },
  ACTION_NEEDED: { emoji: "🟠", text: "ACTION NEEDED" },
  ATTENTION: { emoji: "🟡", text: "FOLLOW-UP / CARE GAP" },
};

const VITALS_LABEL = {
  systolicBP: "Tensi Sistolik",
  diastolicBP: "Tensi Diastolik",
  bloodGlucose: "Gula Darah",
};

function fmtVitalsTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// Ubah nomor lokal (08xxx) jadi format internasional (628xxx) yang
// dibutuhkan wa.me — belum ada gateway WA resmi (butuh verifikasi bisnis
// Meta 3-10 hari kerja), jadi ini solusi 1-klik yang bisa jalan hari ini:
// staff tinggal tekan Kirim, bukan sepenuhnya otomatis tanpa staf.
function toWhatsAppNumber(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) return "62" + digits.slice(1);
  if (digits.startsWith("62")) return digits;
  return "62" + digits;
}

// Salam pembuka menyesuaikan jam sungguhan HP staff saat tombol WA
// diklik (real-time) — sebelumnya masih placeholder teks "[waktu]"
// yang tidak pernah terganti otomatis.
function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour >= 4 && hour < 11) return "Pagi";
  if (hour >= 11 && hour < 15) return "Siang";
  if (hour >= 15 && hour < 18) return "Sore";
  return "Malam";
}

function buildWhatsAppMessage(patientName, sev, reasons) {
  const waktu = getTimeGreeting();
  const greeting = sev.text === "URGENT"
    ? `Selamat ${waktu}, Bapak/Ibu ${patientName}. Kami dari RSUD Kab. Rejang Lebong ingin menanyakan kondisi Bapak/Ibu karena sistem mendeteksi hal yang perlu SEGERA ditindaklanjuti:`
    : `Selamat ${waktu}, Bapak/Ibu ${patientName}. Kami dari RSUD Kab. Rejang Lebong ingin menanyakan kondisi Bapak/Ibu terkait pemantauan kesehatan mandiri:`;
  const reasonText = (reasons || []).map((r) => `- ${r}`).join("\n");
  return `${greeting}\n${reasonText}\n\nMohon informasikan kondisi Bapak/Ibu saat ini. Kalau ada keluhan berat, segera ke IGD RSUD Kab. Rejang Lebong.`;
}

/**
 * SafetySignals.jsx — halaman BARU untuk "Home Safety Signals" (bagian J
 * spesifikasi). Dashboard.jsx hanya menampilkan ringkasan + link ke sini,
 * supaya Dashboard existing tidak perlu dirombak.
 */
export default function SafetySignals() {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionDraft, setActionDraft] = useState({});
  const [busyId, setBusyId] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await callApi("safetyPlan", { action: "listActiveSignals" });
      setSignals(res.data.signals);
    } catch (err) {
      setError(err.message || "Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const handleAcknowledge = async (id) => {
    setBusyId(id);
    try {
      await callApi("safetyPlan", { action: "acknowledgeSignal", signalId: id });
      await load();
    } catch (err) { alert(err.message); } finally { setBusyId(null); }
  };

  const handleActionTaken = async (id) => {
    const actionTaken = actionDraft[id];
    if (!actionTaken) { alert("Isi dulu tindakan yang dilakukan."); return; }
    setBusyId(id);
    try {
      await callApi("safetyPlan", { action: "actionTakenSignal", signalId: id, actionTaken });
      await load();
    } catch (err) { alert(err.message); } finally { setBusyId(null); }
  };

  const handleClose = async (id) => {
    const patientConfirmed = window.confirm("Apakah pasien sudah dikonfirmasi (mis. lewat telepon)?");
    setBusyId(id);
    try {
      await callApi("safetyPlan", { action: "closeSignal", signalId: id, patientConfirmed });
      await load();
    } catch (err) { alert(err.message); } finally { setBusyId(null); }
  };

  return (
    <Layout title="Home Safety Signals" meta="Sinyal dari pemantauan mandiri pasien di rumah — perlu tindak lanjut">
      <div className="card">
        {loading ? (
          <div className="stat-sub">Memuat...</div>
        ) : error ? (
          <div className="error-text">{error}</div>
        ) : signals.length === 0 ? (
          <div className="stat-sub">Tidak ada sinyal aktif saat ini. Semua pasien home monitoring dalam status aman.</div>
        ) : (
          signals.map((s) => {
            const sev = SEVERITY_LABEL[s.severity] || { emoji: "⚪", text: s.severity };
            return (
              <div key={s.id} className="card" style={{ background: "var(--surface-2)", marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div>
                    <b>{sev.emoji} {s.patient?.name || s.patientId}</b>
                    <span className="stat-sub"> — No.RM: {s.patient?.mrn || "-"}</span>
                  </div>
                  <span className="stat-sub">{sev.text}</span>
                </div>
                <div style={{ margin: "8px 0", fontSize: 13 }}>
                  <b>Alasan:</b>
                  <ul style={{ margin: "4px 0 0 18px" }}>
                    {(s.reason || []).map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>

                {s.latestVitals && Object.keys(s.latestVitals).length > 0 && (
                  <div style={{ margin: "8px 0", padding: "10px 12px", background: "var(--glass-bg)", borderRadius: 10, fontSize: 13 }}>
                    <b>📊 Hasil Kontrol Mandiri Terbaru:</b>
                    <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: "6px 18px" }}>
                      {Object.entries(s.latestVitals).map(([param, v]) => (
                        <span key={param}>
                          {VITALS_LABEL[param] || param}: <b>{v.value} {v.unit}</b>
                          <span className="stat-sub"> ({fmtVitalsTime(v.timestamp)})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="stat-sub">Status alur: {s.workflowStatus}</div>

                {s.patient?.phone ? (
                  <a
                    className="btn btn-primary"
                    style={{ marginTop: 8, display: "inline-block", textDecoration: "none", background: "#25D366" }}
                    href={`https://wa.me/${toWhatsAppNumber(s.patient.phone)}?text=${encodeURIComponent(buildWhatsAppMessage(s.patient?.name || s.patientId, sev, s.reason))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    💬 Hubungi via WhatsApp
                  </a>
                ) : (
                  <div className="stat-sub" style={{ marginTop: 8 }}>
                    📱 No. HP pasien belum diisi — isi dulu lewat Daftar Pasien untuk bisa hubungi via WhatsApp.
                  </div>
                )}

                <Link
                  className="btn btn-ghost"
                  style={{ marginTop: 8, marginLeft: 8, display: "inline-block", textDecoration: "none" }}
                  to={`/incident?patientId=${encodeURIComponent(s.patientId)}&description=${encodeURIComponent(
                    `Terdeteksi dari Home Safety Signal (${sev.text}) pada ${s.patient?.name || s.patientId} — No.RM ${s.patient?.mrn || "-"}:\n` +
                    (s.reason || []).map((r) => `- ${r}`).join("\n")
                  )}`}
                >
                  🚨 Lapor sebagai Insiden
                </Link>

                {s.workflowStatus === "OPEN" && (
                  <button className="btn btn-primary" style={{ marginTop: 8 }} disabled={busyId === s.id} onClick={() => handleAcknowledge(s.id)}>
                    Tandai Sudah Dilihat (Acknowledge)
                  </button>
                )}
                {s.workflowStatus === "ACKNOWLEDGED" && (
                  <div style={{ marginTop: 8 }}>
                    <input
                      placeholder="Tindakan yang dilakukan..."
                      value={actionDraft[s.id] || ""}
                      onChange={(e) => setActionDraft((d) => ({ ...d, [s.id]: e.target.value }))}
                      style={{ width: "100%", padding: 8, marginBottom: 6, border: "1px solid var(--line)", borderRadius: 8 }}
                    />
                    <button className="btn btn-primary" disabled={busyId === s.id} onClick={() => handleActionTaken(s.id)}>
                      Simpan Tindakan
                    </button>
                  </div>
                )}
                {s.workflowStatus === "ACTION_TAKEN" && (
                  <button className="btn btn-primary" style={{ marginTop: 8 }} disabled={busyId === s.id} onClick={() => handleClose(s.id)}>
                    Tutup (Closed)
                  </button>
                )}

                <Link className="btn btn-ghost" style={{ marginTop: 8, display: "inline-block" }} to={`/patient-history?patientId=${s.patientId}`}>
                  Lihat Riwayat Lengkap
                </Link>
              </div>
            );
          })
        )}
      </div>
    </Layout>
  );
}
