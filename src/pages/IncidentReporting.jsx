import { useState } from "react";
import { callApi } from "../lib/api";
import Layout from "../components/Layout";

const JENIS_INSIDEN_OPTIONS = [
  ["KPC", "KPC - Kondisi Potensial Cedera"],
  ["KNC", "KNC - Kejadian Nyaris Cedera"],
  ["KTC", "KTC - Kejadian Tidak Cedera"],
  ["KTD", "KTD - Kejadian Tidak Diharapkan"],
  ["SENTINEL", "Kejadian Sentinel"],
];

const CATEGORIES = [
  ["medication_error", "Kesalahan Obat"],
  ["hypoglycemia", "Hipoglikemia"],
  ["hyperglycemia_dka", "Hiperglikemia Berat / KAD"],
  ["hypertensive_crisis", "Krisis Hipertensi"],
  ["monitoring_failure", "Kegagalan Monitoring"],
  ["delayed_recognition", "Keterlambatan Deteksi"],
  ["lost_to_followup", "Pasien Hilang dari Follow-up"],
  ["chronic_complication", "Komplikasi Kronis"],
  ["communication_failure", "Kegagalan Komunikasi"],
  ["identification_issue", "Kesalahan Identifikasi Pasien"],
  ["documentation_issue", "Masalah Dokumentasi"],
  ["other", "Lainnya"],
];

export default function IncidentReporting() {
  const [category, setCategory] = useState(CATEGORIES[0][0]);
  const [jenisInsiden, setJenisInsiden] = useState(JENIS_INSIDEN_OPTIONS[0][0]);
  const [patientId, setPatientId] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!description) {
      setError("Deskripsi kejadian wajib diisi.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await callApi("incident", { category, jenisInsiden, patientId: patientId || null, description });
      setDone(true);
      setDescription("");
      setPatientId("");
    } catch (e) {
      setError(e.message || "Gagal mengirim laporan.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout title="Incident Reporting" meta="Pencatatan kejadian terkait keselamatan pasien NCD">
      <div className="card" style={{ maxWidth: 520 }}>
        <div className="field">
          <label>Jenis Insiden</label>
          <select value={jenisInsiden} onChange={(e) => setJenisInsiden(e.target.value)}>
            {JENIS_INSIDEN_OPTIONS.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Kategori</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Pasien terkait (opsional — No. RM / ID)</label>
          <input value={patientId} onChange={(e) => setPatientId(e.target.value)} />
        </div>
        <div className="field">
          <label>Deskripsi kejadian</label>
          <textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="alert warn">
          <span>ℹ️</span>
          <div>Ini bukan kesimpulan medical error — hanya pencatatan untuk direview lewat mekanisme keselamatan pasien rumah sakit.</div>
        </div>

        {error && <div className="error-text">{error}</div>}
        {done && <div className="stat-sub" style={{ margin: "10px 0", color: "var(--low)" }}>Laporan tersimpan.</div>}

        <button className="btn btn-primary" onClick={submit} disabled={busy} style={{ marginTop: 14 }}>
          {busy ? "Mengirim..." : "Kirim Laporan"}
        </button>
      </div>
    </Layout>
  );
}
