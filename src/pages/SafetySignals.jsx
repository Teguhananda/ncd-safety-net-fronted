import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { callApi } from "../lib/api";
import { Link } from "react-router-dom";

const SEVERITY_LABEL = {
  URGENT: { emoji: "🔴", text: "URGENT" },
  ACTION_NEEDED: { emoji: "🟠", text: "ACTION NEEDED" },
  ATTENTION: { emoji: "🟡", text: "FOLLOW-UP / CARE GAP" },
};

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
                <div className="stat-sub">Status alur: {s.workflowStatus}</div>

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
