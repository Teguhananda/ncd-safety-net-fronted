import { useEffect, useRef, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../../lib/firebaseApp"; // REVISI PERFORMA: tanpa Firestore
import { callApi } from "../../lib/api";
import { usePortalPwa } from "../../pwa/usePortalPwa";
import { requestAndRegisterPush, refreshPushTokenSilently, listenForegroundMessages } from "../../lib/push";
import "../../portal-styles.css";

const STATUS_MAP = {
  SAFE: { emoji: "🟢", label: "AMAN", color: "#34d399" },
  ATTENTION: { emoji: "🟡", label: "PERLU PERHATIAN", color: "#f5a623" },
  ACTION_NEEDED: { emoji: "🟠", label: "PERLU TINDAKAN", color: "#f2994a" },
  URGENT: { emoji: "🔴", label: "SEGERA HUBUNGI RS", color: "#ff5c50" },
};

const PARAM_LABEL_ID = {
  systolicBP: "Tensi (Sistolik)",
  diastolicBP: "Tensi (Diastolik)",
  bloodGlucose: "Gula Darah",
};

const NOTIF_SEEN_KEY = "ncdPortalNotifSeenAt";

// ==== BAGIAN BARU: kartu "Jadwal Hari Ini" (obat + TTV) ====
const SLOT_LABEL = { pagi: "Pagi (07:00)", siang: "Siang (12:00)", malam: "Malam (19:00)" };
// REVISI (Sept 2026): jam minum bisa berbeda per obat — label memakai jam
// dari server (mis. "Pagi 05.00"); SLOT_LABEL di atas hanya cadangan
// kalau server belum di-update.
const SLOT_NAME = { pagi: "Pagi", siang: "Siang", malam: "Malam" };
function slotLabel(slot, time) {
  return time ? `${SLOT_NAME[slot] || slot} ${time}` : (SLOT_LABEL[slot] || slot);
}

// ==== REVISI (Sept 2026): tombol konfirmasi obat ====
// - Tombol muncul begitu jadwal tiba (due, dihitung server), TIDAK perlu
//   menunggu notifikasi pengingat terkirim.
// - Ada 2 pilihan: "Sudah Minum" dan "Tidak Minum" (wajib pilih alasan).
const SKIP_REASONS = [
  { value: "lupa", label: "Lupa" },
  { value: "obat_habis", label: "Obat habis" },
  { value: "efek_samping", label: "Ada efek samping / keluhan setelah minum" },
  { value: "merasa_sehat", label: "Merasa sudah sehat" },
  { value: "lainnya", label: "Alasan lain" },
];
const SKIP_REASON_LABEL = Object.fromEntries(SKIP_REASONS.map((r) => [r.value, r.label]));

// Pesan keselamatan setelah pasien memilih "Tidak Minum" — sesuai alasan.
const SKIP_ADVICE = {
  lupa: "Jangan minum dobel di jadwal berikutnya. Minum obat berikutnya seperti biasa sesuai jadwal.",
  obat_habis: "Segera hubungi RSUD atau puskesmas terdekat untuk menebus obat. Jangan minum dobel di jadwal berikutnya.",
  efek_samping: "Hubungi RSUD untuk konsultasi sebelum minum obat ini lagi. Jika keluhan berat (sesak napas, bengkak di wajah/bibir, pingsan), segera ke IGD.",
  merasa_sehat: "Obat tekanan darah dan gula darah tetap perlu diminum walau badan terasa sehat, kecuali dokter yang menghentikan. Bicarakan dengan petugas saat kontrol. Jangan minum dobel di jadwal berikutnya.",
  lainnya: "Jangan minum dobel di jadwal berikutnya. Jika ragu, tanyakan ke petugas RSUD.",
};

function SlotButton({ slot, time, status, due, skipReason, onTaken, onSkip, busy }) {
  const label = slotLabel(slot, time);
  if (status === "confirmed_taken") {
    return (
      <span className="portal-yn-active" style={{ padding: "8px 14px", borderRadius: 999, fontSize: 14, display: "inline-block" }}>
        ✅ {label} — Sudah Minum
      </span>
    );
  }
  if (status === "confirmed_skipped") {
    return (
      <span className="portal-dose-skipped">
        ⏭️ {label} — Tidak Minum{skipReason ? ` (${SKIP_REASON_LABEL[skipReason] || skipReason})` : ""}
      </span>
    );
  }
  if (due || status === "sent" || status === "send_failed") {
    return (
      <div className="portal-dose-row">
        <div className="portal-dose-label">{label}</div>
        <div className="portal-dose-actions">
          <button className="portal-primary-btn portal-dose-btn" disabled={busy} onClick={onTaken}>
            ✅ Sudah Minum
          </button>
          <button className="portal-dose-skip-btn" disabled={busy} onClick={onSkip}>
            Tidak Minum
          </button>
        </div>
      </div>
    );
  }
  return (
    <span className="portal-sub" style={{ fontSize: 13, padding: "8px 10px", display: "inline-block" }}>
      {label}: belum waktunya
    </span>
  );
}

function renderMultiPoint(text) {
  if (!text) return "-";
  let parts = text.split(/\r?\n+/).map((s) => s.trim()).filter(Boolean);
  if (parts.length <= 1) {
    const bySplit = text.split(/(?=\d+\.\s)/).map((s) => s.trim()).filter(Boolean);
    if (bySplit.length > 1) parts = bySplit;
  }
  if (parts.length <= 1) return <div>{text}</div>;
  return parts.map((p, i) => <div key={i} style={{ marginBottom: 6 }}>{p}</div>);
}

// ==== BAGIAN BARU: ilustrasi SVG custom per-menu — gaya garis minimalis
// (bukan gambar impor, supaya ringan & tajam di layar apa pun, tanpa
// butuh internet untuk memuat gambar). Warna ikon ikut warna teks
// (currentColor) sehingga otomatis pas dengan lencana bulat di CSS.
function IconCheckIn() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="4" width="14" height="17" rx="2.5" />
      <path d="M9 3.5h6a1 1 0 0 1 1 1V6H8V4.5a1 1 0 0 1 1-1Z" />
      <path d="m9 13 2 2 4-4.5" />
    </svg>
  );
}
function IconMonitoring() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 13h3.5l2-5 3 9 2-7 1.5 3H21" />
      <circle cx="12" cy="12" r="9.5" />
    </svg>
  );
}
function IconSafetyPlan() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3.5c3 1.4 5 1.7 7 1.7v6.3c0 5-3 8-7 9.2-4-1.2-7-4.2-7-9.2V5.2c2 0 4-.3 7-1.7Z" />
      <path d="M8.8 12.2h6.4M8.8 15.2h4.4" />
    </svg>
  );
}
function IconHistory() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="13" r="8.5" />
      <path d="M12 8.5V13l3.2 2" />
      <path d="M9 2.5h6" />
    </svg>
  );
}
function IconHelp() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3.5c3 1.4 5 1.7 7 1.7v6.3c0 5-3 8-7 9.2-4-1.2-7-4.2-7-9.2V5.2c2 0 4-.3 7-1.7Z" />
      <path d="M12 9.5v4M12 16.3h.01" />
    </svg>
  );
}
function IconStatus() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 13h3.5l2-5 3 9 2-7 1.5 3H21" />
      <path d="M12 3.5c3 1.4 5 1.7 7 1.7v6.3c0 5-3 8-7 9.2-4-1.2-7-4.2-7-9.2V5.2c2 0 4-.3 7-1.7Z" opacity="0.35" />
    </svg>
  );
}

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
  const [view, setView] = useState("home");
  const [checkinAnswers, setCheckinAnswers] = useState({});
  const [checkinSubmitting, setCheckinSubmitting] = useState(false);
  const [checkinDone, setCheckinDone] = useState(false);
  const [monitoringForm, setMonitoringForm] = useState({ parameterType: "systolicBP", value: "", diastolic: "", symptom: "" });
  const [monitoringSubmitting, setMonitoringSubmitting] = useState(false);
  const [monitoringMsg, setMonitoringMsg] = useState("");
  const [summary, setSummary] = useState(null);
  // BAGIAN BARU: jadwal obat + status TTV hari ini, untuk kartu "Jadwal Hari Ini"
  const [todayReminders, setTodayReminders] = useState(null);

  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [notifList, setNotifList] = useState([]);
  const [notifUnreadCount, setNotifUnreadCount] = useState(0);
  // BARU: pop-up kecil di dalam aplikasi saat ada notifikasi masuk
  // ketika Portal sedang dibuka.
  const [incomingToast, setIncomingToast] = useState(null);
  // BARU: alur "Tidak Minum" — obat yang sedang dipilih alasannya, dan
  // hasil (untuk menampilkan pesan keselamatan).
  const [skipTarget, setSkipTarget] = useState(null); // { medicationId, name, slot }
  const [skipDone, setSkipDone] = useState(null); // { name, reason }
  const [doseBusy, setDoseBusy] = useState(false);

  function applyNotifications(summaryData) {
      const signalItems = (summaryData.signals || [])
        .filter((s) => s.status && s.status !== "SAFE")
        .map((s) => ({ kind: "signal", date: s.detectedAt, ...s }));

      const messageItems = (summaryData.messages || [])
        .map((m) => ({ kind: "message", date: m.sentAt, ...m }));

      const combined = [...signalItems, ...messageItems].sort((a, b) => new Date(b.date) - new Date(a.date));
      setNotifList(combined);

      const seenAt = localStorage.getItem(NOTIF_SEEN_KEY);
      const unread = seenAt ? combined.filter((n) => new Date(n.date) > new Date(seenAt)).length : combined.length;
      setNotifUnreadCount(unread);
  }

  async function loadNotifications() {
    try {
      const patientId = await getPatientId();
      const res = await callApi("patientPortal", { action: "getSummary", patientId, days: 30 });
      applyNotifications(res.data);
    } catch {
      // Gagal muat notifikasi bukan hal fatal.
    }
  }

  const handleToggleNotifPanel = () => {
    setNotifPanelOpen((open) => {
      const next = !open;
      if (next) {
        localStorage.setItem(NOTIF_SEEN_KEY, new Date().toISOString());
        setNotifUnreadCount(0);
      }
      return next;
    });
  };

  const openNotifPanel = () => {
    localStorage.setItem(NOTIF_SEEN_KEY, new Date().toISOString());
    setNotifUnreadCount(0);
    setIncomingToast(null);
    setNotifPanelOpen(true);
  };

  // BARU: kunci scroll halaman di belakang saat panel notifikasi terbuka.
  useEffect(() => {
    if (!notifPanelOpen && !skipTarget && !skipDone) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [notifPanelOpen, skipTarget, skipDone]);

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

  // BAGIAN BARU: muat jadwal obat + status TTV hari ini untuk kartu
  // "Jadwal Hari Ini" di home. Gagal muat bukan hal fatal (kartu ini
  // opsional) — sama seperti loadNotifications.
  async function loadTodayReminders() {
    try {
      const patientId = await getPatientId();
      const res = await callApi("patientPortal", { action: "getTodayReminders", patientId });
      setTodayReminders(res.data);
    } catch {
      // diamkan, bukan hal fatal
    }
  }

  // ==== REVISI PERFORMA (Sept 2026): SATU panggilan untuk seluruh isi
  // halaman utama (action "getHome") — sebelumnya 3 panggilan terpisah
  // (getSnapshot + getSummary + getTodayReminders). Kalau server ternyata
  // belum di-update (action getHome belum dikenal), otomatis kembali ke
  // cara lama, jadi urutan deploy backend/frontend tidak jadi masalah.
  async function loadHome() {
    setLoading(true);
    setLoadError("");
    try {
      const patientId = await getPatientId();
      const res = await callApi("patientPortal", { action: "getHome", patientId, days: 30 });
      const { snapshot: snap, summary: sum, today } = res.data || {};
      if (!snap) throw new Error("getHome belum tersedia");
      setSnapshot({ ...snap, patientId });
      setTodayReminders(today || null);
      try { applyNotifications(sum || {}); } catch { /* bukan hal fatal */ }
      setLoading(false);
    } catch {
      await Promise.all([loadSnapshot(), loadNotifications(), loadTodayReminders()]);
    }
  }

  useEffect(() => { loadHome(); }, []);

  // ==== BARU (Sept 2026 - bug notif iPhone) ====
  // 1. Token notifikasi diperbarui diam-diam setiap Portal dibuka (tanpa
  //    pertanyaan izin), supaya token mati otomatis diganti.
  // 2. Push yang masuk saat Portal sedang dibuka → lonceng langsung
  //    ter-update + pop-up kecil muncul.
  // 3. Saat aplikasi kembali dibuka dari background → notifikasi dimuat ulang.
  // 4. Pasien mengetuk notifikasi di layar HP (link ?notif=1) → panel
  //    notifikasi langsung terbuka.
  useEffect(() => {
    let stopListening = () => {};
    let cancelled = false;

    (async () => {
      try {
        const patientId = await getPatientId();
        if (patientId) refreshPushTokenSilently(patientId);
      } catch { /* tidak fatal */ }
      const stop = await listenForegroundMessages(({ title, body }) => {
        setIncomingToast({ title, body });
        loadNotifications();
      });
      if (cancelled) stop(); else stopListening = stop;
    })();

    function onVisible() {
      if (document.visibilityState === "visible") loadNotifications();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      stopListening();
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("notif") === "1") {
      openNotifPanel();
      params.delete("notif");
      const qs = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Pop-up hilang sendiri setelah 8 detik.
  useEffect(() => {
    if (!incomingToast) return undefined;
    const t = setTimeout(() => setIncomingToast(null), 8000);
    return () => clearTimeout(t);
  }, [incomingToast]);

  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);

  useEffect(() => {
    function onTouchStart(e) {
      if (window.scrollY === 0) {
        touchStartY.current = e.touches[0].clientY;
        isPulling.current = true;
      }
    }
    function onTouchMove(e) {
      if (!isPulling.current) return;
      const distance = e.touches[0].clientY - touchStartY.current;
      if (distance > 0 && window.scrollY === 0) {
        setPullDistance(Math.min(distance * 0.5, 90));
      }
    }
    async function onTouchEnd() {
      if (!isPulling.current) return;
      isPulling.current = false;
      setPullDistance((current) => {
        if (current > 55) {
          setRefreshing(true);
          loadHome().finally(() => setRefreshing(false));
        }
        return 0;
      });
    }
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd);
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = () => signOut(auth);

  const [emergencyStep, setEmergencyStep] = useState("idle");
  const [emergencyMsg, setEmergencyMsg] = useState("");

  function getPreciseLocation() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    });
  }

  const handleEmergencyConfirm = async () => {
    setEmergencyStep("sending");
    try {
      const patientId = await getPatientId();
      const location = await getPreciseLocation();
      await callApi("patientPortal", { action: "triggerEmergency", patientId, location });
      setEmergencyStep("sent");
    } catch (err) {
      setEmergencyStep("error");
      setEmergencyMsg(err.message || "Gagal mengirim SOS. Coba lagi atau telepon langsung ke IGD.");
    }
  };

  const handleEnableNotif = async () => {
    // BARU: di iPhone, notifikasi HANYA bisa aktif kalau Portal dibuka
    // dari ikon di Layar Utama (aturan Apple), bukan dari Safari.
    if (isIOS && !isStandalone) {
      setNotifMsg("Di iPhone, pasang dulu aplikasi ke Layar Utama (tombol Bagikan → \"Add to Home Screen\"), lalu buka dari ikon tersebut dan tekan tombol ini lagi.");
      return;
    }
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

  // BAGIAN BARU: konfirmasi "Sudah Minum Obat" dari kartu Jadwal Hari Ini.
  const handleConfirmDose = async (medicationId, slot, status, reason) => {
    setDoseBusy(true);
    try {
      const patientId = await getPatientId();
      await callApi("patientPortal", { action: "confirmMedicationDose", patientId, medicationId, slot, status, reason });
      await loadTodayReminders();
      return true;
    } catch (err) {
      alert(err.message || "Gagal menyimpan konfirmasi.");
      return false;
    } finally {
      setDoseBusy(false);
    }
  };

  const handleSkipReason = async (reason) => {
    if (!skipTarget) return;
    const ok = await handleConfirmDose(skipTarget.medicationId, skipTarget.slot, "confirmed_skipped", reason);
    if (ok) {
      setSkipDone({ name: skipTarget.name, reason });
      setSkipTarget(null);
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
      await loadNotifications();
      await loadTodayReminders();
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
  const activeMeds = snapshot?.activeMedications || [];

  return (
    <div className="portal-shell">
      {(pullDistance > 0 || refreshing) && (
        <div
          style={{
            height: refreshing ? 44 : pullDistance,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            color: "var(--p-ink-soft, rgba(244,253,251,0.72))",
            transition: refreshing ? "height 0.15s ease" : "none",
            overflow: "hidden",
          }}
        >
          {refreshing ? "🔄 Memuat ulang..." : pullDistance > 55 ? "↓ Lepas untuk refresh" : "↓ Tarik untuk refresh"}
        </div>
      )}
      <header className="portal-header">
        <div className="portal-brand">
          <img src="/logos/app-logo.png" alt="My NCD Safety" className="portal-logo-img" />
          <div>
            <h2>My NCD Safety</h2>
            <div className="portal-brand-sub">RSUD KAB. REJANG LEBONG</div>
          </div>
        </div>

        <button
          onClick={handleToggleNotifPanel}
          aria-label="Notifikasi"
          style={{
            position: "relative",
            background: "none",
            border: "none",
            fontSize: 26,
            cursor: "pointer",
            padding: 6,
            lineHeight: 1,
          }}
        >
          🔔
          {notifUnreadCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: 2,
                right: 2,
                background: "#ff5c50",
                color: "#fff",
                borderRadius: "50%",
                minWidth: 16,
                height: 16,
                fontSize: 10,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 3px",
              }}
            >
              {notifUnreadCount > 9 ? "9+" : notifUnreadCount}
            </span>
          )}
        </button>
      </header>

      {/* ==== REVISI (Sept 2026): panel notifikasi jadi lembar dari bawah
          layar dengan latar SOLID (tidak transparan) + latar belakang
          digelapkan — sebelumnya kartu kaca transparan menumpuk di atas
          header & kartu status sehingga tulisan sulit dibaca. ==== */}
      {notifPanelOpen && (
        <div className="portal-sheet-overlay" onClick={() => setNotifPanelOpen(false)}>
          <div
            className="portal-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="portal-sheet-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="portal-sheet-handle" aria-hidden="true" />
            <div className="portal-sheet-head">
              <h3 id="portal-sheet-title">Notifikasi</h3>
              <button className="portal-sheet-close" onClick={() => setNotifPanelOpen(false)} aria-label="Tutup notifikasi">✕</button>
            </div>
            <div className="portal-sheet-body">
              {notifList.length === 0 ? (
                <p className="portal-sub">Belum ada notifikasi.</p>
              ) : (
                notifList.map((n) => {
                  const when = n.date ? new Date(n.date).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "-";
                  if (n.kind === "message") {
                    return (
                      <div key={`msg-${n.id}`} className="portal-notif-item">
                        <div className="portal-notif-meta">
                          <span className="portal-notif-kind" style={{ color: "var(--p-accent)" }}>💬 Pesan dari RS</span>
                          <span className="portal-notif-time">{when}</span>
                        </div>
                        <div className="portal-notif-text">{n.message}</div>
                      </div>
                    );
                  }
                  const info = STATUS_MAP[n.status] || STATUS_MAP.ATTENTION;
                  return (
                    <div key={`sig-${n.id}`} className="portal-notif-item" style={{ borderLeftColor: info.color }}>
                      <div className="portal-notif-meta">
                        <span className="portal-notif-kind" style={{ color: info.color }}>{info.emoji} {info.label}</span>
                        <span className="portal-notif-time">{when}</span>
                      </div>
                      {Array.isArray(n.reason) && n.reason.length > 0 && (
                        <div className="portal-notif-text">{n.reason[0]}</div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* BARU: pilih alasan "Tidak Minum" (sekali ketuk), lalu pesan keselamatan */}
      {(skipTarget || skipDone) && (
        <div className="portal-sheet-overlay" onClick={() => { if (!doseBusy) { setSkipTarget(null); setSkipDone(null); } }}>
          <div className="portal-sheet" role="dialog" aria-modal="true" aria-labelledby="portal-skip-title" onClick={(e) => e.stopPropagation()}>
            <div className="portal-sheet-handle" aria-hidden="true" />
            {skipTarget ? (
              <>
                <div className="portal-sheet-head">
                  <h3 id="portal-skip-title">Kenapa tidak minum?</h3>
                  <button className="portal-sheet-close" disabled={doseBusy} onClick={() => setSkipTarget(null)} aria-label="Batal">✕</button>
                </div>
                <div className="portal-sheet-body">
                  <p className="portal-notif-text" style={{ marginTop: 12 }}>
                    <b>{skipTarget.name}</b> — jadwal {slotLabel(skipTarget.slot, skipTarget.time)}
                  </p>
                  {SKIP_REASONS.map((r) => (
                    <button key={r.value} className="portal-reason-btn" disabled={doseBusy} onClick={() => handleSkipReason(r.value)}>
                      {r.label}
                    </button>
                  ))}
                  {doseBusy && <p className="portal-sub">Menyimpan...</p>}
                </div>
              </>
            ) : (
              <>
                <div className="portal-sheet-head">
                  <h3 id="portal-skip-title">Sudah dicatat</h3>
                  <button className="portal-sheet-close" onClick={() => setSkipDone(null)} aria-label="Tutup">✕</button>
                </div>
                <div className="portal-sheet-body">
                  <div className="portal-notif-item" style={{ borderLeftColor: skipDone.reason === "efek_samping" ? "#ff5c50" : "#f5934a" }}>
                    <div className="portal-notif-kind" style={{ color: skipDone.reason === "efek_samping" ? "#ff8a80" : "#f5a623" }}>⚠️ Penting</div>
                    <div className="portal-notif-text">{SKIP_ADVICE[skipDone.reason] || SKIP_ADVICE.lainnya}</div>
                  </div>
                  {(skipDone.reason === "efek_samping" || skipDone.reason === "obat_habis") && (
                    <button className="portal-primary-btn" onClick={() => { setSkipDone(null); setView("help"); }}>
                      Lihat Kontak & Tanda Bahaya
                    </button>
                  )}
                  <button className="portal-link-btn" onClick={() => setSkipDone(null)}>Mengerti</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* BARU: pop-up saat notifikasi masuk ketika Portal sedang dibuka */}
      {incomingToast && !notifPanelOpen && (
        <button className="portal-toast" onClick={openNotifPanel}>
          <span className="portal-toast-title">🔔 {incomingToast.title}</span>
          {incomingToast.body && <span className="portal-toast-body">{incomingToast.body}</span>}
          <span className="portal-toast-hint">Ketuk untuk membuka</span>
        </button>
      )}

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
            <div className="portal-status-icon-wrap" style={{ color: statusInfo.color }}>
              <IconStatus />
            </div>
            <div className="portal-status-label" style={{ color: statusInfo.color }}>{statusInfo.label}</div>
            <div className="portal-sub">Status Keselamatan Saya</div>
          </div>

          {/* BAGIAN BARU: kartu Jadwal Hari Ini — obat (checkbox slot dari
              Screening.jsx) + TTV (dari Safety Plan). Disembunyikan total
              kalau pasien tidak punya obat berjadwal maupun parameter TTV
              yang perlu dipantau, supaya tidak jadi kartu kosong. */}
          {todayReminders && (todayReminders.medications.length > 0 || (todayReminders.ttv.parameters || []).length > 0) && (
            <div className="portal-card">
              <h3 style={{ marginTop: 0 }}>📋 Jadwal Hari Ini</h3>
              {todayReminders.medications.map((m) => (
                <div key={m.id} style={{ marginBottom: 14 }}>
                  <div style={{ fontWeight: 600 }}>{m.name}{m.dose ? ` — ${m.dose}` : ""}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                    {m.slots.map((s) => (
                      <SlotButton
                        key={s.slot}
                        slot={s.slot}
                        time={s.time}
                        status={s.status}
                        due={s.due}
                        skipReason={s.skipReason}
                        busy={doseBusy}
                        onTaken={() => handleConfirmDose(m.id, s.slot, "confirmed_taken")}
                        onSkip={() => { setSkipDone(null); setSkipTarget({ medicationId: m.id, name: `${m.name}${m.dose ? " " + m.dose : ""}`, slot: s.slot, time: s.time }); }}
                      />
                    ))}
                  </div>
                </div>
              ))}
              {(todayReminders.ttv.parameters || []).length > 0 && (
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Cek TTV Hari Ini</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {todayReminders.ttv.parameters.map((p) => (
                      <button
                        key={p}
                        className={todayReminders.ttv.doneToday[p] ? "portal-yn-active" : "portal-primary-btn"}
                        style={{ fontSize: 13, padding: "8px 14px" }}
                        disabled={!!todayReminders.ttv.doneToday[p]}
                        onClick={() => setView("monitoring")}
                      >
                        {todayReminders.ttv.doneToday[p] ? `✅ ${PARAM_LABEL_ID[p] || p} — Sudah Periksa` : `Isi ${PARAM_LABEL_ID[p] || p}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {snapshot?.nextFollowup && (
            <div className="portal-info-card">
              📅 Kontrol berikutnya: <b>{snapshot.nextFollowup.dueDate}</b>
              {snapshot.nextFollowup.status === "overdue" && <div className="portal-error">Sudah lewat jadwal — segera hubungi RS.</div>}
            </div>
          )}

          <div className="portal-menu-grid">
            <button className="portal-menu-btn" onClick={() => { setCheckinDone(false); setCheckinAnswers({}); setView("checkin"); }}>
              <span className="portal-menu-illustration"><IconCheckIn /></span>
              Safety Check-In
            </button>
            <button className="portal-menu-btn" onClick={() => setView("monitoring")}>
              <span className="portal-menu-illustration"><IconMonitoring /></span>
              Kontrol Saya (Isi Hasil)
            </button>
            <button className="portal-menu-btn" onClick={() => setView("plan")}>
              <span className="portal-menu-illustration"><IconSafetyPlan /></span>
              Safety Plan Saya
            </button>
            <button className="portal-menu-btn" onClick={loadHistory}>
              <span className="portal-menu-illustration"><IconHistory /></span>
              Riwayat Monitoring
            </button>
            <button className="portal-menu-btn" onClick={() => setView("help")} style={{ gridColumn: "1 / -1" }}>
              <span className="portal-menu-illustration warm"><IconHelp /></span>
              Bantuan / Tanda Bahaya
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
          {/* BAGIAN BARU (Sept 2026): "Obat Saya" diambil dari rekonsiliasi
              obat RS (daftar yang sama dengan pengingat & "Jadwal Hari Ini"),
              bukan lagi hanya teks ketikan — supaya satu sumber dengan
              checklist obat. Teks dari form Safety Plan tetap
              ditampilkan sebagai "Catatan dari petugas". */}
          {activeMeds.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <b>Obat Saya (daftar dari petugas RSUD):</b>
              <div style={{ marginTop: 6 }}>
                {activeMeds.map((m) => (
                  <div key={m.id} style={{ marginBottom: 8 }}>
                    💊 <b>{m.name}</b>{m.dose ? ` ${m.dose}` : ""}
                    {m.slots.length > 0 && (
                      <div className="portal-sub" style={{ marginTop: 0 }}>
                        Diminum: {m.slots.map((sl) => slotLabel(sl, m.slotTimes && m.slotTimes[sl])).join(", ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {!plan ? (
            <p>Belum ada safety plan aktif. Tanyakan ke petugas/dokter saat kontrol berikutnya.</p>
          ) : (
            <>
              {(activeMeds.length === 0 || plan.medicationPlan) && (
                <div style={{ marginBottom: 16 }}>
                  <b>{activeMeds.length > 0 ? "Catatan Obat dari Petugas:" : "Obat Saya:"}</b>
                  <div style={{ marginTop: 4 }}>{renderMultiPoint(plan.medicationPlan)}</div>
                </div>
              )}
              <div style={{ marginBottom: 16 }}>
                <b>Kontrol yang Perlu Dipantau:</b>
                <div style={{ marginTop: 4 }}>
                  {(plan.monitoringParameters || []).map((p) => PARAM_LABEL_ID[p] || p).join(", ") || "-"}
                  {plan.monitoringFrequency && <span> ({plan.monitoringFrequency})</span>}
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <b>Tanda Bahaya:</b>
                <div style={{ marginTop: 4 }}>{renderMultiPoint(plan.warningSigns)}</div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <b>Jika Terjadi Tanda Bahaya:</b>
                <div style={{ marginTop: 4 }}>{renderMultiPoint(plan.escalationInstruction)}</div>
              </div>
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
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{PARAM_LABEL_ID[e.parameterType] || e.parameterType}: <b>{e.value} {e.unit}</b></span>
                    <span className="portal-sub" style={{ fontSize: 12 }}>
                      {e.timestamp ? new Date(e.timestamp).toLocaleString("id-ID", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-"}
                    </span>
                  </div>
                  {e.symptom && <div className="portal-sub" style={{ marginTop: 2 }}>Keluhan: {e.symptom}</div>}
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

          <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--p-glass-border)" }}>
            {emergencyStep === "idle" && (
              <button
                className="portal-primary-btn"
                style={{ background: "linear-gradient(135deg, #ff5c50, #c0392b)", fontSize: 19, minHeight: 60 }}
                onClick={() => setEmergencyStep("confirm")}
              >
                🆘 TOMBOL EMERGENCY
              </button>
            )}
            {emergencyStep === "confirm" && (
              <div className="portal-info-card" style={{ borderColor: "#ff5c50" }}>
                <p style={{ fontWeight: 700, marginTop: 0 }}>Yakin ingin mengirim SOS Darurat?</p>
                <p className="portal-sub">Dokter, Case Manager, dan tim ambulans akan SEGERA diberitahu untuk menghubungi Anda, <b>termasuk lokasi HP Anda saat ini</b> (kalau GPS aktif). Hanya tekan ini kalau kondisi Anda benar-benar darurat.</p>
                <button className="portal-primary-btn" style={{ background: "linear-gradient(135deg, #ff5c50, #c0392b)" }} onClick={handleEmergencyConfirm}>
                  Ya, Kirim SOS Sekarang
                </button>
                <button className="portal-link-btn" onClick={() => setEmergencyStep("idle")}>Batal</button>
              </div>
            )}
            {emergencyStep === "sending" && <p>Mengirim SOS...</p>}
            {emergencyStep === "sent" && (
              <div className="portal-info-card" style={{ borderColor: "var(--p-accent)" }}>
                <p style={{ fontWeight: 700, marginTop: 0 }}>✅ SOS Terkirim</p>
                <p className="portal-sub">Tim medis sedang diberitahu dan akan segera menghubungi Anda. Kalau kondisi memburuk sebelum dihubungi, segera ke IGD RSUD Kab. Rejang Lebong.</p>
              </div>
            )}
            {emergencyStep === "error" && (
              <div className="portal-info-card" style={{ borderColor: "#ff5c50" }}>
                <p className="portal-error">{emergencyMsg}</p>
                <button className="portal-primary-btn" style={{ background: "linear-gradient(135deg, #ff5c50, #c0392b)" }} onClick={handleEmergencyConfirm}>
                  Coba Lagi
                </button>
              </div>
            )}
          </div>

          <button className="portal-link-btn" onClick={() => { setView("home"); setEmergencyStep("idle"); }}>Kembali</button>
        </div>
      )}

      <button
        onClick={handleLogout}
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          zIndex: 30,
          background: "rgba(20, 30, 45, 0.9)",
          color: "var(--p-accent, #34d399)",
          border: "1px solid var(--p-glass-border, rgba(255,255,255,0.15))",
          borderRadius: 999,
          padding: "10px 18px",
          fontSize: 14,
          fontWeight: 600,
          boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
          cursor: "pointer",
        }}
      >
        Keluar
      </button>
    </div>
  );
}
