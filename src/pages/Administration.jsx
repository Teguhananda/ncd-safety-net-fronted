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

  // --- Kelola Akun Staff (baru) ---
  const [newAccount, setNewAccount] = useState({ displayName: "", email: "", password: "", role: "dokter" });
  const [newAccountBusy, setNewAccountBusy] = useState(false);
  const [newAccountMsg, setNewAccountMsg] = useState(null);

  const [roleChange, setRoleChange] = useState({ email: "", role: "dokter" });
  const [roleChangeBusy, setRoleChangeBusy] = useState(false);
  const [roleChangeMsg, setRoleChangeMsg] = useState(null);

  const submitNewAccount = async () => {
    if (!newAccount.email || !newAccount.password) {
      setNewAccountMsg({ ok: false, text: "Email dan password wajib diisi." });
      return;
    }
    setNewAccountBusy(true);
    setNewAccountMsg(null);
    try {
      const res = await callApi("adminConfig", { action: "createStaffAccount", ...newAccount });
      setNewAccountMsg({ ok: true, text: `Akun berhasil dibuat: ${res.data.email} (role: ${res.data.role}).` });
      setNewAccount({ displayName: "", email: "", password: "", role: "dokter" });
    } catch (e) {
      setNewAccountMsg({ ok: false, text: e.message || "Gagal membuat akun." });
    } finally {
      setNewAccountBusy(false);
    }
  };

  const submitRoleChange = async () => {
    if (!roleChange.email) {
      setRoleChangeMsg({ ok: false, text: "Email wajib diisi." });
      return;
    }
    setRoleChangeBusy(true);
    setRoleChangeMsg(null);
    try {
      const res = await callApi("adminConfig", { action: "setStaffRole", ...roleChange });
      setRoleChangeMsg({ ok: true, text: `Role akun ${res.data.email} diubah jadi: ${res.data.role}.` });
    } catch (e) {
      setRoleChangeMsg({ ok: false, text: e.message || "Gagal mengubah role." });
    } finally {
      setRoleChangeBusy(false);
    }
  };

  // --- Kelola Sandi (reset password akun yang lupa sandi) ---
  const [pwReset, setPwReset] = useState({ email: "", newPassword: "" });
  const [pwResetBusy, setPwResetBusy] = useState(false);
  const [pwResetMsg, setPwResetMsg] = useState(null);

  const submitPasswordReset = async () => {
    if (!pwReset.email || !pwReset.newPassword) {
      setPwResetMsg({ ok: false, text: "Email dan sandi baru wajib diisi." });
      return;
    }
    setPwResetBusy(true);
    setPwResetMsg(null);
    try {
      const res = await callApi("adminConfig", { action: "resetStaffPassword", ...pwReset });
      setPwResetMsg({ ok: true, text: `Sandi akun ${res.data.email} berhasil direset. Sampaikan sandi baru ke pemilik akun.` });
      setPwReset({ email: "", newPassword: "" });
    } catch (e) {
      setPwResetMsg({ ok: false, text: e.message || "Gagal reset sandi." });
    } finally {
      setPwResetBusy(false);
    }
  };

  // --- Ambang Vital Sign (Tensi & Gula Darah) — dipakai Layer 1 (red flag)
  // dan Domain Klinis (Layer 2) di riskEngine.js. Nilai awal di bawah ini
  // sama dengan DEFAULT_THRESHOLDS.vitals di riskEngine.js (fallback),
  // supaya form ini mencerminkan apa yang benar-benar dipakai sistem
  // selama komite belum pernah menyimpan versi kustom.
  //
  // Sumber: PNPK Hipertensi Dewasa (Kepmenkes RI No. HK.01.07/MENKES/303/2026)
  // dan PNPK DM Tipe 2 Dewasa (Kepmenkes RI No. HK.01.07/MENKES/302/2026).
  const [vitals, setVitals] = useState({
    systolicRedFlag: 180, // Derajat 3/Krisis (PNPK)
    systolicLowRedFlag: 90,
    systolicWarn: 160, // awal Derajat 2 (PNPK)
    diastolicRedFlag: 110, // Derajat 3/Krisis (PNPK)
    diastolicWarn: 100, // awal Derajat 2 (PNPK)
    pulseLowRedFlag: 45,
    pulseWarnLow: 55,
    pulseWarnHigh: 100,
    pulseHighRedFlag: 140,
    tempLowRedFlag: 35.5,
    tempWarnHigh: 37.8,
    tempHighRedFlag: 38.5,
    spo2WarnLow: 96,
    spo2LowRedFlag: 92,
    rrLowRedFlag: 10,
    rrWarnLow: 13,
    rrWarnHigh: 22,
    rrHighRedFlag: 26,
    // Kategori klinis 6 tingkat sesuai PNPK Hipertensi Dewasa 2026 / ESC 2018-2024
    optimalSystolicMax: 119,
    optimalDiastolicMax: 79,
    normalSystolicMax: 129,
    normalDiastolicMax: 84,
    normalHighSystolicMax: 139,
    normalHighDiastolicMax: 89,
    derajat1SystolicMax: 159,
    derajat1DiastolicMax: 99,
    derajat2SystolicMax: 179,
    derajat2DiastolicMax: 109,
    // Gula darah — sesuai Tabel 4 PNPK DM Tipe 2 Dewasa 2026
    gdsLowRedFlag: 70,
    gdsDiabetesMin: 200, // ambang diagnostik GDS (dengan gejala klasik/px ulang)
    gdsHighRedFlag: 300, // ambang "terkendali buruk" (evaluasi benda keton) per PNPK
    gdpLowRedFlag: 70,
    gdpNormalMax: 99,
    gdpDiabetesMin: 126, // ambang diagnostik GDP
    gdpHighRedFlag: 300,
    hba1cNormalMax: 5.6,
    hba1cDiabetesMin: 6.5, // ambang diagnostik HbA1c
    hba1cHighWarn: 7, // target kendali PNPK: HbA1c <7%
    hba1cHighRedFlag: 9, // ambang PNPK utk pertimbangan insulin (>9%)
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
  const [reminderBusy, setReminderBusy] = useState(false);
  const [reminderMsg, setReminderMsg] = useState(null);

  const runSendReminders = async () => {
    setReminderBusy(true);
    try {
      const res = await callApi("scheduled", { action: "sendMonitoringReminders" });
      setReminderMsg({ ok: true, text: `Terkirim ke ${res.data.sentCount} pasien (${res.data.skippedCount} dilewati — belum aktifkan notifikasi).` });
    } catch (e) {
      setReminderMsg({ ok: false, text: e.message });
    } finally {
      setReminderBusy(false);
    }
  };

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
          rrLowRedFlag: Number(vitals.rrLowRedFlag),
          rrWarnLow: Number(vitals.rrWarnLow),
          rrWarnHigh: Number(vitals.rrWarnHigh),
          rrHighRedFlag: Number(vitals.rrHighRedFlag),
          bpCategory: {
            optimalSystolicMax: Number(vitals.optimalSystolicMax),
            optimalDiastolicMax: Number(vitals.optimalDiastolicMax),
            normalSystolicMax: Number(vitals.normalSystolicMax),
            normalDiastolicMax: Number(vitals.normalDiastolicMax),
            normalHighSystolicMax: Number(vitals.normalHighSystolicMax),
            normalHighDiastolicMax: Number(vitals.normalHighDiastolicMax),
            derajat1SystolicMax: Number(vitals.derajat1SystolicMax),
            derajat1DiastolicMax: Number(vitals.derajat1DiastolicMax),
            derajat2SystolicMax: Number(vitals.derajat2SystolicMax),
            derajat2DiastolicMax: Number(vitals.derajat2DiastolicMax),
          },
          glucose: {
            GDS: {
              lowRedFlag: Number(vitals.gdsLowRedFlag),
              diabetesMin: Number(vitals.gdsDiabetesMin),
              highRedFlag: Number(vitals.gdsHighRedFlag),
            },
            GDP: {
              lowRedFlag: Number(vitals.gdpLowRedFlag),
              normalMax: Number(vitals.gdpNormalMax),
              diabetesMin: Number(vitals.gdpDiabetesMin),
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
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Kirim Pengingat Monitoring (Push)</div>
            <div className="stat-sub" style={{ marginBottom: 8 }}>
              Kirim notifikasi ke semua pasien dengan Safety Plan aktif yang sudah mengaktifkan notifikasi di HP-nya.
              Belum otomatis terjadwal — jalankan manual sesuai kebutuhan (mis. tiap pagi).
            </div>
            <button className="btn btn-primary" onClick={runSendReminders} disabled={reminderBusy}>
              {reminderBusy ? "Mengirim..." : "Kirim Sekarang"}
            </button>
            <SectionResult msg={reminderMsg} />
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
          Kategori klinis 6 tingkat sesuai PNPK Hipertensi Dewasa 2026 (Kepmenkes RI No.
          HK.01.07/MENKES/303/2026, basis ESC 2018/2024): Optimal → Normal → Normal-Tinggi →
          Derajat 1 → Derajat 2 → Derajat 3/Krisis (pakai ambang Red Flag di atas).
          Isi batas ATAS tiap kategori (nilai di bawahnya masih masuk kategori itu).
        </div>
        <div className="grid cols-3">
          <div className="field">
            <label>Optimal — batas atas sistolik (≤)</label>
            <input type="number" value={vitals.optimalSystolicMax} onChange={(e) => updateVital("optimalSystolicMax", e.target.value)} />
          </div>
          <div className="field">
            <label>Optimal — batas atas diastolik (≤)</label>
            <input type="number" value={vitals.optimalDiastolicMax} onChange={(e) => updateVital("optimalDiastolicMax", e.target.value)} />
          </div>
          <div />
          <div className="field">
            <label>Normal — batas atas sistolik (≤)</label>
            <input type="number" value={vitals.normalSystolicMax} onChange={(e) => updateVital("normalSystolicMax", e.target.value)} />
          </div>
          <div className="field">
            <label>Normal — batas atas diastolik (≤)</label>
            <input type="number" value={vitals.normalDiastolicMax} onChange={(e) => updateVital("normalDiastolicMax", e.target.value)} />
          </div>
          <div />
          <div className="field">
            <label>Normal-Tinggi — batas atas sistolik (≤)</label>
            <input type="number" value={vitals.normalHighSystolicMax} onChange={(e) => updateVital("normalHighSystolicMax", e.target.value)} />
          </div>
          <div className="field">
            <label>Normal-Tinggi — batas atas diastolik (≤)</label>
            <input type="number" value={vitals.normalHighDiastolicMax} onChange={(e) => updateVital("normalHighDiastolicMax", e.target.value)} />
          </div>
          <div />
          <div className="field">
            <label>Derajat 1 — batas atas sistolik (≤)</label>
            <input type="number" value={vitals.derajat1SystolicMax} onChange={(e) => updateVital("derajat1SystolicMax", e.target.value)} />
          </div>
          <div className="field">
            <label>Derajat 1 — batas atas diastolik (≤)</label>
            <input type="number" value={vitals.derajat1DiastolicMax} onChange={(e) => updateVital("derajat1DiastolicMax", e.target.value)} />
          </div>
          <div />
          <div className="field">
            <label>Derajat 2 — batas atas sistolik (≤)</label>
            <input type="number" value={vitals.derajat2SystolicMax} onChange={(e) => updateVital("derajat2SystolicMax", e.target.value)} />
          </div>
          <div className="field">
            <label>Derajat 2 — batas atas diastolik (≤)</label>
            <input type="number" value={vitals.derajat2DiastolicMax} onChange={(e) => updateVital("derajat2DiastolicMax", e.target.value)} />
          </div>
        </div>
        <div className="stat-sub" style={{ marginTop: 4 }}>
          Derajat 3 / Krisis = melebihi batas Derajat 2, memakai ambang Red Flag sistolik/diastolik di atas.
        </div>

        <h4 style={{ marginTop: 16, marginBottom: 8 }}>Nadi (x/menit)</h4>
        <div className="stat-sub" style={{ marginBottom: 8 }}>
          Ambang berikut BUKAN diadaptasi dari skor deteksi-dini generik (mis. NEWS2) yang
          dirancang untuk pasien rawat inap akut segala penyebab. Ambang ini dipilih dari 2
          komplikasi spesifik Hipertensi/DM: bradikardia sebagai efek samping obat beta-blocker/CCB
          (lazim dipakai pasien hipertensi), dan takikardia sebagai respons kompensasi hipoglikemia
          pada pasien DM yang memakai insulin/sulfonilurea.
        </div>
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
        <div className="stat-sub" style={{ marginBottom: 8 }}>
          Ambang demam dibuat LEBIH SENSITIF (lebih rendah) daripada skor deteksi-dini generik
          untuk pasien rawat inap umum, karena neuropati otonom diabetik dapat menumpulkan respons
          demam (blunted febrile response) — infeksi berat seperti kaki diabetik atau infeksi
          saluran kemih bisa terlewat kalau memakai ambang umum. Demam juga jadi pencetus lonjakan
          tekanan darah pada pasien hipertensi.
        </div>
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
        <div className="stat-sub" style={{ marginBottom: 8 }}>
          Ambang red flag DINAIKKAN (lebih sensitif) dibanding skor deteksi-dini generik, karena
          SpO2 turun pada populasi ini paling sering mengarah ke edema paru akut — komplikasi
          krisis hipertensi yang eksplisit disebut PNPK Hipertensi (butuh nitrogliserin + loop
          diuretic segera). Deteksi lebih dini lebih relevan untuk skrining primer.
        </div>
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

        <h4 style={{ marginTop: 16, marginBottom: 8 }}>Frekuensi Napas (x/menit)</h4>
        <div className="stat-sub" style={{ marginBottom: 8 }}>
          Ambang berikut BUKAN diadaptasi dari skor deteksi-dini generik (mis. NEWS2). Takipnea
          (napas cepat) diwaspadai sebagai tanda edema paru akut (komplikasi krisis hipertensi)
          atau napas Kussmaul (khas Ketoasidosis Diabetik/KAD, biasanya menyertai gula darah
          sangat tinggi). Bradipnea (napas lambat) diwaspadai sebagai tanda depresi napas akibat
          penurunan kesadaran berat atau hipoglikemia berat.
        </div>
        <div className="grid cols-4">
          <div className="field">
            <label>Red Flag Rendah/Bradipnea (≤)</label>
            <input type="number" value={vitals.rrLowRedFlag} onChange={(e) => updateVital("rrLowRedFlag", e.target.value)} />
          </div>
          <div className="field">
            <label>Waspada Rendah (≤)</label>
            <input type="number" value={vitals.rrWarnLow} onChange={(e) => updateVital("rrWarnLow", e.target.value)} />
          </div>
          <div className="field">
            <label>Waspada Tinggi (≥)</label>
            <input type="number" value={vitals.rrWarnHigh} onChange={(e) => updateVital("rrWarnHigh", e.target.value)} />
          </div>
          <div className="field">
            <label>Red Flag Tinggi/Takipnea (≥)</label>
            <input type="number" value={vitals.rrHighRedFlag} onChange={(e) => updateVital("rrHighRedFlag", e.target.value)} />
          </div>
        </div>

        <h4 style={{ marginTop: 16, marginBottom: 8 }}>Gula Darah Sewaktu — GDS (mg/dL)</h4>
        <div className="stat-sub" style={{ marginBottom: 8 }}>
          Sesuai PNPK DM Tipe 2 Dewasa 2026 (Kepmenkes RI No. HK.01.07/MENKES/302/2026). PNPK
          tidak mendefinisikan zona "prediabetes" resmi untuk GDS tunggal — hanya ambang
          diagnostik (≥200, perlu gejala klasik/pemeriksaan ulang) dan ambang "terkendali buruk"
          (≥300, perlu evaluasi benda keton).
        </div>
        <div className="grid cols-3">
          <div className="field">
            <label>Red Flag Rendah/Hipoglikemia (≤)</label>
            <input type="number" value={vitals.gdsLowRedFlag} onChange={(e) => updateVital("gdsLowRedFlag", e.target.value)} />
          </div>
          <div className="field">
            <label>Ambang Diagnosis Diabetes (≥)</label>
            <input type="number" value={vitals.gdsDiabetesMin} onChange={(e) => updateVital("gdsDiabetesMin", e.target.value)} />
          </div>
          <div className="field">
            <label>Terkendali Buruk/Red Flag (≥)</label>
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
            <label>Ambang Diagnosis Diabetes (≥)</label>
            <input type="number" value={vitals.gdpDiabetesMin} onChange={(e) => updateVital("gdpDiabetesMin", e.target.value)} />
          </div>
          <div className="field">
            <label>Terkendali Buruk/Red Flag (≥)</label>
            <input type="number" value={vitals.gdpHighRedFlag} onChange={(e) => updateVital("gdpHighRedFlag", e.target.value)} />
          </div>
        </div>
        <div className="stat-sub" style={{ marginTop: 4 }}>
          Nilai 100 - ({"<"}Ambang Diagnosis Diabetes) mg/dL = Prediabetes/GPT (Glukosa Puasa Terganggu), sesuai PNPK.
        </div>

        <h4 style={{ marginTop: 16, marginBottom: 8 }}>HbA1c (%)</h4>
        <div className="stat-sub" style={{ marginBottom: 8 }}>
          Target kendali PNPK: HbA1c {"<"}7% ("Diabetes Terkontrol"). PNPK secara eksplisit
          menyebut HbA1c {">"}9% sebagai titik pertimbangan terapi insulin — dipakai sebagai
          ambang "Tidak Terkontrol (Berat)". HbA1c TIDAK PERNAH memicu Red Flag/eskalasi darurat
          (mencerminkan kendali 2-3 bulan terakhir, bukan kondisi akut hari ini).
        </div>
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
            <label>Target Kendali Terlampaui/Tidak Terkontrol (≥)</label>
            <input type="number" value={vitals.hba1cHighWarn} onChange={(e) => updateVital("hba1cHighWarn", e.target.value)} />
          </div>
          <div className="field">
            <label>Tidak Terkontrol Berat/Pertimbangkan Insulin (≥)</label>
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

      <div className="card" style={{ marginTop: 16 }}>
        <h3>👤 Kelola Akun Staff</h3>
        <div className="stat-sub" style={{ marginBottom: 12 }}>
          Buat akun baru untuk dokter/petugas/manajemen, atau ubah role akun yang sudah ada — tidak perlu lewat Firebase Console lagi.
        </div>

        <div className="grid cols-2">
          <div>
            <h4 style={{ marginBottom: 10 }}>Tambah Akun Staff Baru</h4>
            <div className="field">
              <label>Nama Lengkap</label>
              <input value={newAccount.displayName} onChange={(e) => setNewAccount((a) => ({ ...a, displayName: e.target.value }))} placeholder="mis. dr. Ratih, Sp.PD" />
            </div>
            <div className="field">
              <label>Email</label>
              <input type="email" value={newAccount.email} onChange={(e) => setNewAccount((a) => ({ ...a, email: e.target.value }))} placeholder="ratih@rsudrejanglebong.go.id" />
            </div>
            <div className="field">
              <label>Password Awal (min. 6 karakter)</label>
              <input type="text" value={newAccount.password} onChange={(e) => setNewAccount((a) => ({ ...a, password: e.target.value }))} placeholder="Sarankan pasien ganti setelah login pertama" />
            </div>
            <div className="field">
              <label>Role</label>
              <select value={newAccount.role} onChange={(e) => setNewAccount((a) => ({ ...a, role: e.target.value }))}>
                <option value="dokter">Dokter</option>
                <option value="petugas">Petugas</option>
                <option value="manajemen">PMKP</option>
                <option value="case_manager">Case Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button className="btn btn-primary" onClick={submitNewAccount} disabled={newAccountBusy}>
              {newAccountBusy ? "Membuat..." : "Buat Akun"}
            </button>
            <SectionResult msg={newAccountMsg} />
          </div>

          <div>
            <h4 style={{ marginBottom: 10 }}>Ubah Role Akun yang Sudah Ada</h4>
            <div className="field">
              <label>Email Akun</label>
              <input type="email" value={roleChange.email} onChange={(e) => setRoleChange((r) => ({ ...r, email: e.target.value }))} placeholder="email akun yang sudah terdaftar" />
            </div>
            <div className="field">
              <label>Role Baru</label>
              <select value={roleChange.role} onChange={(e) => setRoleChange((r) => ({ ...r, role: e.target.value }))}>
                <option value="dokter">Dokter</option>
                <option value="petugas">Petugas</option>
                <option value="manajemen">PMKP</option>
                <option value="case_manager">Case Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button className="btn btn-primary" onClick={submitRoleChange} disabled={roleChangeBusy}>
              {roleChangeBusy ? "Menyimpan..." : "Ubah Role"}
            </button>
            <SectionResult msg={roleChangeMsg} />
            <div className="stat-sub" style={{ marginTop: 10 }}>
              Kalau akun yang login sedang aktif saat role-nya diubah, dia perlu logout &amp; login ulang supaya perubahan berlaku.
            </div>
          </div>
        </div>

        <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--glass-border)" }}>
          <h4 style={{ marginBottom: 10 }}>🔑 Kelola Sandi (Reset Password)</h4>
          <div className="stat-sub" style={{ marginBottom: 12 }}>
            Kalau ada staff lupa sandinya, reset di sini — sandi langsung berubah tanpa perlu email/link reset.
          </div>
          <div className="grid cols-2">
            <div className="field">
              <label>Email Akun</label>
              <input type="email" value={pwReset.email} onChange={(e) => setPwReset((p) => ({ ...p, email: e.target.value }))} placeholder="email akun yang lupa sandi" />
            </div>
            <div className="field">
              <label>Sandi Baru (min. 6 karakter)</label>
              <input type="text" value={pwReset.newPassword} onChange={(e) => setPwReset((p) => ({ ...p, newPassword: e.target.value }))} placeholder="sandi baru untuk akun ini" />
            </div>
          </div>
          <button className="btn btn-primary" onClick={submitPasswordReset} disabled={pwResetBusy}>
            {pwResetBusy ? "Mereset..." : "Reset Sandi"}
          </button>
          <SectionResult msg={pwResetMsg} />
        </div>
      </div>
    </Layout>
  );
}
