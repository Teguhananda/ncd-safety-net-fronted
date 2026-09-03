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
  const [sourceNote, setSourceNote] = useState("");
  const [baselineBusy, setBaselineBusy] = useState(false);
  const [baselineMsg, setBaselineMsg] = useState(null);

  // --- AI Assistant Policy ---
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiApprover, setAiApprover] = useState("");
  const [aiConfirmation, setAiConfirmation] = useState(false);
  const [aiDailyLimit, setAiDailyLimit] = useState(50);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState(null);

  const saveAIPolicy = async () => {
    if (aiEnabled && (!aiApprover || !aiConfirmation)) {
      setAiMsg({ ok: false, text: "Untuk mengaktifkan: nama penyetuju dan centang konfirmasi tata kelola wajib diisi." });
      return;
    }
    setAiBusy(true);
    try {
      await callApi("adminConfig", {
        action: "aiPolicy",
        enabled: aiEnabled,
        approvedBy: aiApprover || null,
        governanceConfirmation: aiConfirmation
          ? "Tata kelola privasi RS telah mereview pengiriman data pasien ke API eksternal."
          : null,
        dailyQuestionLimit: Number(aiDailyLimit) || 50,
      });
      setAiMsg({ ok: true, text: aiEnabled ? "Asisten AI diaktifkan." : "Asisten AI dinonaktifkan." });
    } catch (e) {
      setAiMsg({ ok: false, text: e.message });
    } finally {
      setAiBusy(false);
    }
  };

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
      await callApi("adminConfig", { action: "riskThresholds", highThreshold: Number(highThreshold), moderateThreshold: Number(moderateThreshold), approvedBy: thresholdApprover });
      setThresholdMsg({ ok: true, text: "Threshold tersimpan sebagai versi baru." });
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
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16, borderColor: "#EFD4CE" }}>
        <h3>Asisten AI Klinis — Gerbang Privasi Data</h3>
        <div className="alert warn">
          <span>⚠️</span>
          <div>
            Mengaktifkan ini berarti data pasien (hasil skrining, obat, catatan — sebagian diredaksi otomatis) akan
            dikirim ke API eksternal (Anthropic) untuk dijelaskan ke dokter di halaman Clinical Review. Nonaktif
            secara default. Aktifkan HANYA setelah tata kelola privasi RS mereview ini.
            <br /><br />
            <strong>Catatan:</strong> fitur ini juga butuh plan Blaze aktif (project di plan gratis Spark memblokir
            koneksi keluar ke API eksternal) — kalau belum upgrade Blaze, mengaktifkan ini di sini belum akan
            berfungsi sampai billing-nya aktif.
          </div>
        </div>
        <label className="check-item" style={{ marginBottom: 10 }}>
          <input type="checkbox" checked={aiEnabled} onChange={(e) => setAiEnabled(e.target.checked)} />
          Aktifkan Asisten AI Klinis
        </label>
        {aiEnabled && (
          <>
            <div className="field">
              <label>Disetujui oleh (nama/jabatan penanggung jawab tata kelola privasi)</label>
              <input value={aiApprover} onChange={(e) => setAiApprover(e.target.value)} />
            </div>
            <label className="check-item" style={{ marginBottom: 10 }}>
              <input type="checkbox" checked={aiConfirmation} onChange={(e) => setAiConfirmation(e.target.checked)} />
              Saya konfirmasi tata kelola privasi RS telah mereview pengiriman data pasien ke API eksternal ini
            </label>
          </>
        )}
        <div className="field" style={{ maxWidth: 260 }}>
          <label>Batas pertanyaan per user per hari</label>
          <input type="number" value={aiDailyLimit} onChange={(e) => setAiDailyLimit(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={saveAIPolicy} disabled={aiBusy}>
          {aiBusy ? "Menyimpan..." : "Simpan Pengaturan"}
        </button>
        <SectionResult msg={aiMsg} />
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
        <h3>Before Baseline (untuk Before–After Dashboard)</h3>
        <div className="stat-sub" style={{ marginBottom: 12 }}>
          Isi persentase (0–100) dari data historis RS sebelum implementasi. Kosongkan yang belum ada datanya.
        </div>
        <div className="grid cols-3">
          {Object.keys(baseline).map((key) => (
            <div className="field" key={key}>
              <label>{key} (%)</label>
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
