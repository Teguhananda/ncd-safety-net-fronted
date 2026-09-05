import { useState } from "react";
import { callApi } from "../lib/api";

const PARAM_OPTIONS = ["systolicBP", "bloodGlucose"];
const PARAM_LABEL = { systolicBP: "Tekanan Darah", bloodGlucose: "Gula Darah" };

/**
 * PersonalSafetyPlanModal.jsx — form ringkas staff membuat Personal
 * Safety Plan (bagian D spesifikasi bidirectional monitoring). Sengaja
 * ringkas (bukan halaman penuh) supaya bisa langsung dipakai dari
 * Daftar Pasien tanpa menambah 1 halaman/route baru lagi.
 */
export default function PersonalSafetyPlanModal({ patient, onClose }) {
  const [form, setForm] = useState({
    diagnosis: (patient.conditions || []).join(", "),
    monitoringParameters: [],
    monitoringFrequency: "Setiap hari",
    medicationPlan: "",
    followUpDate: "",
    warningSigns: "",
    escalationInstruction: "Segera hubungi IGD RSUD Kab. Rejang Lebong jika tanda bahaya muncul.",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const toggleParam = (p) => {
    setForm((f) => ({
      ...f,
      monitoringParameters: f.monitoringParameters.includes(p)
        ? f.monitoringParameters.filter((x) => x !== p)
        : [...f.monitoringParameters, p],
    }));
  };

  const handleSave = async () => {
    if (form.monitoringParameters.length === 0) {
      setError("Pilih minimal 1 parameter yang dipantau.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await callApi("safetyPlan", { action: "createPersonalPlan", patientId: patient.id, ...form });
      setDone(true);
    } catch (err) {
      setError(err.message || "Gagal menyimpan safety plan.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(23,38,43,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div className="card" style={{ width: 420, maxHeight: "85vh", overflowY: "auto" }}>
        <h3 style={{ marginBottom: 10 }}>Personal Safety Plan — {patient.name}</h3>

        {done ? (
          <>
            <p>Safety plan berhasil dibuat & aktif. Pasien sudah bisa melihatnya di My NCD Safety.</p>
            <button className="btn btn-primary" style={{ width: "100%" }} onClick={onClose}>Tutup</button>
          </>
        ) : (
          <>
            <div className="field">
              <label>Diagnosis</label>
              <input value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} />
            </div>
            <div className="field">
              <label>Parameter yang Dipantau di Rumah</label>
              <div style={{ display: "flex", gap: 10 }}>
                {PARAM_OPTIONS.map((p) => (
                  <label key={p} style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
                    <input type="checkbox" checked={form.monitoringParameters.includes(p)} onChange={() => toggleParam(p)} />
                    {PARAM_LABEL[p]}
                  </label>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Frekuensi Monitoring</label>
              <select value={form.monitoringFrequency} onChange={(e) => setForm({ ...form, monitoringFrequency: e.target.value })}>
                <option>Setiap hari</option>
                <option>2 hari sekali</option>
                <option>Seminggu sekali</option>
              </select>
            </div>
            <div className="field">
              <label>Rencana Obat</label>
              <textarea rows={2} value={form.medicationPlan} onChange={(e) => setForm({ ...form, medicationPlan: e.target.value })} />
            </div>
            <div className="field">
              <label>Tanggal Follow-Up</label>
              <input type="date" value={form.followUpDate} onChange={(e) => setForm({ ...form, followUpDate: e.target.value })} />
            </div>
            <div className="field">
              <label>Tanda Bahaya (untuk pasien)</label>
              <textarea rows={2} value={form.warningSigns} onChange={(e) => setForm({ ...form, warningSigns: e.target.value })} />
            </div>
            <div className="field">
              <label>Instruksi Eskalasi</label>
              <textarea rows={2} value={form.escalationInstruction} onChange={(e) => setForm({ ...form, escalationInstruction: e.target.value })} />
            </div>
            {error && <div className="error-text">{error}</div>}
            <button className="btn btn-primary" style={{ width: "100%", marginTop: 8 }} disabled={saving} onClick={handleSave}>
              {saving ? "Menyimpan..." : "Simpan & Aktifkan Safety Plan"}
            </button>
            <button className="btn btn-ghost" style={{ width: "100%", marginTop: 6 }} onClick={onClose}>Batal</button>
          </>
        )}
      </div>
    </div>
  );
}
