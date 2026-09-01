import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { callApi } from "../lib/api";
import Layout from "../components/Layout";
import RiskBadge from "../components/RiskBadge";

const EDU_TOPICS = ["Hipertensi", "Diabetes Mellitus", "Umum"];
const UNDERSTANDING_OPTIONS = [
  ["full", "Paham penuh"],
  ["partial", "Paham sebagian"],
  ["inadequate", "Tidak adekuat"],
];

const RED_FLAG_ITEMS = [
  ["chestPain", "Nyeri dada"],
  ["severeShortness", "Sesak berat"],
  ["lossOfConsciousness", "Penurunan kesadaran"],
  ["suddenWeakness", "Kelemahan anggota gerak mendadak"],
  ["suddenSpeechDifficulty", "Gangguan bicara mendadak"],
  ["seizure", "Kejang"],
  ["hypoglycemiaSigns", "Tanda hipoglikemia"],
  ["otherAcuteComplaint", "Keluhan akut lainnya"],
];

const NCD_ITEMS = ["Hipertensi", "Diabetes Mellitus", "Dislipidemia", "Obesitas", "Penyakit jantung", "Stroke", "CKD"];

export default function Screening() {
  const [params] = useSearchParams();
  const patientId = params.get("patientId") || "";

  const [ncdConditions, setNcdConditions] = useState([]);
  const [redFlags, setRedFlags] = useState({});
  const [medications, setMedications] = useState([{ name: "", dose: "", frequency: "", source: "rutin", knownByPatient: true }]);
  const [step, setStep] = useState("screening"); // screening -> medication -> result
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // --- state untuk Education & Safety Plan (langkah setelah hasil risk score) ---
  const [eduTopic, setEduTopic] = useState(EDU_TOPICS[0]);
  const [eduUnderstanding, setEduUnderstanding] = useState("full");
  const [eduDone, setEduDone] = useState(false);
  const [safetyPlan, setSafetyPlan] = useState({ problemsIdentified: "", actionsTaken: "", targetFollowUpDate: "" });
  const [planDone, setPlanDone] = useState(false);

  const hasRedFlag = Object.values(redFlags).some(Boolean);

  const toggleNcd = (item) => {
    setNcdConditions((prev) => (prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]));
  };
  const toggleRedFlag = (key) => setRedFlags((prev) => ({ ...prev, [key]: !prev[key] }));

  const submitScreeningStep = async () => {
    setBusy(true);
    setError("");
    try {
      // visitId idealnya dibuat dulu lewat alur kunjungan; untuk contoh ini
      // dianggap sudah ada dan dikirim sederhana berdasar patientId+tanggal.
      const visitId = `${patientId}-${new Date().toISOString().slice(0, 10)}`;
      const res = await callApi("screening", { visitId, patientId, ncdConditions, redFlags });
      setResult(res.data);
      if (res.data.status === "RED_FLAG") {
        setStep("result");
      } else {
        setStep("medication");
      }
    } catch (e) {
      setError(e.message || "Gagal mengirim screening.");
    } finally {
      setBusy(false);
    }
  };

  const submitMedicationStep = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await callApi("medication", { screeningId: result.screeningId, medications });
      setResult((prev) => ({ ...prev, ...res.data }));
      setStep("result");
    } catch (e) {
      setError(e.message || "Gagal mengirim data obat.");
    } finally {
      setBusy(false);
    }
  };

  const submitEducation = async () => {
    setBusy(true);
    setError("");
    try {
      await callApi("education", {
        screeningId: result.screeningId,
        topic: eduTopic,
        patientUnderstanding: eduUnderstanding,
      });
      setEduDone(true);
    } catch (e) {
      setError(e.message || "Gagal menyimpan edukasi.");
    } finally {
      setBusy(false);
    }
  };

  const submitSafetyPlan = async () => {
    setBusy(true);
    setError("");
    try {
      const riskStatus = result.status || result.riskResult?.riskStatus;
      await callApi("safetyPlan", {
        action: "create",
        assessmentId: result.riskResult?.assessmentId,
        riskStatus,
        problemsIdentified: safetyPlan.problemsIdentified,
        actionsTaken: safetyPlan.actionsTaken,
        targetFollowUpDate: safetyPlan.targetFollowUpDate,
      });
      setPlanDone(true);
    } catch (e) {
      setError(e.message || "Gagal menyimpan safety plan.");
    } finally {
      setBusy(false);
    }
  };

  const addMedRow = () =>
    setMedications((prev) => [...prev, { name: "", dose: "", frequency: "", source: "rutin", knownByPatient: true }]);
  const updateMedRow = (i, field, value) =>
    setMedications((prev) => prev.map((m, idx) => (idx === i ? { ...m, [field]: value } : m)));

  return (
    <Layout title="NCD Screening" meta={patientId ? `Pasien: ${patientId}` : "Pilih pasien dari Daftar Pasien"}>
      {step === "screening" && (
        <div className="card">
          <div className="field">
            <label>Kondisi NCD diketahui</label>
            <div className="checklist">
              {NCD_ITEMS.map((item) => (
                <label key={item} className="check-item">
                  <input type="checkbox" checked={ncdConditions.includes(item)} onChange={() => toggleNcd(item)} />
                  {item}
                </label>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Red Flag Check</label>
            <div className="checklist">
              {RED_FLAG_ITEMS.map(([key, label]) => (
                <label key={key} className="check-item danger-zone">
                  <input type="checkbox" checked={!!redFlags[key]} onChange={() => toggleRedFlag(key)} />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {hasRedFlag && (
            <div className="alert redflag">
              <span>🚨</span>
              <div>
                <strong>RED FLAG TERDETEKSI</strong>
                Pasien memerlukan penilaian klinis segera sesuai SOP fasilitas pelayanan kesehatan.
              </div>
            </div>
          )}

          {error && <div className="error-text">{error}</div>}

          <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
            <button className="btn btn-primary" onClick={submitScreeningStep} disabled={busy || !patientId}>
              {busy ? "Menyimpan..." : "Simpan & Lanjut"}
            </button>
          </div>
          {!patientId && <div className="stat-sub" style={{ marginTop: 8 }}>Buka halaman ini dari Daftar Pasien agar patientId terisi.</div>}
        </div>
      )}

      {step === "medication" && (
        <div className="card">
          <h3>Medication Reconciliation</h3>
          {medications.map((m, i) => (
            <div key={i} className="grid cols-3" style={{ marginBottom: 8 }}>
              <input placeholder="Nama obat" value={m.name} onChange={(e) => updateMedRow(i, "name", e.target.value)} />
              <input placeholder="Dosis" value={m.dose} onChange={(e) => updateMedRow(i, "dose", e.target.value)} />
              <input placeholder="Frekuensi" value={m.frequency} onChange={(e) => updateMedRow(i, "frequency", e.target.value)} />
            </div>
          ))}
          <button className="btn btn-ghost" onClick={addMedRow} style={{ marginBottom: 16 }}>
            + Tambah Obat
          </button>
          {error && <div className="error-text">{error}</div>}
          <div>
            <button className="btn btn-primary" onClick={submitMedicationStep} disabled={busy}>
              {busy ? "Menghitung..." : "Simpan & Hitung Risiko"}
            </button>
          </div>
        </div>
      )}

      {step === "result" && result && (
        <div>
          {(() => {
            const status = result.status || result.riskResult?.riskStatus;
            return (
              <div className="grid cols-2">
                <div className="card" style={{ textAlign: "center" }}>
                  <div className="stat-label">Status Risiko</div>
                  <div style={{ margin: "14px 0" }}>
                    <RiskBadge status={status} />
                  </div>
                  {status === "RED_FLAG" && (
                    <div className="stat-sub">
                      Menunggu Clinical Review oleh dokter — lihat halaman <strong>Clinical Review</strong>.
                    </div>
                  )}
                </div>
                <div className="card">
                  <h3>Rincian Skor</h3>
                  {result.riskResult?.domainScores ? (
                    <div>
                      {Object.entries(result.riskResult.domainScores).map(([k, v]) => (
                        <div key={k} className="score-row">
                          <span>{k}</span>
                          <span className="mono">{v}</span>
                        </div>
                      ))}
                      <div className="score-total">
                        <span>Total</span>
                        <span className="mono">{result.riskResult.totalScore}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="stat-sub">Tidak ada rincian skor (jalur Red Flag melewati skor).</div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Education — untuk semua status kecuali sudah selesai */}
          {!eduDone && (result.status || result.riskResult?.riskStatus) !== "RED_FLAG" && (
            <div className="card" style={{ marginTop: 16 }}>
              <h3>Edukasi Pasien</h3>
              <div className="grid cols-2">
                <div className="field">
                  <label>Topik</label>
                  <select value={eduTopic} onChange={(e) => setEduTopic(e.target.value)}>
                    {EDU_TOPICS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Pemahaman pasien</label>
                  <select value={eduUnderstanding} onChange={(e) => setEduUnderstanding(e.target.value)}>
                    {UNDERSTANDING_OPTIONS.map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button className="btn btn-primary" onClick={submitEducation} disabled={busy}>
                {busy ? "Menyimpan..." : "Simpan Edukasi"}
              </button>
            </div>
          )}
          {eduDone && (
            <div className="alert warn" style={{ marginTop: 16 }}>
              <span>✅</span>
              <div>Edukasi sudah tercatat.</div>
            </div>
          )}

          {/* Safety Plan — hanya untuk MODERATE/HIGH */}
          {["MODERATE", "HIGH"].includes(result.status || result.riskResult?.riskStatus) && !planDone && (
            <div className="card" style={{ marginTop: 16 }}>
              <h3>Safety Plan &amp; Follow-up</h3>
              <div className="field">
                <label>Masalah keselamatan ditemukan</label>
                <textarea
                  rows={2}
                  value={safetyPlan.problemsIdentified}
                  onChange={(e) => setSafetyPlan((p) => ({ ...p, problemsIdentified: e.target.value }))}
                />
              </div>
              <div className="field">
                <label>Tindakan dilakukan</label>
                <textarea
                  rows={2}
                  value={safetyPlan.actionsTaken}
                  onChange={(e) => setSafetyPlan((p) => ({ ...p, actionsTaken: e.target.value }))}
                />
              </div>
              <div className="field">
                <label>
                  Target follow-up {result.status === "HIGH" || result.riskResult?.riskStatus === "HIGH" ? "(wajib)" : ""}
                </label>
                <input
                  type="date"
                  value={safetyPlan.targetFollowUpDate}
                  onChange={(e) => setSafetyPlan((p) => ({ ...p, targetFollowUpDate: e.target.value }))}
                />
              </div>
              {error && <div className="error-text">{error}</div>}
              <button className="btn btn-primary" onClick={submitSafetyPlan} disabled={busy}>
                {busy ? "Menyimpan..." : "Simpan Safety Plan"}
              </button>
            </div>
          )}
          {planDone && (
            <div className="alert warn" style={{ marginTop: 16 }}>
              <span>✅</span>
              <div>Safety plan &amp; follow-up sudah tercatat.</div>
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
