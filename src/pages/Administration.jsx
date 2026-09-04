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
