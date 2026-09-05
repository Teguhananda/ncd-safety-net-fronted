import { useState } from "react";
import { callApi } from "../lib/api";
import Layout from "../components/Layout";

function SectionResult({ msg }) {
  if (!msg) return null;
  return <div className="stat-sub" style={{ marginTop: 8, color: msg.ok ? "var(--low)" : "var(--redflag)" }}>{msg.text}</div>;
}

export default function Administration() {
  // --- Ambang Risikos ---
  const [highThreshold, setHighThreshold] = useState(6);
  const [moderateThreshold, setModerateThreshold] = useState(3);
  const [thresholdApprover, setThresholdApprover] = useState("");
  const [thresholdBusy, setThresholdBusy] = useState(false);
  const [thresholdMsg, setThresholdMsg] = useState(null);

  // --- Ambang Vital Sign (Tensi & Gula Darah) — dipakai Layer 1 (red flag)
  // dan Domain Klinis (Layer 2) di riskEngine.js. Nilai awal di bawah ini
  // sama dengan DEFAULT_THRESHOLDS.vitals di riskEngine.js (fallback),
  // supaya form ini mencerminkan apa yang benar-benar dipakai sistem
  // selama komite belum pernah menyimpan versi kustom.
  const [vitals, setVitals] = useState({
    systolicRedFlag: 180,
    systolicLowRedFlag: 90,
    systolicWarn: 160,
    diastolicRedFlag: 120,
    diastolicWarn: 100,
    pulseLowRedFlag: 40,
    pulseWarnLow: 50,
    pulseWarnHigh: 120,
    pulseHighRedFlag: 150,
    tempLowRedFlag: 35,
    tempWarnHigh: 38.5,
    tempHighRedFlag: 39.5,
    spo2WarnLow: 95,
    spo2LowRedFlag: 90,
    // Ambang kategori klinis standar (untuk label, bukan red flag/skor)
    systolicElevatedMin: 120,
    systolicStage1Min: 130,
    diastolicStage1Min: 80,
    systolicStage2Min: 140,
    diastolicStage2Min: 90,
    gdsLowRedFlag: 70,
    gdsNormalMax: 139,
    gdsHighWarn: 200,
    gdsHighRedFlag: 300,
    gdpLowRedFlag: 70,
    gdpNormalMax: 99,
    gdpHighWarn: 126,
    gdpHighRedFlag: 250,
    hba1cNormalMax: 5.6,
    hba1cDiabetesMin: 6.5,
    hba1cHighWarn: 8,
    hba1cHighRedFlag: 10,
  });
  const updateVital = (field, value) => setVitals((v) => ({ ...v, [field]: value }));

  // --- Followup Policy ---
  const [highOverdueDays, setHighOverdueDays] = useState(14);
  const [policyApprover, setPolicyApprover] = useState("");
  const [policyBusy, setPolicyBusy] = useState(false);
  const [policyMsg, setPolicyMsg] = useState(null);

  // --- Before Baseline ---
  const [baseline, setBaseline] = useState({
    highRiskIdentified: "",
    medReconciliation: "",
    educationDocumented: "",
    redFlagReviewed: "",
    followupCompletion: "",
    lostToFollowup: "",
  });
  const baselineLabels = {
    highRiskIdentified: "Risiko Tinggi Teridentifikasi",
    medReconciliation: "Rekonsiliasi Obat",
    educationDocumented: "Edukasi Terdokumentasi",
    redFlagReviewed: "Red Flag Ditinjau",
    followupCompletion: "Penyelesaian Tindak Lanjut",
    lostToFollowup: "Hilang dari Tindak Lanjut",
  };
  const [sourceNote, setSourceNote] = useState("");
  const [baselineBusy, setBaselineBusy] = useState(false);
  const [baselineMsg, setBaselineMsg] = useState(null);

  // --- Trigger Manual (pengganti scheduled functions — plan gratis/Spark) ---
  const [followupBusy, setFollowupBusy] = useState(false);
  const [followupMsg, setFollowupMsg] = useState(null);
  const [analyticsBusy, setAnalyticsBusy] = useState(false);
  const [analyticsMsg, setAnalyticsMsg] = useState(null);

  const runCheckOverdue = async () => {
    setFollowupBusy(true);
    try {
      const res = await callApi("scheduled", { action: "checkOverdue" });
      setFollowupMsg({
        ok: true,
        text: `Selesai — ${res.data.updatedCount} follow-up ditandai overdue, ${res.data.escalatedCount} dieskalasi ke dokter.`,
      });
    } catch (e) {
      setFollowupMsg({ ok: false, text: e.message });
    } finally {
      setFollowupBusy(false);
    }
  };

const [resetBusy, setResetBusy] = useState(false);
const [resetMsg, setResetMsg] = useState(null);

const runResetAnalytics = async () => {
  const confirmed = window.confirm(
    "Ini akan menghapus semua riwayat snapshot Analitik PMKP dan menghitung ulang dari data yang ada sekarang (termasuk insiden yang sudah dihapus). Lanjutkan?"
  );
  if (!confirmed) return;
  setResetBusy(true);
  try {
    const res = await callApi("scheduled", { action: "resetAnalytics" });
    setResetMsg({
      ok: true,
      text: `Reset selesai — ${res.data.deletedCount} snapshot lama dihapus, snapshot baru (${res.data.totalScreenings} total screening) sudah dibuat.`,
    });
  } catch (e) {
    setResetMsg({ ok: false, text: e.message });
  } finally {
    setResetBusy(false);
  }
};

  const runComputeAnalytics = async () => {
    setAnalyticsBusy(true);
    try {
      const res = await callApi("scheduled", { action: "computeAnalytics" });
      setAnalyticsMsg({ ok: true, text: `Snapshot ${res.data.periodId} tersimpan (${res.data.totalScreenings} total screening).` });
    } catch (e) {
      setAnalyticsMsg({ ok: false, text: e.message });
    } finally {
      setAnalyticsBusy(false);
    }
  };

  const saveThresholds = async () => {
    if (!thresholdApprover) {
      setThresholdMsg({ ok: false, text: "Nama/peran penyetuju komite wajib diisi." });
      return;
    }
    setThresholdBusy(true);
    try {
      await callApi("adminConfig", {
        action: "riskThresholds",
        highThreshold: Number(highThreshold),
        moderateThreshold: Number(moderateThreshold),
        approvedBy: thresholdApprover,
        vitals: {
          systolicRedFlag: Number(vitals.systolicRedFlag),
          systolicLowRedFlag: Number(vitals.systolicLowRedFlag),
          systolicWarn: Number(vitals.systolicWarn),
          diastolicRedFlag: Number(vitals.diastolicRedFlag),
          diastolicWarn: Number(vitals.diastolicWarn),
          pulseLowRedFlag: Number(vitals.pulseLowRedFlag),
          pulseWarnLow: Number(vitals.pulseWarnLow),
          pulseWarnHigh: Number(vitals.pulseWarnHigh),
          pulseHighRedFlag: Number(vitals.pulseHighRedFlag),
          tempLowRedFlag: Number(vitals.tempLowRedFlag),
          tempWarnHigh: Number(vitals.tempWarnHigh),
          tempHighRedFlag: Number(vitals.tempHighRedFlag),
          spo2WarnLow: Number(vitals.spo2WarnLow),
          spo2LowRedFlag: Number(vitals.spo2LowRedFlag),
          bpCategory: {
            systolicElevatedMin: Number(vitals.systolicElevatedMin),
            systolicStage1Min: Number(vitals.systolicStage1Min),
            diastolicStage1Min: Number(vitals.diastolicStage1Min),
            systolicStage2Min: Number(vitals.systolicStage2Min),
            diastolicStage2Min: Number(vitals.diastolicStage2Min),
          },
          glucose: {
            GDS: {
              lowRedFlag: Number(vitals.gdsLowRedFlag),
              normalMax: Number(vitals.gdsNormalMax),
              highWarn: Number(vitals.gdsHighWarn),
              highRedFlag: Number(vitals.gdsHighRedFlag),
            },
            GDP: {
              lowRedFlag: Number(vitals.gdpLowRedFlag),
              normalMax: Number(vitals.gdpNormalMax),
              highWarn: Number(vitals.gdpHighWarn),
              highRedFlag: Number(vitals.gdpHighRedFlag),
            },
            HbA1c: {
              normalMax: Number(vitals.hba1cNormalMax),
              diabetesMin: Number(vitals.hba1cDiabetesMin),
              highWarn: Number(vitals.hba1cHighWarn),
              highRedFlag: Number(vitals.hba1cHighRedFlag),
            },
          },
        },
      });
      setThresholdMsg({ ok: true, text: "Threshold (termasuk ambang vital sign) tersimpan sebagai versi baru." });
    } catch (e) {
      setThresholdMsg({ ok: false, text: e.message });
    } finally {
      setThresholdBusy(false);
    }
  };

  const savePolicy = async () => {
    if (!policyApprover) {
      setPolicyMsg({ ok: false, text: "Nama/peran penyetuju komite wajib diisi." });
      return;
    }
    setPolicyBusy(true);
    try {
      await callApi("adminConfig", { action: "followupPolicy", highOverdueDays: Number(highOverdueDays), approvedBy: policyApprover });
      setPolicyMsg({ ok: true, text: "Kebijakan follow-up tersimpan." });
    } catch (e) {
      setPolicyMsg({ ok: false, text: e.message });
    } finally {
      setPolicyBusy(false);
    }
  };

  const saveBaseline = async () => {
    setBaselineBusy(true);
    try {
      const indicators = Object.fromEntries(
        Object.entries(baseline)
          .filter(([, v]) => v !== "")
          .map(([k, v]) => [k, Number(v) / 100])
      );
      await callApi("adminConfig", { action: "beforeBaseline", indicators, sourceNote });
      setBaselineMsg({ ok: true, text: "Baseline before-implementation tersimpan." });
    } catch (e) {
      setBaselineMsg({ ok: false, text: e.message });
    } finally {
      setBaselineBusy(false);
    }
  };

  return (
    <Layout title="Administration" meta="Konfigurasi threshold, kebijakan follow-up, dan baseline before-after">
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Update Manual (Plan Gratis — Tidak Ada Billing Aktif)</h3>
        <div className="alert warn">
          <span>ℹ️</span>
          <div>
            Project ini belum di-upgrade ke plan Blaze, jadi 2 proses berikut TIDAK berjalan otomatis setiap hari —
            perlu diklik manual secara berkala. Begitu Bapak siap upgrade ke Blaze, saya bisa kembalikan ke otomatis.
          </div>
        </div>
        <div className="grid cols-2">
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Cek Tindak Lanjut Terlambat</div>
            <div className="stat-sub" style={{ marginBottom: 8 }}>
              Menandai follow-up yang lewat jadwal, dan eskalasi ke dokter kalau sudah lewat batas hari.
            </div>
            <button className="btn btn-primary" onClick={runCheckOverdue} disabled={followupBusy}>
              {followupBusy ? "Memproses..." : "Jalankan Sekarang"}
            </button>
            <SectionResult msg={followupMsg} />
          </div>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Update Dashboard PMKP</div>
            <div className="stat-sub" style={{ marginBottom: 8 }}>
              Menghitung ulang snapshot data untuk Dashboard/Analytics/Before-After hari ini.
            </div>
            <button className="btn btn-primary" onClick={runComputeAnalytics} disabled={analyticsBusy}>
              {analyticsBusy ? "Memproses..." : "Jalankan Sekarang"}
            </button>
            <SectionResult msg={analyticsMsg} />
        <button className="btn btn-primary" style={{ marginTop: 8, background: "#c0392b" }} onClick={runResetAnalytics} disabled={resetBusy}>
          {resetBusy ? "Mereset..." : "Reset Analitik PMKP"}
        </button>
        <SectionResult msg={resetMsg} />
          </div>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h3>Ambang Risiko</h3>
          <div className="grid cols-2">
            <div className="field">
              <label>Ambang Sedang</label>
              <input type="number" value={moderateThreshold} onChange={(e) => setModerateThreshold(e.target.value)} />
            </div>
            <div className="field">
              <label>Ambang Tinggi</label>
              <input type="number" value={highThreshold} onChange={(e) => setHighThreshold(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Disetujui oleh (komite/dokter)</label>
            <input value={thresholdApprover} onChange={(e) => setThresholdApprover(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={saveThresholds} disabled={thresholdBusy}>
            {thresholdBusy ? "Menyimpan..." : "Simpan (buat versi baru)"}
          </button>
          <SectionResult msg={thresholdMsg} />
        </div>

        <div className="card">
          <h3>Kebijakan Follow-up</h3>
          <div className="field">
            <label>Batas hari untuk HIGH_FOLLOWUP_RISK</label>
            <input type="number" value={highOverdueDays} onChange={(e) => setHighOverdueDays(e.target.value)} />
          </div>
          <div className="field">
            <label>Disetujui oleh</label>
            <input value={policyApprover} onChange={(e) => setPolicyApprover(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={savePolicy} disabled={policyBusy}>
            {policyBusy ? "Menyimpan..." : "Simpan"}
          </button>
          <SectionResult msg={policyMsg} />
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Ambang Vital Sign (Red Flag &amp; Domain Klinis)</h3>
        <div className="stat-sub" style={{ marginBottom: 12 }}>
          Dipakai untuk mendeteksi kondisi darurat dari tekanan darah &amp; gula darah pada Screening, dan sebagai
          kontribusi ke Domain Klinis pada perhitungan skor risiko. Nilai di bawah harus divalidasi dokter/Komite PMKP
          sebelum dipakai pada pasien nyata — nilai awal yang tampil adalah fallback bawaan sistem.
        </div>

        <h4 style={{ marginTop: 8, marginBottom: 8 }}>Tekanan Darah (mmHg)</h4>
        <div className="grid cols-3">
          <div className="field">
            <label>Sistolik — Red Flag (≥)</label>
            <input type="number" value={vitals.systolicRedFlag} onChange={(e) => updateVital("systolicRedFlag", e.target.value)} />
          </div>
          <div className="field">
            <label>Sistolik — Waspada (≥)</label>
            <input type="number" value={vitals.systolicWarn} onChange={(e) => updateVital("systolicWarn", e.target.value)} />
          </div>
          <div className="field">
            <label>Sistolik — Red Flag Rendah (≤)</label>
            <input type="number" value={vitals.systolicLowRedFlag} onChange={(e) => updateVital("systolicLowRedFlag", e.target.value)} />
          </div>
          <div className="field">
            <label>Diastolik — Red Flag (≥)</label>
            <input type="number" value={vitals.diastolicRedFlag} onChange={(e) => updateVital("diastolicRedFlag", e.target.value)} />
          </div>
          <div className="field">
            <label>Diastolik — Waspada (≥)</label>
            <input type="number" value={vitals.diastolicWarn} onChange={(e) => updateVital("diastolicWarn", e.target.value)} />
          </div>
        </div>

        <div className="stat-sub" style={{ marginTop: 8, marginBottom: 4 }}>
          Kategori klinis standar (untuk label diagnosis, terpisah dari red flag/skor di atas):
        </div>
        <div className="grid cols-3">
          <div className="field">
            <label>Batas bawah Elevated/Prehipertensi (sistolik ≥)</label>
            <input type="number" value={vitals.systolicElevatedMin} onChange={(e) => updateVital("systolicElevatedMin", e.target.value)} />
          </div>
          <div className="field">
            <label>Batas bawah Hipertensi Stage 1 (sistolik ≥)</label>
            <input type="number" value={vitals.systolicStage1Min} onChange={(e) => updateVital("systolicStage1Min", e.target.value)} />
          </div>
          <div className="field">
            <label>Batas bawah Hipertensi Stage 1 (diastolik ≥)</label>
            <input type="number" value={vitals.diastolicStage1Min} onChange={(e) => updateVital("diastolicStage1Min", e.target.value)} />
          </div>
          <div className="field">
            <label>Batas bawah Hipertensi Stage 2 (sistolik ≥)</label>
            <input type="number" value={vitals.systolicStage2Min} onChange={(e) => updateVital("systolicStage2Min", e.target.value)} />
          </div>
          <div className="field">
            <label>Batas bawah Hipertensi Stage 2 (diastolik ≥)</label>
            <input type="number" value={vitals.diastolicStage2Min} onChange={(e) => updateVital("diastolicStage2Min", e.target.value)} />
          </div>
        </div>

        <h4 style={{ marginTop: 16, marginBottom: 8 }}>Nadi (x/menit)</h4>
        <div className="grid cols-3">
          <div className="field">
            <label>Red Flag Rendah/Bradikardia (≤)</label>
            <input type="number" value={vitals.pulseLowRedFlag} onChange={(e) => updateVital("pulseLowRedFlag", e.target.value)} />
          </div>
          <div className="field">
            <label>Waspada Rendah (≤)</label>
            <input type="number" value={vitals.pulseWarnLow} onChange={(e) => updateVital("pulseWarnLow", e.target.value)} />
          </div>
          <div className="field">
            <label>Waspada Tinggi (≥)</label>
            <input type="number" value={vitals.pulseWarnHigh} onChange={(e) => updateVital("pulseWarnHigh", e.target.value)} />
          </div>
          <div className="field">
            <label>Red Flag Tinggi/Takikardia (≥)</label>
            <input type="number" value={vitals.pulseHighRedFlag} onChange={(e) => updateVital("pulseHighRedFlag", e.target.value)} />
          </div>
        </div>

        <h4 style={{ marginTop: 16, marginBottom: 8 }}>Suhu Tubuh (°C)</h4>
        <div className="grid cols-3">
          <div className="field">
            <label>Red Flag Rendah/Hipotermia (≤)</label>
            <input type="number" step="0.1" value={vitals.tempLowRedFlag} onChange={(e) => updateVital("tempLowRedFlag", e.target.value)} />
          </div>
          <div className="field">
            <label>Waspada Tinggi/Demam (≥)</label>
            <input type="number" step="0.1" value={vitals.tempWarnHigh} onChange={(e) => updateVital("tempWarnHigh", e.target.value)} />
          </div>
          <div className="field">
            <label>Red Flag Tinggi/Hipertermia (≥)</label>
            <input type="number" step="0.1" value={vitals.tempHighRedFlag} onChange={(e) => updateVital("tempHighRedFlag", e.target.value)} />
          </div>
        </div>

        <h4 style={{ marginTop: 16, marginBottom: 8 }}>Saturasi Oksigen — SpO2 (%)</h4>
        <div className="grid cols-3">
          <div className="field">
            <label>Waspada (≤)</label>
            <input type="number" value={vitals.spo2WarnLow} onChange={(e) => updateVital("spo2WarnLow", e.target.value)} />
          </div>
          <div className="field">
            <label>Red Flag (≤)</label>
            <input type="number" value={vitals.spo2LowRedFlag} onChange={(e) => updateVital("spo2LowRedFlag", e.target.value)} />
          </div>
        </div>

        <h4 style={{ marginTop: 16, marginBottom: 8 }}>Gula Darah Sewaktu — GDS (mg/dL)</h4>
        <div className="grid cols-3">
          <div className="field">
            <label>Red Flag Rendah/Hipoglikemia (≤)</label>
            <input type="number" value={vitals.gdsLowRedFlag} onChange={(e) => updateVital("gdsLowRedFlag", e.target.value)} />
          </div>
          <div className="field">
            <label>Batas atas Normal (≤)</label>
            <input type="number" value={vitals.gdsNormalMax} onChange={(e) => updateVital("gdsNormalMax", e.target.value)} />
          </div>
          <div className="field">
            <label>Diabetes/Waspada (≥)</label>
            <input type="number" value={vitals.gdsHighWarn} onChange={(e) => updateVital("gdsHighWarn", e.target.value)} />
          </div>
          <div className="field">
            <label>Hiperglikemia Berat/Red Flag (≥)</label>
            <input type="number" value={vitals.gdsHighRedFlag} onChange={(e) => updateVital("gdsHighRedFlag", e.target.value)} />
          </div>
        </div>

        <h4 style={{ marginTop: 16, marginBottom: 8 }}>Gula Darah Puasa — GDP (mg/dL)</h4>
        <div className="grid cols-3">
          <div className="field">
            <label>Red Flag Rendah/Hipoglikemia (≤)</label>
            <input type="number" value={vitals.gdpLowRedFlag} onChange={(e) => updateVital("gdpLowRedFlag", e.target.value)} />
          </div>
          <div className="field">
            <label>Batas atas Normal (≤)</label>
            <input type="number" value={vitals.gdpNormalMax} onChange={(e) => updateVital("gdpNormalMax", e.target.value)} />
          </div>
          <div className="field">
            <label>Diabetes/Waspada (≥)</label>
            <input type="number" value={vitals.gdpHighWarn} onChange={(e) => updateVital("gdpHighWarn", e.target.value)} />
          </div>
          <div className="field">
            <label>Hiperglikemia Berat/Red Flag (≥)</label>
            <input type="number" value={vitals.gdpHighRedFlag} onChange={(e) => updateVital("gdpHighRedFlag", e.target.value)} />
          </div>
        </div>

        <h4 style={{ marginTop: 16, marginBottom: 8 }}>HbA1c (%)</h4>
        <div className="grid cols-3">
          <div className="field">
            <label>Batas atas Normal (≤)</label>
            <input type="number" step="0.1" value={vitals.hba1cNormalMax} onChange={(e) => updateVital("hba1cNormalMax", e.target.value)} />
          </div>
          <div className="field">
            <label>Ambang Diagnosis Diabetes (≥)</label>
            <input type="number" step="0.1" value={vitals.hba1cDiabetesMin} onChange={(e) => updateVital("hba1cDiabetesMin", e.target.value)} />
          </div>
          <div className="field">
            <label>Waspada/Tidak Terkontrol (≥)</label>
            <input type="number" value={vitals.hba1cHighWarn} onChange={(e) => updateVital("hba1cHighWarn", e.target.value)} />
          </div>
          <div className="field">
            <label>Red Flag (≥)</label>
            <input type="number" value={vitals.hba1cHighRedFlag} onChange={(e) => updateVital("hba1cHighRedFlag", e.target.value)} />
          </div>
        </div>

        <div className="stat-sub" style={{ marginTop: 12 }}>
          Ambang vitals ini disimpan bersamaan dengan tombol <strong>"Simpan (buat versi baru)"</strong> di kartu
          "Ambang Risiko" di atas — keduanya jadi satu versi konfigurasi yang sama, ditandatangani oleh
          "Disetujui oleh" yang sama.
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Before Baseline (untuk Before–After Dashboard)</h3>
        <div className="stat-sub" style={{ marginBottom: 12 }}>
          Isi persentase (0–100) dari data historis RS sebelum implementasi. Kosongkan yang belum ada datanya.
        </div>
        <div className="grid cols-3">
          {Object.keys(baseline).map((key) => (
            <div className="field" key={key}>
              <label>{baselineLabels[key] || key} (%)</label>
              <input
                type="number"
                value={baseline[key]}
                onChange={(e) => setBaseline((b) => ({ ...b, [key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <div className="field">
          <label>Catatan sumber data</label>
          <input value={sourceNote} onChange={(e) => setSourceNote(e.target.value)} placeholder="mis. rekap Excel unit Interna Jan-Feb 2026" />
        </div>
        <button className="btn btn-primary" onClick={saveBaseline} disabled={baselineBusy}>
          {baselineBusy ? "Menyimpan..." : "Simpan Baseline"}
        </button>
        <SectionResult msg={baselineMsg} />
      </div>
    </Layout>
  );
}
