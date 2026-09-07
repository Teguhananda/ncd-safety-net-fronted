import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { callApi } from "../lib/api";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import RiskBadge from "../components/RiskBadge";

const EDU_TOPICS = ["Hipertensi", "Diabetes Mellitus", "Umum"];
const UNDERSTANDING_OPTIONS = [
  ["full", "Paham penuh"],
  ["partial", "Paham sebagian"],
  ["inadequate", "Tidak adekuat"],
];

// Label bahasa manusia untuk tiap domain skor — dipakai untuk auto-isi
// "Masalah keselamatan ditemukan" berdasarkan domain yang nilainya 1
// (bermasalah), supaya petugas tidak mulai dari kotak kosong dan tidak
// mungkin lupa/lewat mencatat domain yang sebenarnya bermasalah. Tetap
// bisa diedit manual — sistem hanya menyarankan, keputusan klinis tetap
// di tangan dokter/perawat.
const DOMAIN_LABEL = {
  clinicalRisk: "risiko klinis",
  medicationSafety: "masalah keamanan pengobatan",
  followUpRisk: "risiko kepatuhan follow-up",
  educationRisk: "pemahaman pasien tentang kondisinya masih kurang",
  previousSafetyEvent: "riwayat insiden keselamatan sebelumnya",
  accessBarrier: "hambatan akses ke layanan kesehatan",
};

function buildProblemsIdentifiedSuggestion(domainScores) {
  if (!domainScores) return "";
  const problems = Object.entries(domainScores)
    .filter(([, v]) => v === 1)
    .map(([k]) => DOMAIN_LABEL[k] || k);
  if (problems.length === 0) return "";
  return "Ditemukan " + problems.join(", ") + ".";
}

const RED_FLAG_ITEMS = [
  ["chestPain", "Nyeri dada khas ACS (tertekan/terhimpit di dada kiri-tengah, menjalar ke lengan kiri/rahang/punggung, disertai keringat dingin/mual, berlangsung >20 menit)"],
  ["severeShortness", "Sesak berat (curiga edema paru akut — komplikasi krisis hipertensi yang butuh nitrogliserin + diuretik segera)"],
  ["lossOfConsciousness", "Penurunan kesadaran (curiga ensefalopati hipertensi: somnolen, letargi, hingga koma)"],
  ["suddenWeakness", "Kelemahan/mati rasa mendadak satu sisi tubuh (wajah, lengan, dan/atau tungkai) — bukan bertahap"],
  ["suddenSpeechDifficulty", "Gangguan bicara mendadak (pelo/tidak jelas, atau sulit memahami lawan bicara) — bukan bertahap"],
  ["seizure", "Kejang (curiga ensefalopati hipertensi — sering menyertai penurunan kesadaran mendadak)"],
  ["hypoglycemiaSigns", "Tanda hipoglikemia (adrenergik: gemetar, berdebar, berkeringat dingin, rasa lapar hebat, cemas — dan/atau neuroglikopenik: bingung, sulit bicara, pandangan kabur, lemas, kejang, penurunan kesadaran)"],
  ["otherAcuteComplaint", "Keluhan akut lainnya"],
];

// Kelemahan anggota gerak & gangguan bicara mendadak adalah dua gejala inti
// FAST (Face-Arm-Speech-Time) untuk stroke — keputusan jalur trombolisis
// sangat bergantung pada "sejak kapan" gejala muncul ("time is brain"),
// jadi keduanya butuh input onset waktu, bukan cuma centang ya/tidak.
const ONSET_ITEMS = new Set(["suddenWeakness", "suddenSpeechDifficulty"]);
const ONSET_OPTIONS = [
  ["<3h", "< 3 jam yang lalu (jendela trombolisis penuh)"],
  ["3-4.5h", "3 - 4.5 jam yang lalu (jendela trombolisis diperluas)"],
  ["4.5-24h", "4.5 - 24 jam yang lalu"],
  [">24h", "> 24 jam yang lalu"],
  ["unknown", "Tidak diketahui / saat bangun tidur"],
];

// Cutoff sesuai standar internasional AHA/ASA yang dikonfirmasi dokter
// internis: jendela trombolisis (tPA) = 4,5 jam sejak onset/terakhir
// terlihat normal. Dipakai untuk banner urgensi otomatis di halaman
// hasil, supaya dokter tidak perlu menghitung sendiri dari jam onset.
const ONSET_URGENCY = {
  "<3h": { urgent: true, text: "MASIH DALAM JENDELA TROMBOLISIS PENUH (<3 jam) — segera rujuk ke fasilitas dengan layanan trombolisis/stroke unit." },
  "3-4.5h": { urgent: true, text: "MASIH DALAM JENDELA TROMBOLISIS DIPERLUAS (3-4,5 jam) — segera rujuk, waktu sangat terbatas." },
  "4.5-24h": { urgent: false, text: "Sudah lewat jendela trombolisis (>4,5 jam) — tetap red flag, evaluasi kelayakan trombektomi mekanik (bisa s.d. 24 jam pada kasus terpilih) & tata laksana suportif." },
  ">24h": { urgent: false, text: "Onset >24 jam — sudah di luar jendela intervensi akut standar, tetap perlu evaluasi neurologi & pencegahan sekunder." },
  unknown: { urgent: true, text: "Onset tidak diketahui/saat bangun tidur — perlakukan seperti dalam jendela trombolisis sampai dipastikan sebaliknya (perlu MRI DWI/FLAIR mismatch bila tersedia)." },
};

const NCD_ITEMS = ["Hipertensi", "Diabetes Mellitus", "Dislipidemia", "Obesitas", "Penyakit jantung", "Stroke", "CKD"];

const ACCESS_BARRIER_ITEMS = [
  ["farDistance", "Jarak rumah jauh dari fasilitas kesehatan (>10 km)"],
  ["noTransport", "Tidak ada transportasi memadai"],
  ["costBarrier", "Kendala biaya berobat"],
  ["noCaregiver", "Tidak ada pendamping/keluarga pendukung"],
];

export default function Screening() {
  const [params] = useSearchParams();
  const patientId = params.get("patientId") || "";

  const [ncdConditions, setNcdConditions] = useState([]);
  const [vitalSigns, setVitalSigns] = useState({
    systolicBP: "", diastolicBP: "", pulse: "", temperature: "", spo2: "", respiratoryRate: "",
    glucoseValue: "", glucoseType: "GDS",
  });
  const [redFlags, setRedFlags] = useState({});
  const [redFlagOnset, setRedFlagOnset] = useState({});
  const [accessBarriers, setAccessBarriers] = useState({});
  // BAGIAN BARU: pemeriksaan tambahan gold standard HT/DM (IMT/lingkar
  // perut, kaki diabetik, hasil lab dasar) — semua opsional.
  const [anthropometry, setAnthropometry] = useState({ heightCm: "", weightKg: "", waistCircumferenceCm: "" });
  const [diabeticFootExam, setDiabeticFootExam] = useState({ monofilamentSensation: "", dorsalisPedisPulse: "", footWound: false, notes: "" });
  const [labResults, setLabResults] = useState({
    totalCholesterol: "", ldl: "", hdl: "", triglycerides: "", creatinine: "", sodium: "", potassium: "", uricAcid: "", ecgFinding: "",
  });
  const [visitDate, setVisitDate] = useState(new Date().toISOString().slice(0, 10));
  const [pastScreenings, setPastScreenings] = useState([]);
  const [selectedPastDate, setSelectedPastDate] = useState("");
  const [historyItems, setHistoryItems] = useState([]);
  const [medications, setMedications] = useState([{ name: "", dose: "", frequency: "", source: "rutin", knownByPatient: true, slots: [] }]);
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

  // Auto-isi "Masalah keselamatan ditemukan" berdasarkan Rincian Skor
  // begitu hasil risiko keluar — supaya petugas tidak mulai dari kotak
  // kosong dan tidak lewat mencatat domain yang sebenarnya bermasalah.
  // Hanya mengisi kalau field masih kosong (tidak menimpa kalau petugas
  // sudah mulai mengetik/mengedit sendiri) — tetap bisa diubah manual.
  useEffect(() => {
    const domainScores = result?.riskResult?.domainScores;
    if (domainScores && !safetyPlan.problemsIdentified) {
      const suggestion = buildProblemsIdentifiedSuggestion(domainScores);
      if (suggestion) {
        setSafetyPlan((p) => (p.problemsIdentified ? p : { ...p, problemsIdentified: suggestion }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  useEffect(() => {
    if (!patientId) return;
    (async () => {
      try {
        const res = await callApi("patientHistory", { patientId });
        const dates = (res.data.timeline || [])
          .filter((item) => item.type === "screening")
          .map((item) => item.date)
          .filter(Boolean);
        setPastScreenings(dates);
        setHistoryItems(res.data.timeline || []);
      } catch (e) {
        console.error("Gagal memuat riwayat tanggal screening:", e);
      }
    })();
  }, [patientId]);

  const hasRedFlag = Object.values(redFlags).some(Boolean);

  const selectedDayItems = selectedPastDate
    ? historyItems.filter((item) => item.date && item.date.slice(0, 10) === selectedPastDate.slice(0, 10))
    : [];

  const toggleNcd = (item) => {
    setNcdConditions((prev) => (prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]));
  };
  const toggleRedFlag = (key) => setRedFlags((prev) => ({ ...prev, [key]: !prev[key] }));
  const updateOnset = (key, value) => setRedFlagOnset((prev) => ({ ...prev, [key]: value }));
  const updateVitalSign = (field, value) => setVitalSigns((prev) => ({ ...prev, [field]: value }));
  const toggleAccessBarrier = (key) => setAccessBarriers((prev) => ({ ...prev, [key]: !prev[key] }));

  const submitScreeningStep = async () => {
    setBusy(true);
    setError("");
    try {
      // visitId idealnya dibuat dulu lewat alur kunjungan; untuk contoh ini
      // dianggap sudah ada dan dikirim sederhana berdasar patientId+tanggal.
      const visitId = `${patientId}-${new Date().toISOString().replace(/[:.]/g, "-")}`;
      const res = await callApi("screening", {
        visitId,
        patientId,
        ncdConditions,
        redFlags,
        redFlagOnset,
        accessBarriers,
        visitDate,
        anthropometry: {
          heightCm: anthropometry.heightCm === "" ? null : Number(anthropometry.heightCm),
          weightKg: anthropometry.weightKg === "" ? null : Number(anthropometry.weightKg),
          waistCircumferenceCm: anthropometry.waistCircumferenceCm === "" ? null : Number(anthropometry.waistCircumferenceCm),
        },
        diabeticFootExam: ncdConditions.includes("Diabetes Mellitus") ? diabeticFootExam : null,
        labResults: {
          totalCholesterol: labResults.totalCholesterol === "" ? null : Number(labResults.totalCholesterol),
          ldl: labResults.ldl === "" ? null : Number(labResults.ldl),
          hdl: labResults.hdl === "" ? null : Number(labResults.hdl),
          triglycerides: labResults.triglycerides === "" ? null : Number(labResults.triglycerides),
          creatinine: labResults.creatinine === "" ? null : Number(labResults.creatinine),
          sodium: labResults.sodium === "" ? null : Number(labResults.sodium),
          potassium: labResults.potassium === "" ? null : Number(labResults.potassium),
          uricAcid: labResults.uricAcid === "" ? null : Number(labResults.uricAcid),
          ecgFinding: labResults.ecgFinding || null,
        },
        vitalSigns: {
          systolicBP: vitalSigns.systolicBP === "" ? null : Number(vitalSigns.systolicBP),
          diastolicBP: vitalSigns.diastolicBP === "" ? null : Number(vitalSigns.diastolicBP),
          pulse: vitalSigns.pulse === "" ? null : Number(vitalSigns.pulse),
          temperature: vitalSigns.temperature === "" ? null : Number(vitalSigns.temperature),
          spo2: vitalSigns.spo2 === "" ? null : Number(vitalSigns.spo2),
          respiratoryRate: vitalSigns.respiratoryRate === "" ? null : Number(vitalSigns.respiratoryRate),
          glucoseValue: vitalSigns.glucoseValue === "" ? null : Number(vitalSigns.glucoseValue),
          glucoseType: vitalSigns.glucoseType,
        },
      });
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
      // patientId WAJIB dikirim sekarang (update backend medication.js) —
      // dipakai cron pengingat obat untuk tahu push notif ini milik pasien mana.
      const res = await callApi("medication", { screeningId: result.screeningId, patientId, medications });
      setResult((prev) => ({
        ...prev,
        ...res.data,
        status: res.data.riskResult?.riskStatus || prev.status,
      }));
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
    setMedications((prev) => [...prev, { name: "", dose: "", frequency: "", source: "rutin", knownByPatient: true, slots: [] }]);
  const updateMedRow = (i, field, value) =>
    setMedications((prev) => prev.map((m, idx) => (idx === i ? { ...m, [field]: value } : m)));
  const removeMedRow = (i) =>
    setMedications((prev) => prev.filter((_, idx) => idx !== i));
  // toggleMedSlot — centang/hilangkan slot pengingat (pagi/siang/malam) untuk
  // satu baris obat. Dipakai cron di backend (api/scheduled.js) untuk tahu
  // jam berapa obat ini harus diingatkan ke pasien lewat push notifikasi.
  // Boleh dikosongkan semua kalau obat "jika perlu" (PRN) — tidak diingatkan.
  const toggleMedSlot = (i, slot) =>
    setMedications((prev) =>
      prev.map((m, idx) => {
        if (idx !== i) return m;
        const current = m.slots || [];
        const next = current.includes(slot) ? current.filter((s) => s !== slot) : [...current, slot];
        return { ...m, slots: next };
      })
    );

  return (
    <Layout title="NCD Screening" meta={patientId ? `Pasien: ${patientId}` : "Pilih pasien dari Daftar Pasien"}>
      {step === "screening" && (
        <div className="card">
          <div className="field">
            <label>Tanggal Screening</label>
            <input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
          </div>

          {pastScreenings.length > 0 && (
            <div className="field">
              <label>Riwayat Tanggal Screening Pasien Ini</label>
              <select
                value={selectedPastDate}
                onChange={(e) => setSelectedPastDate(e.target.value)}
              >
                <option value="">-- Pilih tanggal untuk lihat riwayat --</option>
                {pastScreenings.map((d, i) => (
                  <option key={i} value={d}>
                    {new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                  </option>
                ))}
              </select>
              {selectedPastDate && (
                <div className="stat-sub" style={{ marginTop: 6 }}>
                  {selectedDayItems.map((item, i) => (
                    <div key={i} style={{ marginTop: i > 0 ? 8 : 0, paddingTop: i > 0 ? 8 : 0, borderTop: i > 0 ? "1px solid rgba(255,255,255,0.08)" : "none" }}>
                      <strong>{item.summary}</strong>
                      {item.detail && item.detail.ncdConditions && item.detail.ncdConditions.length > 0 && (
                        <div>Kondisi NCD: {item.detail.ncdConditions.join(", ")}</div>
                      )}
                      {item.detail && item.detail.redFlags && item.detail.redFlags.length > 0 && (
                        <div style={{ color: "#ffd7cf" }}>Red Flag: {item.detail.redFlags.join(", ")}</div>
                      )}
                      {item.detail && item.detail.totalScore != null && (
                        <div>Skor risiko total: {item.detail.totalScore}</div>
                      )}
                      {item.detail && item.detail.domainScores && (
                        <div>Rincian skor: klinis {item.detail.domainScores.clinicalRisk}, obat {item.detail.domainScores.medicationSafety}, follow-up {item.detail.domainScores.followUpRisk}, edukasi {item.detail.domainScores.educationRisk}, insiden {item.detail.domainScores.previousSafetyEvent}, akses {item.detail.domainScores.accessBarrier}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="field">
            <label>Tekanan Darah (mmHg)</label>
            <div className="grid cols-2">
              <input
                type="number"
                placeholder="Sistolik"
                min="40"
                max="300"
                value={vitalSigns.systolicBP}
                onChange={(e) => updateVitalSign("systolicBP", e.target.value)}
              />
              <input
                type="number"
                placeholder="Diastolik"
                min="20"
                max="200"
                value={vitalSigns.diastolicBP}
                onChange={(e) => updateVitalSign("diastolicBP", e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label>Nadi (x/menit), Suhu (°C), SpO2 (%), Napas (x/menit)</label>
            <div className="grid cols-4">
              <input
                type="number"
                placeholder="Nadi"
                min="20"
                max="250"
                value={vitalSigns.pulse}
                onChange={(e) => updateVitalSign("pulse", e.target.value)}
              />
              <input
                type="number"
                step="0.1"
                placeholder="Suhu"
                min="30"
                max="42"
                value={vitalSigns.temperature}
                onChange={(e) => updateVitalSign("temperature", e.target.value)}
              />
              <input
                type="number"
                placeholder="SpO2"
                min="50"
                max="100"
                value={vitalSigns.spo2}
                onChange={(e) => updateVitalSign("spo2", e.target.value)}
              />
              <input
                type="number"
                placeholder="Napas"
                min="4"
                max="60"
                value={vitalSigns.respiratoryRate}
                onChange={(e) => updateVitalSign("respiratoryRate", e.target.value)}
              />
            </div>
            <div className="stat-sub" style={{ marginTop: 4 }}>
              Frekuensi napas: waspadai napas cepat/dalam (curiga edema paru akut atau
              ketoasidosis diabetik) maupun napas lambat (penurunan kesadaran berat).
            </div>
          </div>

          <div className="field">
            <label>Gula Darah</label>
            <div className="grid cols-2">
              <input
                type="number"
                placeholder="Nilai (mg/dL atau %)"
                min={vitalSigns.glucoseType === "HbA1c" ? "3" : "20"}
                max={vitalSigns.glucoseType === "HbA1c" ? "20" : "800"}
                value={vitalSigns.glucoseValue}
                onChange={(e) => updateVitalSign("glucoseValue", e.target.value)}
              />
              <select
                value={vitalSigns.glucoseType}
                onChange={(e) => updateVitalSign("glucoseType", e.target.value)}
              >
                <option value="GDS">GDS (Gula Darah Sewaktu)</option>
                <option value="GDP">GDP (Gula Darah Puasa)</option>
                <option value="HbA1c">HbA1c</option>
              </select>
            </div>
            <div className="stat-sub" style={{ marginTop: 4 }}>
              Kosongkan jika tidak diperiksa pada kunjungan ini.
            </div>
          </div>

          <div className="field">
            <label>Antropometri (IMT &amp; Lingkar Perut)</label>
            <div className="grid cols-2">
              <input type="number" placeholder="Tinggi badan (cm)" value={anthropometry.heightCm} onChange={(e) => setAnthropometry((a) => ({ ...a, heightCm: e.target.value }))} />
              <input type="number" placeholder="Berat badan (kg)" value={anthropometry.weightKg} onChange={(e) => setAnthropometry((a) => ({ ...a, weightKg: e.target.value }))} />
            </div>
            <input type="number" placeholder="Lingkar perut (cm)" style={{ marginTop: 8 }} value={anthropometry.waistCircumferenceCm} onChange={(e) => setAnthropometry((a) => ({ ...a, waistCircumferenceCm: e.target.value }))} />
            <div className="stat-sub" style={{ marginTop: 4 }}>
              IMT dihitung otomatis (cutoff Asia-Pacific/PERKENI). Kosongkan jika tidak diukur.
            </div>
          </div>

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

          {ncdConditions.includes("Diabetes Mellitus") && (
            <div className="field">
              <label>Pemeriksaan Kaki Diabetik</label>
              <div className="stat-sub" style={{ marginBottom: 6 }}>Skrining neuropati/kaki diabetik — standar PERKENI.</div>
              <div className="grid cols-2">
                <select value={diabeticFootExam.monofilamentSensation} onChange={(e) => setDiabeticFootExam((f) => ({ ...f, monofilamentSensation: e.target.value }))}>
                  <option value="">-- Sensasi monofilament --</option>
                  <option value="normal">Normal</option>
                  <option value="reduced">Berkurang</option>
                  <option value="absent">Tidak ada (mati rasa)</option>
                </select>
                <select value={diabeticFootExam.dorsalisPedisPulse} onChange={(e) => setDiabeticFootExam((f) => ({ ...f, dorsalisPedisPulse: e.target.value }))}>
                  <option value="">-- Pulsasi dorsalis pedis --</option>
                  <option value="palpable">Teraba</option>
                  <option value="weak">Lemah</option>
                  <option value="absent">Tidak teraba</option>
                </select>
              </div>
              <label className="check-item" style={{ marginTop: 8 }}>
                <input type="checkbox" checked={diabeticFootExam.footWound} onChange={(e) => setDiabeticFootExam((f) => ({ ...f, footWound: e.target.checked }))} />
                Ada luka/ulkus di kaki
              </label>
            </div>
          )}

          <div className="field">
            <label>Cek Red Flag</label>
            <div className="checklist">
              {RED_FLAG_ITEMS.map(([key, label]) => (
                <div key={key}>
                  <label className="check-item danger-zone">
                    <input type="checkbox" checked={!!redFlags[key]} onChange={() => toggleRedFlag(key)} />
                    {label}
                  </label>
                  {ONSET_ITEMS.has(key) && redFlags[key] && (
                    <div style={{ marginLeft: 24, marginTop: 4, marginBottom: 8 }}>
                      <label style={{ fontSize: 13 }}>Sejak kapan gejala ini muncul?</label>
                      <select value={redFlagOnset[key] || ""} onChange={(e) => updateOnset(key, e.target.value)}>
                        <option value="">-- Pilih onset --</option>
                        {ONSET_OPTIONS.map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Hambatan Akses Layanan</label>
            <div className="checklist">
              {ACCESS_BARRIER_ITEMS.map(([key, label]) => (
                <label key={key} className="check-item">
                  <input type="checkbox" checked={!!accessBarriers[key]} onChange={() => toggleAccessBarrier(key)} />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Hasil Laboratorium (opsional — isi kalau sudah ada hasil)</label>
            <div className="stat-sub" style={{ marginBottom: 6 }}>Profil lipid, fungsi ginjal, elektrolit, asam urat, EKG — sesuai gold standard tata laksana HT/DM.</div>
            <div className="grid cols-2">
              <input type="number" placeholder="Kolesterol Total (mg/dL)" value={labResults.totalCholesterol} onChange={(e) => setLabResults((l) => ({ ...l, totalCholesterol: e.target.value }))} />
              <input type="number" placeholder="LDL (mg/dL)" value={labResults.ldl} onChange={(e) => setLabResults((l) => ({ ...l, ldl: e.target.value }))} />
              <input type="number" placeholder="HDL (mg/dL)" value={labResults.hdl} onChange={(e) => setLabResults((l) => ({ ...l, hdl: e.target.value }))} />
              <input type="number" placeholder="Trigliserida (mg/dL)" value={labResults.triglycerides} onChange={(e) => setLabResults((l) => ({ ...l, triglycerides: e.target.value }))} />
              <input type="number" placeholder="Kreatinin (mg/dL)" value={labResults.creatinine} onChange={(e) => setLabResults((l) => ({ ...l, creatinine: e.target.value }))} />
              <input type="number" placeholder="Asam Urat (mg/dL)" value={labResults.uricAcid} onChange={(e) => setLabResults((l) => ({ ...l, uricAcid: e.target.value }))} />
              <input type="number" placeholder="Natrium (mEq/L)" value={labResults.sodium} onChange={(e) => setLabResults((l) => ({ ...l, sodium: e.target.value }))} />
              <input type="number" placeholder="Kalium (mEq/L)" value={labResults.potassium} onChange={(e) => setLabResults((l) => ({ ...l, potassium: e.target.value }))} />
            </div>
            <select style={{ marginTop: 8 }} value={labResults.ecgFinding} onChange={(e) => setLabResults((l) => ({ ...l, ecgFinding: e.target.value }))}>
              <option value="">-- Hasil EKG (kalau ada) --</option>
              <option value="Normal">Normal</option>
              <optgroup label="Irama">
                <option value="Sinus Bradikardia">Sinus Bradikardia</option>
                <option value="Sinus Takikardia">Sinus Takikardia</option>
                <option value="Fibrilasi Atrium (AF)">Fibrilasi Atrium (AF)</option>
                <option value="Flutter Atrium">Flutter Atrium</option>
                <option value="SVT (Takikardia Supraventrikular)">SVT (Takikardia Supraventrikular)</option>
                <option value="VES/PVC (Ekstrasistol Ventrikel)">VES/PVC (Ekstrasistol Ventrikel)</option>
                <option value="AES/PAC (Ekstrasistol Atrium)">AES/PAC (Ekstrasistol Atrium)</option>
                <option value="VT (Takikardia Ventrikel)">VT (Takikardia Ventrikel)</option>
              </optgroup>
              <optgroup label="Konduksi">
                <option value="AV Block Derajat 1">AV Block Derajat 1</option>
                <option value="AV Block Derajat 2">AV Block Derajat 2</option>
                <option value="AV Block Derajat 3 (Total)">AV Block Derajat 3 (Total)</option>
                <option value="RBBB">RBBB</option>
                <option value="LBBB">LBBB</option>
              </optgroup>
              <optgroup label="Hipertrofi / Pembesaran Ruang">
                <option value="LVH (Hipertrofi Ventrikel Kiri)">LVH (Hipertrofi Ventrikel Kiri)</option>
                <option value="RVH (Hipertrofi Ventrikel Kanan)">RVH (Hipertrofi Ventrikel Kanan)</option>
                <option value="LAE (Pembesaran Atrium Kiri)">LAE (Pembesaran Atrium Kiri)</option>
                <option value="RAE (Pembesaran Atrium Kanan)">RAE (Pembesaran Atrium Kanan)</option>
              </optgroup>
              <optgroup label="Iskemia / Infark">
                <option value="ST Elevasi">ST Elevasi</option>
                <option value="ST Depresi">ST Depresi</option>
                <option value="T Inverted">T Inverted</option>
                <option value="Old Infark (Q Patologis)">Old Infark (Q Patologis)</option>
              </optgroup>
              <optgroup label="Lainnya">
                <option value="Aksis Deviasi">Aksis Deviasi</option>
                <option value="Low Voltage">Low Voltage</option>
                <option value="Prolonged QT">Prolonged QT</option>
                <option value="Lainnya">Lainnya (sebutkan di catatan)</option>
              </optgroup>
            </select>
          </div>

          {hasRedFlag && (
            <div className="alert redflag">
              <span>🚨</span>
              <div>
                <strong style={{ display: "block", marginBottom: 4 }}>RED FLAG TERDETEKSI</strong>
                <span>Pasien memerlukan penilaian klinis segera sesuai SOP fasilitas pelayanan kesehatan.</span>
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
          <h3>Rekonsiliasi Obat</h3>
          {medications.map((m, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div className="grid cols-3" style={{ flex: 1 }}>
                  <input placeholder="Nama obat" value={m.name} onChange={(e) => updateMedRow(i, "name", e.target.value)} />
                  <input placeholder="Dosis" value={m.dose} onChange={(e) => updateMedRow(i, "dose", e.target.value)} />
                  <input placeholder="Frekuensi" value={m.frequency} onChange={(e) => updateMedRow(i, "frequency", e.target.value)} />
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: "6px 10px", fontSize: 12, color: "#c0392b" }}
                  onClick={() => removeMedRow(i)}
                  disabled={medications.length <= 1}
                  title={medications.length <= 1 ? "Minimal satu baris obat" : "Hapus baris ini"}
                >
                  🗑️ Hapus
                </button>
              </div>
              {/* Pengingat harian: pilih slot kapan pasien diingatkan minum obat
                  ini lewat push notifikasi. Kosongkan semua untuk obat "jika
                  perlu" (PRN) — tidak akan diingatkan otomatis. */}
              <div style={{ display: "flex", gap: 14, alignItems: "center", paddingLeft: 4 }}>
                <span className="stat-sub" style={{ fontSize: 12 }}>Ingatkan pasien:</span>
                {[
                  { key: "pagi", label: "Pagi (07:00)" },
                  { key: "siang", label: "Siang (12:00)" },
                  { key: "malam", label: "Malam (19:00)" },
                ].map((slotOpt) => (
                  <label key={slotOpt.key} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={(m.slots || []).includes(slotOpt.key)}
                      onChange={() => toggleMedSlot(i, slotOpt.key)}
                    />
                    {slotOpt.label}
                  </label>
                ))}
              </div>
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
            const cats = result.clinicalCategories;
            // Banner urgensi stroke otomatis — ambil onset TERAWAL di antara
            // suddenWeakness/suddenSpeechDifficulty yang dicentang (kalau
            // keduanya dicentang dengan onset berbeda, pakai yang paling
            // mendesak) supaya dokter langsung tahu masih dalam jendela
            // trombolisis 4,5 jam atau tidak, tanpa menghitung manual.
            const onsetEntries = Object.entries(result.redFlagOnset || {}).filter(([, v]) => v);
            const urgencyOrder = ["<3h", "3-4.5h", "unknown", "4.5-24h", ">24h"];
            const mostUrgentCode = onsetEntries
              .map(([, v]) => v)
              .sort((a, b) => urgencyOrder.indexOf(a) - urgencyOrder.indexOf(b))[0];
            const strokeUrgency = mostUrgentCode ? ONSET_URGENCY[mostUrgentCode] : null;
            return (
              <div className="grid cols-2">
                {strokeUrgency && (
                  <div
                    className="card"
                    style={{
                      gridColumn: "1 / -1",
                      background: strokeUrgency.urgent ? "rgba(230,85,63,0.15)" : "rgba(184,134,11,0.15)",
                      border: `1px solid ${strokeUrgency.urgent ? "var(--redflag, #e6553f)" : "#b8860b"}`,
                    }}
                  >
                    <b>{strokeUrgency.urgent ? "🔴" : "🟡"} Cutoff Onset Neurologis (standar AHA/ASA, 4,5 jam):</b>
                    <div style={{ marginTop: 4 }}>{strokeUrgency.text}</div>
                  </div>
                )}
                <div className="card" style={{ textAlign: "center" }}>
                  <div className="stat-label">Status Risiko</div>
                  <div style={{ margin: "14px 0" }}>
                    <RiskBadge status={status} />
                  </div>
                  {status === "RED_FLAG" && (
                    <div className="stat-sub">
                      Menunggu Tinjauan Klinis oleh dokter — lihat halaman <strong>Tinjauan Klinis</strong>.
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
                {cats && (cats.bloodPressure || cats.glucose || cats.bmi) && (
                  <div className="card" style={{ gridColumn: "1 / -1" }}>
                    <h3>Kategori Klinis</h3>
                    <div className="stat-sub" style={{ marginBottom: 8 }}>
                      Kategori spesifik sesuai standar Hipertensi/Diabetes — bukan hanya skor umum.
                    </div>
                    <div className="grid cols-2">
                      {cats.bloodPressure && (
                        <div>
                          <div className="stat-label">Tekanan Darah</div>
                          <div style={{ fontWeight: 600 }}>{cats.bloodPressure}</div>
                        </div>
                      )}
                      {cats.glucose && (
                        <div>
                          <div className="stat-label">Gula Darah</div>
                          <div style={{ fontWeight: 600 }}>{cats.glucose}</div>
                        </div>
                      )}
                      {cats.bmi && (
                        <div>
                          <div className="stat-label">IMT</div>
                          <div style={{ fontWeight: 600 }}>{cats.bmi.bmi} — {cats.bmi.category}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
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
                <div className="stat-sub" style={{ marginBottom: 4 }}>
                  Terisi otomatis dari Rincian Skor di atas — silakan tinjau &amp; sesuaikan sesuai kondisi klinis sebenarnya.
                </div>
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
