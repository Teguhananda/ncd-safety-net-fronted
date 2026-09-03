import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../lib/firebase";
import { callApi } from "../lib/api";
import Layout from "../components/Layout";
import RiskBadge from "../components/RiskBadge";
import ClinicalAIAssistant from "../components/ClinicalAIAssistant";

export default function ClinicalReview() {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState("");
  const [patientNames, setPatientNames] = useState({});
  const [overrideApplied, setOverrideApplied] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    // Ambil assessment RED_FLAG/HIGH yang belum ada clinical_reviews terkait.
    // Pendekatan sederhana untuk versi awal: tampilkan semua RED_FLAG/HIGH
    // terbaru; dokter memilih mana yang memang belum direview.
    const [snap, patientsSnap] = await Promise.all([
      getDocs(query(collection(db, "risk_assessments"), orderBy("createdAt", "desc"))),
      getDocs(collection(db, "patients")),
    ]);
    const names = {};
    patientsSnap.docs.forEach((d) => { names[d.id] = d.data().name || d.id; });
    setPatientNames(names);
    const rows = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((r) => (r.riskStatus === "RED_FLAG" || r.riskStatus === "HIGH") && !r.reviewed)
      .slice(0, 30);
    setPending(rows);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const openReview = (item) => {
    setSelected(item);
    setNotes("");
    setOverrideApplied(false);
    setOverrideReason("");
    setError("");
  };

  const submitReview = async () => {
    if (overrideApplied && !overrideReason) {
      setError("Alasan override wajib diisi.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await callApi("clinicalReview", {
        assessmentId: selected.id,
        decisionNotes: notes,
        overrideApplied,
        overrideReason: overrideApplied ? overrideReason : null,
      });
      setSelected(null);
      await load();
    } catch (e) {
      setError(e.message || "Gagal menyimpan review.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout title="Clinical Review" meta="Pasien Red Flag / High Risk yang menunggu penilaian dokter">
      <div className="grid cols-2">
        <div className="card">
          <h3>Daftar Menunggu Review</h3>
          {loading ? (
            <div className="stat-sub">Memuat...</div>
          ) : pending.length === 0 ? (
            <div className="stat-sub">Tidak ada pasien Red Flag/High Risk saat ini.</div>
          ) : (
            <table>
              <tbody>
                {pending.map((r) => (
                  <tr key={r.id} className={r.riskStatus === "RED_FLAG" ? "row-redflag" : ""} style={{ cursor: "pointer" }} onClick={() => openReview(r)}>
                    <td>{patientNames[r.patientId] || r.patientId}</td>
                    <td>
                      <RiskBadge status={r.riskStatus} />
                    </td>
                    <td>
                      <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }}>
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h3>Form Clinical Review</h3>
          {!selected ? (
            <div className="stat-sub">Pilih pasien dari daftar di sebelah kiri.</div>
          ) : (
            <div>
              <div style={{ marginBottom: 10 }}>
                Pasien: <span className="mono">{selected.patientId}</span> — <RiskBadge status={selected.riskStatus} />
              </div>
              <div className="field">
                <label>Catatan keputusan klinis</label>
                <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <label className="check-item" style={{ marginBottom: 10 }}>
                <input type="checkbox" checked={overrideApplied} onChange={(e) => setOverrideApplied(e.target.checked)} />
                Override status risiko
              </label>
              {overrideApplied && (
                <div className="field">
                  <label>Alasan override (wajib)</label>
                  <textarea rows={2} value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
                </div>
              )}
              {error && <div className="error-text">{error}</div>}
              <button className="btn btn-primary" onClick={submitReview} disabled={busy}>
                {busy ? "Menyimpan..." : "Simpan Review"}
              </button>
            </div>
          )}
        </div>
      </div>

      {selected && <ClinicalAIAssistant assessmentId={selected.id} patientId={selected.patientId} />}
    </Layout>
  );
}
