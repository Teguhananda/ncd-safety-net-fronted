import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { callApi } from "../../lib/api";
import { usePortalPwa } from "../../pwa/usePortalPwa";
import { requestAndRegisterPush } from "../../lib/push";
import "../../portal-styles.css";

const STATUS_MAP = {
  SAFE: { emoji: "🟢", label: "AMAN", color: "#1b8a5a" },
  ATTENTION: { emoji: "🟡", label: "PERLU PERHATIAN", color: "#b8860b" },
  ACTION_NEEDED: { emoji: "🟠", label: "PERLU TINDAKAN", color: "#c96a1a" },
  URGENT: { emoji: "🔴", label: "SEGERA HUBUNGI RS", color: "#c0392b" },
};

const CHECKIN_QUESTIONS = [
  { key: "medicationAsPlanned", text: "Apakah obat diminum sesuai rencana?", positiveIsGood: true },
  { key: "newComplaint", text: "Apakah ada keluhan baru?", positiveIsGood: false },
  { key: "medicationChanged", text: "Apakah ada perubahan obat (dari dokter lain/inisiatif sendiri)?", positiveIsGood: false },
  { key: "missedMonitoring", text: "Apakah ada pemeriksaan/monitoring yang terlewat?", positiveIsGood: false },
  { key: "feelsWorse", text: "Apakah kondisi terasa lebih buruk dari biasanya?", positiveIsGood: false },
  { key: "difficultyFollowingPlan", text: "Apakah ada kesulitan mengikuti rencana perawatan?", positiveIsGood: false },
];

function getPatientId() {
  return auth.currentUser?.getIdTokenResult().then((r) => r.claims.patientId);
}

export default function PortalHome() {
  const { canInstall, promptInstall, isStandalone, isIOS } = usePortalPwa();
  const [notifStatus, setNotifStatus] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );
  const [notifMsg, setNotifMsg] = useState("");
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [view, setView] = useState("home"); // home | checkin | monitoring | plan | history | help
  const [checkinAnswers, setCheckinAnswers] = useState({});
  const [checkinSubmitting, setCheckinSubmitting] = useState(false);
  const [checkinDone, setCheckinDone] = useState(false);
  const [monitoringForm, setMonitoringForm] = useState({ parameterType: "systolicBP", value: "", diastolic: "", symptom: "" });
  const [monitoringSubmitting, setMonitoringSubmitting] = useState(false);
  const [monitoringMsg, setMonitoringMsg] = useState("");
  const [summary, setSummary] = useState(null);

  async function loadSnapshot() {
    setLoading(true);
    setLoadError("");
    try {
      const patientId = await getPatientId();
      const res = await callApi("patientPortal", { action: "getSnapshot", patientId });
      setSnapshot({ ...res.data, patientId });
    } catch (err) {
      setLoadError(err.message || "Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadSnapshot(); }, []);

  const handleLogout = () => signOut(auth);

  const handleEnableNotif = async () => {
    setNotifMsg("Memproses...");
    const patientId = await getPatientId();
    const result = await requestAndRegisterPush(patientId);
    if (result.ok) {
      setNotifStatus("granted");
      setNotifMsg("Notifikasi aktif. Anda akan diberi tahu jika ada hal penting.");
    } else {
      setNotifMsg(result.reason);
    }
  };

  const handleCheckinSubmit = async () => {
    setCheckinSubmitting(true);
    try {
      const patientId = await getPatientId();
      await callApi("patientPortal", { action: "submitCheckin", patientId, answers: checkinAnswers });
      setCheckinDone(true);
      await loadSnapshot();
    } catch (err) {
      alert(err.message || "Gagal mengirim check-in.");
    } finally {
      setCheckinSubmitting(false);
    }
  };

  const handleMonitoringSubmit = async () => {
    setMonitoringSubmitting(true);
    setMonitoringMsg("");
    try {
      const patientId = await getPatientId();
      const entries = [];
      if (monitoringForm.parameterType === "systolicBP") {
        entries.push({ parameterType: "systolicBP", value: Number(monitoringForm.value), unit: "mmHg", symptom: monitoringForm.symptom || null });
        if (monitoringForm.diastolic) {
          entries.push({ parameterType: "diastolicBP", value: Number(monitoringForm.diastolic), unit: "mmHg" });
        }
      } else {
        entries.push({ parameterType: "bloodGlucose", value: Number(monitoringForm.value), unit: "mg/dL", symptom: monitoringForm.symptom || null });
      }
      const res = await callApi("patientPortal", { action: "submitMonitoring", patientId, entries });
      setMonitoringMsg(`Tersimpan. Status keselamatan Anda: ${STATUS_MAP[res.data.currentSafetyStatus]?.label || res.data.currentSafetyStatus}`);
      setMonitoringForm({ parameterType: "systolicBP", value: "", diastolic: "", symptom: "" });
      await loadSnapshot();
    } catch (err) {
      setMonitoringMsg("Gagal menyimpan: " + (err.message || "terjadi kesalahan."));
    } finally {
      setMonitoringSubmitting(false);
    }
  };

  const loadHistory = async () => {
    setView("history");
    if (summary) return;
    try {
      const patientId = await getPatientId();
      const res = await callApi("patientPortal", { action: "getSummary", patientId, days: 14 });
      setSummary(res.data);
    } catch (err) {
      setSummary({ error: err.message });
    }
  };

  if (loading) return <div className="portal-shell portal-center"><p>Memuat...</p></div>;
  if (loadError) return <div className="portal-shell portal-center"><p className="portal-error">{loadError}</p></div>;

  const statusInfo = STATUS_MAP[snapshot?.currentSafetyStatus] || STATUS_MAP.SAFE;
  const plan = snapshot?.plan;

  return (
    <div className="portal-shell">
      <header className="portal-header">
        <h2>My NCD Safety</h2>
        <button className="portal-link-btn" onClick={handleLogout}>Keluar</button>
      </header>

      {view === "home" && (
        <>
          {!isStandalone && (canInstall || isIOS) && (
            <div className="portal-info-card">
              {canInstall ? (
                <>
                  📲 Biar lebih gampang dibuka lagi nanti, aplikasi ini bisa dipasang di HP Anda.
                  <button className="portal-primary-btn" style={{ marginTop: 8 }} onClick={promptInstall}>
                    Instal Aplikasi
                  </button>
                </>
              ) : isIOS ? (
                <>📲 Untuk memasang di iPhone: tap ikon <b>Bagikan (Share)</b> di Safari, lalu pilih <b>"Add to Home Screen"</b>.</>
              ) : null}
            </div>
          )}

          {notifStatus !== "granted" && notifStatus !== "unsupported" && (
            <div className="portal-info-card">
              🔔 Aktifkan notifikasi supaya diberi tahu kalau ada hal yang perlu perhatian, atau pengingat kontrol mandiri.
              <button className="portal-primary-btn" style={{ marginTop: 8 }} onClick={handleEnableNotif}>
                Aktifkan Notifikasi
              </button>
              {notifMsg && <p className="portal-sub" style={{ marginTop: 6 }}>{notifMsg}</p>}
            </div>
          )}

          <div className="portal-status-card" style={{ borderColor: statusInfo.color }}>
            <div style={{ fontSize: 40 }}>{statusInfo.emoji}</div>
            <div style={{ color: statusInfo.color, fontWeight: 700, fontSize: 18 }}>{statusInfo.label}</div>
            <div className="portal-sub">Status Keselamatan Saya</div>
          </div>

          {snapshot?.nextFollowup && (
            <div className="portal-info-card">
              📅 Kontrol berikutnya: <b>{snapshot.nextFollowup.dueDate}</b>
              {snapshot.nextFollowup.status === "overdue" && <div className="portal-error">Sudah lewat jadwal — segera hubungi RS.</div>}
            </div>
          )}

          <div className="portal-menu-grid">
            <button className="portal-menu-btn" onClick={() => { setCheckinDone(false); setCheckinAnswers({}); setView("checkin"); }}>
              ✅<br />Safety Check-In
            </button>
            <button className="portal-menu-btn" onClick={() => setView("monitoring")}>
              📊<br />Kontrol Saya (Isi Hasil)
            </button>
            <button className="portal-menu-btn" onClick={() => setView("plan")}>
              📋<br />Safety Plan Saya
            </button>
            <button className="portal-menu-btn" onClick={loadHistory}>
              🕘<br />Riwayat Monitoring
            </button>
            <button className="portal-menu-btn" onClick={() => setView("help")}>
              🆘<br />Bantuan / Tanda Bahaya
            </button>
          </div>
        </>
      )}

      {view === "checkin" && (
        <div className="portal-card">
          <h3>Safety Check-In (±30 detik)</h3>
          {checkinDone ? (
            <>
              <p>Terima kasih, jawaban Anda sudah tersimpan.</p>
              <button className="portal-primary-btn" onClick={() => setView("home")}>Kembali</button>
            </>
          ) : (
            <>
              {CHECKIN_QUESTIONS.map((q) => (
                <div key={q.key} className="portal-question">
                  <div>{q.text}</div>
                  <div className="portal-yn">
                    <button className={checkinAnswers[q.key] === true ? "portal-yn-active" : ""} onClick={() => setCheckinAnswers((a) => ({ ...a, [q.key]: true }))}>Ya</button>
                    <button className={checkinAnswers[q.key] === false ? "portal-yn-active" : ""} onClick={() => setCheckinAnswers((a) => ({ ...a, [q.key]: false }))}>Tidak</button>
                  </div>
                </div>
              ))}
              <button className="portal-primary-btn" disabled={checkinSubmitting} onClick={handleCheckinSubmit}>
                {checkinSubmitting ? "Mengirim..." : "Kirim Check-In"}
              </button>
              <button className="portal-link-btn" onClick={() => setView("home")}>Batal</button>
            </>
          )}
        </div>
      )}

      {view === "monitoring" && (
        <div className="portal-card">
          <h3>Isi Hasil Kontrol Saya</h3>
          <div className="portal-field">
            <label>Jenis Pemeriksaan</label>
            <select value={monitoringForm.parameterType} onChange={(e) => setMonitoringForm((f) => ({ ...f, parameterType: e.target.value }))}>
              <option value="systolicBP">Tekanan Darah</option>
              <option value="bloodGlucose">Gula Darah</option>
            </select>
          </div>
          {monitoringForm.parameterType === "systolicBP" ? (
            <>
              <div className="portal-field"><label>Sistolik (atas)</label><input type="number" value={monitoringForm.value} onChange={(e) => setMonitoringForm((f) => ({ ...f, value: e.target.value }))} /></div>
              <div className="portal-field"><label>Diastolik (bawah)</label><input type="number" value={monitoringForm.diastolic} onChange={(e) => setMonitoringForm((f) => ({ ...f, diastolic: e.target.value }))} /></div>
            </>
          ) : (
            <div className="portal-field"><label>Nilai Gula Darah (mg/dL)</label><input type="number" value={monitoringForm.value} onChange={(e) => setMonitoringForm((f) => ({ ...f, value: e.target.value }))} /></div>
          )}
          <div className="portal-field"><label>Keluhan (opsional)</label><input value={monitoringForm.symptom} onChange={(e) => setMonitoringForm((f) => ({ ...f, symptom: e.target.value }))} /></div>
          {monitoringMsg && <p>{monitoringMsg}</p>}
          <button className="portal-primary-btn" disabled={monitoringSubmitting} onClick={handleMonitoringSubmit}>
            {monitoringSubmitting ? "Menyimpan..." : "Simpan"}
          </button>
          <button className="portal-link-btn" onClick={() => setView("home")}>Kembali</button>
        </div>
      )}

      {view === "plan" && (
        <div className="portal-card">
          <h3>Safety Plan Saya</h3>
          {!plan ? (
            <p>Belum ada safety plan aktif. Tanyakan ke petugas/dokter saat kontrol berikutnya.</p>
          ) : (
            <>
              <p><b>Obat Saya:</b><br />{plan.medicationPlan || "-"}</p>
              <p><b>Kontrol yang Perlu Dipantau:</b><br />{(plan.monitoringParameters || []).join(", ")} ({plan.monitoringFrequency || "-"})</p>
              <p><b>Tanda Bahaya:</b><br />{plan.warningSigns || "-"}</p>
              <p><b>Jika Terjadi Tanda Bahaya:</b><br />{plan.escalationInstruction || "-"}</p>
            </>
          )}
          <button className="portal-link-btn" onClick={() => setView("home")}>Kembali</button>
        </div>
      )}

      {view === "history" && (
        <div className="portal-card">
          <h3>Riwayat Monitoring (14 hari terakhir)</h3>
          {!summary ? <p>Memuat...</p> : summary.error ? <p className="portal-error">{summary.error}</p> : (
            <>
              {summary.monitoringEntries.length === 0 && <p>Belum ada data.</p>}
              {summary.monitoringEntries.slice().reverse().map((e) => (
                <div key={e.id} className="portal-history-row">
                  {e.parameterType}: <b>{e.value} {e.unit}</b>
                  {e.symptom && <span> — {e.symptom}</span>}
                </div>
              ))}
            </>
          )}
          <button className="portal-link-btn" onClick={() => setView("home")}>Kembali</button>
        </div>
      )}

      {view === "help" && (
        <div className="portal-card">
          <h3>Bantuan / Tanda Bahaya</h3>
          <p>Jika Anda mengalami salah satu hal berikut, segera hubungi IGD RSUD Kabupaten Rejang Lebong atau layanan darurat terdekat:</p>
          <ul>
            <li>Nyeri dada hebat / sesak napas berat</li>
            <li>Kelemahan anggota gerak atau bicara pelo mendadak</li>
            <li>Penurunan kesadaran</li>
            <li>Gula darah sangat rendah/tinggi disertai gejala berat</li>
          </ul>
          <p>Aplikasi ini adalah alat bantu pemantauan, <b>bukan pengganti</b> penilaian tenaga kesehatan.</p>
          <button className="portal-link-btn" onClick={() => setView("home")}>Kembali</button>
        </div>
      )}
    </div>
  );
}
