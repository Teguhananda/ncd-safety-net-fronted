import { useEffect, useRef, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../../lib/firebaseApp"; // REVISI PERFORMA: tanpa Firestore
import { callApi } from "../../lib/api";
import { usePortalPwa } from "../../pwa/usePortalPwa";
import { requestAndRegisterPush, refreshPushTokenSilently, listenForegroundMessages } from "../../lib/push";
import "../../portal-styles.css";
import { SOS_ENABLED } from "../../lib/features";

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

// ==== BARU (Sept 2026): layar peringatan hasil TTV ====
// level "critical" = batas berbahaya (bingkai berkedip merah-biru),
// level "high" = di atas batas (oranye, tanpa kedip). Bahasa sengaja
// tenang & jelas — pasien lansia yang panik bisa menaikkan tensinya.
// Isi saran BUKAN diagnosis; mengarahkan ke fasilitas kesehatan.
const DANGER_SIGNS_BP = [
  "Nyeri dada atau sesak napas",
  "Lemah/kesemutan separuh badan, wajah mencong, atau bicara pelo",
  "Sakit kepala hebat, pandangan kabur, atau bingung",
  "Mual-muntah hebat atau pingsan",
];
const DANGER_SIGNS_GLUCOSE_HIGH = [
  "Sangat haus dan sering buang air kecil",
  "Mual-muntah, nyeri perut, atau napas cepat/berbau buah",
  "Sangat lemas, mengantuk berat, atau bingung",
];
function vitalsAdvice(alert) {
  if (!alert) return null;
  if (alert.level === "critical" && alert.kind === "glucose_low") {
    return {
      title: "Gula darah Anda rendah",
      steps: [
        "Segera makan atau minum yang manis sesuai edukasi petugas (mis. teh manis, air gula, atau permen), lalu duduk dan istirahat.",
        "Cek ulang gula darah 15 menit lagi.",
        "Jika tidak membaik, bingung, kejang, atau sulit dibangunkan: segera minta keluarga mengantar ke UGD RSUD Kab. Rejang Lebong atau UGD rumah sakit terdekat.",
      ],
      signs: null,
    };
  }
  if (alert.level === "critical") {
    const isBp = alert.kind === "bp_high";
    return {
      title: isBp ? "Tekanan darah Anda sangat tinggi" : "Gula darah Anda sangat tinggi",
      steps: [
        "Tetap tenang. Duduk dan istirahat 5 menit, lalu ukur ulang.",
        "Walaupun belum ada keluhan, segera periksakan diri ke puskesmas, klinik, atau rumah sakit terdekat hari ini. Jangan menunggu jadwal kontrol.",
        "Jangan menambah dosis obat sendiri tanpa petunjuk dokter.",
      ],
      signs: isBp ? DANGER_SIGNS_BP : DANGER_SIGNS_GLUCOSE_HIGH,
    };
  }
  return {
    title: alert.kind === "glucose_high" ? "Gula darah Anda di atas batas" : "Hasil Anda di atas batas aman",
    steps: [
      "Istirahat sebentar, lalu ukur ulang.",
      "Minum obat sesuai jadwal dan jaga makanan (kurangi garam/gula).",
      "Jika tetap tinggi beberapa hari atau muncul keluhan, hubungi RSUD atau puskesmas.",
    ],
    signs: null,
  };
}

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

// BARU (Okt 2026): ikon menu Tanya Dokter (gelembung chat + tanda plus).
function IconTanya() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4h0A1.5 1.5 0 0 1 4 14.5Z" />
      <path d="M12 6.8v5.4M9.3 9.5h5.4" />
    </svg>
  );
}

const TANYA_STATUS = {
  open: "⏳ Menunggu balasan dokter",
  awaiting_patient: "💬 Dokter sudah membalas",
  answered: "✅ Konsultasi selesai",
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

// BARU (Okt 2026): Check-In cukup sekali sehari. Penanda disimpan di perangkat
// (per pasien, tanggal WIB) supaya pasien yang mengisi tensi lalu gula darah
// tidak diminta mengisi Check-In dua kali. Bila penyimpanan gagal, paling buruk
// Check-In ditawarkan lagi.
function todayWib() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
}
function checkinKey(patientId) {
  return `ncd_checkin_${patientId}`;
}
function isCheckinDoneToday(patientId) {
  try {
    return localStorage.getItem(checkinKey(patientId)) === todayWib();
  } catch (e) {
    return false;
  }
}
function markCheckinDoneToday(patientId) {
  try {
    localStorage.setItem(checkinKey(patientId), todayWib());
  } catch (e) {
    /* abaikan */
  }
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
  // BARU (Okt 2026): terisi bila monitoring pasien sudah diakhiri (PRB).
  const [ended, setEnded] = useState(null);
  const [view, setView] = useState("home");
  const [checkinAnswers, setCheckinAnswers] = useState({});
  const [checkinSubmitting, setCheckinSubmitting] = useState(false);
  const [checkinDone, setCheckinDone] = useState(false);
  // BARU (Okt 2026): pesan hasil simpan Kontrol Saya yang ditampilkan di atas
  // Safety Check-In saat pasien diarahkan otomatis ke Check-In.
  const [checkinIntro, setCheckinIntro] = useState("");
  const [monitoringForm, setMonitoringForm] = useState({ parameterType: "systolicBP", value: "", diastolic: "", symptom: "" });
  const [monitoringSubmitting, setMonitoringSubmitting] = useState(false);
  const [monitoringMsg, setMonitoringMsg] = useState("");
  const [vitalsAlert, setVitalsAlert] = useState(null); // BARU: layar peringatan TTV
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

  // ==== BARU (Okt 2026): Tanya Dokter ====
  const [tanya, setTanya] = useState(null); // hasil getDoctorQuestions
  const [tanyaStep, setTanyaStep] = useState("precheck"); // precheck | form
  const [tanyaText, setTanyaText] = useState("");
  const [tanyaBusy, setTanyaBusy] = useState(false);
  const [tanyaMsg, setTanyaMsg] = useState("");
  const [tanyaErr, setTanyaErr] = useState("");
  const [tanyaDanger, setTanyaDanger] = useState(null); // kata tanda bahaya yang terdeteksi
  const [replyText, setReplyText] = useState({}); // { [questionId]: teks }

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
    if (!notifPanelOpen && !skipTarget && !skipDone && !vitalsAlert) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [notifPanelOpen, skipTarget, skipDone, vitalsAlert]);

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
      // BARU (Okt 2026): monitoring sudah berakhir (PRB) → tampilkan layar penutup.
      if (res.data && res.data.monitoringEnded) {
        setEnded(res.data.ended || {});
        setLoading(false);
        return;
      }
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
    // BARU (Okt 2026): ketuk notifikasi jawaban dokter → langsung ke Tanya Dokter.
    if (params.get("tanya") === "1") {
      params.delete("tanya");
      const qs = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash);
      openTanya();
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
      markCheckinDoneToday(patientId);
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
      const savedMsg = `Tersimpan. Status keselamatan Anda: ${STATUS_MAP[res.data.currentSafetyStatus]?.label || res.data.currentSafetyStatus}`;
      setMonitoringMsg(savedMsg);
      if (res.data.vitalsAlert) setVitalsAlert(res.data.vitalsAlert);
      setMonitoringForm({ parameterType: "systolicBP", value: "", diastolic: "", symptom: "" });
      // BARU: bila Check-In hari ini belum diisi, lanjut otomatis ke Safety
      // Check-In. Layar peringatan TTV (bila ada) tetap tampil di atasnya.
      if (!isCheckinDoneToday(patientId)) {
        setCheckinAnswers({});
        setCheckinDone(false);
        setCheckinIntro(savedMsg);
        setMonitoringMsg("");
        setView("checkin");
      }
      await loadSnapshot();
      await loadNotifications();
      await loadTodayReminders();
    } catch (err) {
      setMonitoringMsg("Gagal menyimpan: " + (err.message || "terjadi kesalahan."));
    } finally {
      setMonitoringSubmitting(false);
    }
  };

  // ==== BARU (Okt 2026): Tanya Dokter ====
  async function loadTanya() {
    setTanyaErr("");
    try {
      const patientId = await getPatientId();
      const res = await callApi("patientPortal", { action: "getDoctorQuestions", patientId });
      setTanya(res.data);
    } catch (err) {
      setTanya({ error: err.message || "Gagal memuat Tanyo Dokter." });
    }
  }

  const openTanya = () => {
    setTanyaStep("precheck");
    setTanyaText("");
    setTanyaMsg("");
    setTanyaErr("");
    setTanyaDanger(null);
    setView("tanya");
    loadTanya();
  };

  const goToSos = () => {
    setTanyaDanger(null);
    setEmergencyStep("idle");
    setView("help");
  };

  const handleAskDoctor = async (confirmNotEmergency = false) => {
    setTanyaBusy(true);
    setTanyaErr("");
    try {
      const patientId = await getPatientId();
      const res = await callApi("patientPortal", { action: "askDoctor", patientId, question: tanyaText, confirmNotEmergency });
      if (res.data.dangerDetected) {
        setTanyaDanger(res.data.keywords || []);
        return;
      }
      setTanyaDanger(null);
      setTanyaText("");
      setTanyaMsg(`Pertanyaan terkirim ke ${tanya?.dpjpName || "dokter Anda"}. Akan dijawab ${res.data.service?.nextOpenText || "saat dokter sempat"}.`);
      await loadTanya();
    } catch (err) {
      setTanyaErr(err.message || "Gagal mengirim pertanyaan.");
    } finally {
      setTanyaBusy(false);
    }
  };

  const handleReplyClarification = async (questionId) => {
    setTanyaBusy(true);
    setTanyaErr("");
    try {
      const patientId = await getPatientId();
      const send = (confirmNotEmergency) =>
        callApi("patientPortal", { action: "replyDoctorClarification", patientId, questionId, text: replyText[questionId] || "", confirmNotEmergency });
      let res = await send(false);
      if (res.data && res.data.dangerDetected) {
        const lanjut = window.confirm(
          `Pesan Anda menyebut tanda bahaya (${(res.data.keywords || []).join(", ")}).\n\n` +
          "Jika keluhan itu SEDANG terjadi sekarang, jangan menunggu jawaban chat — segera minta keluarga mengantar ke UGD.\n\n" +
          "Tekan OK bila BUKAN darurat dan tetap ingin mengirim pesan."
        );
        if (!lanjut) return;
        res = await send(true);
      }
      setReplyText((r) => ({ ...r, [questionId]: "" }));
      setTanyaMsg("Pesan terkirim ke dokter.");
      await loadTanya();
    } catch (err) {
      setTanyaErr(err.message || "Gagal mengirim balasan.");
    } finally {
      setTanyaBusy(false);
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

  // BARU (Okt 2026): layar penutup untuk pasien yang sudah PRB. Tidak ada
  // tombol SOS maupun isian TTV di sini — server juga menolak semuanya.
  if (ended) {
    return (
      <div className="portal-shell portal-center" style={{ textAlign: "center", padding: 24 }}>
        <div style={{ maxWidth: 420 }}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>🏥</div>
          <h2 style={{ marginTop: 0 }}>Monitoring Telah Berakhir</h2>
          <p style={{ lineHeight: 1.6 }}>
            Monitoring mandiri dari RSUD Kab. Rejang Lebong untuk Anda sudah berakhir
            {ended.endDate ? ` (sejak ${ended.endDate})` : ""}.
          </p>
          <p style={{ lineHeight: 1.6 }}>
            Kontrol selanjutnya dilakukan di <b>Faskes Tingkat 1</b> (Puskesmas/klinik tempat Anda terdaftar).
          </p>
          <p style={{ lineHeight: 1.6, fontWeight: 700 }}>
            Jika ada keadaan darurat, segera ke UGD rumah sakit terdekat.
          </p>
          <button className="portal-link-btn" style={{ marginTop: 18 }} onClick={handleLogout}>Keluar</button>
        </div>
      </div>
    );
  }

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
          <img src="/logos/app-logo.png" alt="BERENDO SEHAT" className="portal-logo-img" />
          <div>
            <h2>BERENDO SEHAT</h2>
            <div className="portal-brand-sub">RSUD KAB. REJANG LEBONG</div>
            <div className="portal-brand-sub" style={{ fontStyle: "italic", textTransform: "none", letterSpacing: 0, marginTop: 2 }}>"Dari Berendo Rumah, RS Tetap Menjago"</div>
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

      {/* BARU: layar peringatan hasil TTV */}
      {vitalsAlert && (() => {
        const adv = vitalsAdvice(vitalsAlert);
        const critical = vitalsAlert.level === "critical";
        return (
          <div className="portal-sheet-overlay" style={{ alignItems: "center", padding: 12 }}>
            <div
              className={`portal-vitals-alert ${critical ? "critical portal-alert-flash" : "high"}`}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="portal-vitals-title"
              aria-describedby="portal-vitals-reason"
            >
              <div className="portal-vitals-icon" aria-hidden="true">{critical ? "🚨" : "⚠️"}</div>
              <h3 id="portal-vitals-title">{adv.title}</h3>
              <p id="portal-vitals-reason" className="portal-vitals-reason">{vitalsAlert.reason}</p>
              <ol className="portal-vitals-steps">
                {adv.steps.map((t) => <li key={t}>{t}</li>)}
              </ol>
              {adv.signs && (
                <div className="portal-vitals-signs">
                  <b>Segera ke UGD sekarang jika disertai:</b>
                  <ul>{adv.signs.map((t) => <li key={t}>{t}</li>)}</ul>
                </div>
              )}
              {critical && SOS_ENABLED && (
                <button
                  className="portal-primary-btn"
                  style={{ background: "linear-gradient(135deg, #ff5c50, #c0392b)" }}
                  onClick={() => { setVitalsAlert(null); setEmergencyStep("idle"); setView("help"); }}
                >
                  🆘 Ada tanda bahaya — buka Tombol Emergency
                </button>
              )}
              {critical && !SOS_ENABLED && (
                <div className="portal-info-card" style={{ borderColor: "#ff5c50", fontWeight: 700, textAlign: "center" }}>
                  🚨 Jika ada tanda bahaya di atas: segera minta keluarga mengantar ke UGD RSUD Kab. Rejang Lebong atau UGD terdekat.
                </div>
              )}
              <button className="portal-link-btn" onClick={() => setVitalsAlert(null)}>Saya mengerti</button>
            </div>
          </div>
        );
      })()}

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

          <div className={`portal-status-card${snapshot?.currentSafetyStatus === "URGENT" ? " portal-alert-flash" : ""}`} style={{ borderColor: statusInfo.color }}>
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
            {/* Okt 2026: Safety Check-In tidak lagi berdiri sendiri. Pasien cukup
                menekan tombol ini; setelah tensi/GDS disimpan, Check-In muncul
                otomatis (sekali sehari). */}
            <button className="portal-menu-btn" onClick={() => setView("monitoring")} style={{ gridColumn: "1 / -1" }}>
              <span className="portal-menu-illustration"><IconMonitoring /></span>
              Cek Kondisi Harian (Tensi / Gula Darah)
            </button>
            <button className="portal-menu-btn" onClick={() => setView("plan")}>
              <span className="portal-menu-illustration"><IconSafetyPlan /></span>
              Safety Plan Saya
            </button>
            <button className="portal-menu-btn" onClick={loadHistory}>
              <span className="portal-menu-illustration"><IconHistory /></span>
              Riwayat Monitoring
            </button>
            {/* 20 Okt 2026: selama SOS ditunda, menu Bantuan/Tanda Bahaya (tempat
                tombol SOS) diganti "Tanyo Dokter". Daftar tanda bahaya + arahan ke
                UGD ikut pindah ke bagian atas halaman Tanyo Dokter. */}
            {SOS_ENABLED ? (
              <>
                {snapshot?.tanyaDokter?.enabled && (
                  <button className="portal-menu-btn" onClick={openTanya} style={{ gridColumn: "1 / -1" }}>
                    <span className="portal-menu-illustration"><IconTanya /></span>
                    Tanyo Dokter
                  </button>
                )}
                <button className="portal-menu-btn" onClick={() => setView("help")} style={{ gridColumn: "1 / -1" }}>
                  <span className="portal-menu-illustration warm"><IconHelp /></span>
                  Bantuan / Tanda Bahaya
                </button>
              </>
            ) : (
              <button className="portal-menu-btn" onClick={openTanya} style={{ gridColumn: "1 / -1" }}>
                <span className="portal-menu-illustration warm"><IconTanya /></span>
                Tanyo Dokter
              </button>
            )}
          </div>
        </>
      )}

      {view === "checkin" && (
        <div className="portal-card">
          <h3>Safety Check-In (±30 detik)</h3>
          {checkinDone ? (
            <>
              <p>Terima kasih, jawaban Anda sudah tersimpan.</p>
              <button className="portal-primary-btn" onClick={() => { setCheckinIntro(""); setView("home"); }}>Kembali</button>
            </>
          ) : (
            <>
              {checkinIntro && (
                <>
                  <p>✅ {checkinIntro}</p>
                  <p className="portal-sub">Satu langkah lagi: jawab pertanyaan singkat berikut.</p>
                </>
              )}
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
              <button className="portal-link-btn" onClick={() => { setCheckinIntro(""); setView("home"); }}>{checkinIntro ? "Lewati" : "Batal"}</button>
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
          {/* Okt 2026: kolom Keluhan dihapus — sudah ditanyakan di Safety Check-In
              yang muncul otomatis setelah Simpan. */}
          <p className="portal-sub">Setelah Simpan, Anda akan diminta menjawab 6 pertanyaan singkat (±30 detik, cukup sekali sehari).</p>
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
              <b>Obat Saya (dari dokter RSUD):</b>
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
                  <b>{activeMeds.length > 0 ? "Catatan Obat dari Dokter:" : "Obat Saya:"}</b>
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
                <div style={{ marginTop: 4 }}>{renderMultiPoint(SOS_ENABLED ? plan.escalationInstruction : (plan.escalationInstruction || "").split(/\r?\n/).filter((l) => !l.includes("Tombol Darurat (SOS)")).join("\n"))}</div>
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

      {/* ==== BARU (Okt 2026): TANYA DOKTER ==== */}
      {view === "tanya" && (
        <div className="portal-card">
          <h3 style={{ marginTop: 0 }}>💬 Tanyo Dokter</h3>
          {!SOS_ENABLED && (
            <div className="portal-info-card" style={{ borderColor: "#ff5c50" }}>
              <p style={{ marginTop: 0, fontWeight: 700 }}>🚨 Tanda bahaya — JANGAN menunggu jawaban chat:</p>
              <ul style={{ marginTop: 0 }}>
                <li>Nyeri dada hebat / sesak napas berat</li>
                <li>Lemas atau kesemutan separuh badan, wajah mencong, bicara pelo mendadak</li>
                <li>Penurunan kesadaran / sulit dibangunkan</li>
                <li>Gula darah sangat rendah/tinggi disertai gejala berat</li>
              </ul>
              <p style={{ fontWeight: 700 }}>➡️ Segera minta keluarga mengantar ke UGD RSUD Kab. Rejang Lebong atau UGD terdekat. Jangan menyetir sendiri.</p>
              <p className="portal-sub" style={{ marginBottom: 0 }}>Tensi atau gula darah tinggi <b>tanpa keluhan</b>: periksakan diri hari ini ke puskesmas, klinik, atau rumah sakit terdekat. Jangan menunggu jadwal kontrol.</p>
            </div>
          )}
          {!tanya ? (
            <p>Memuat...</p>
          ) : tanya.error ? (
            <p className="portal-error">{tanya.error}</p>
          ) : !tanya.enabled ? (
            <p>Dokter penanggung jawab Anda belum dicatat, jadi pertanyaan belum bisa dikirim. Minta petugas mengisinya saat kontrol.</p>
          ) : (
            <>
              <p className="portal-sub" style={{ marginTop: 0 }}>
                Dokter: <b>{tanya.dpjpName || "-"}</b><br />
                Layanan: {tanya.service?.hoursText}. Dokter akan membalas saat sempat — bila darurat jangan menunggu, segera ke UGD.<br />
                Silakan bertanya dan membalas pesan dokter sepuasnya. Untuk konsultasi & edukasi (keluhan, makanan, cara cek tensi/gula, cara minum obat).
                Dokter <b>tidak mengubah dosis obat</b> lewat chat — perubahan obat hanya saat kontrol.
              </p>

              {tanyaMsg && <div className="portal-info-card" style={{ borderColor: "var(--p-accent)" }}>✅ {tanyaMsg}</div>}
              {tanyaErr && <p className="portal-error">{tanyaErr}</p>}

              {tanya.usedToday ? (
                <div className="portal-info-card">
                  🔒 Jatah pertanyaan hari ini sudah dipakai. Anda bisa bertanya lagi besok.
                  {!tanya.service?.open && <div className="portal-sub" style={{ marginTop: 4 }}>Pertanyaan Anda akan dijawab {tanya.service?.nextOpenText}.</div>}
                </div>
              ) : tanyaStep === "precheck" ? (
                <div className="portal-info-card" style={{ borderColor: "#ff5c50" }}>
                  <p style={{ marginTop: 0, fontWeight: 700 }}>Sebelum bertanya: apakah SEKARANG Anda mengalami {SOS_ENABLED ? "salah satu ini" : "salah satu tanda bahaya di atas"}?</p>
                  {SOS_ENABLED && (
                    <ul style={{ marginTop: 0 }}>
                      <li>Nyeri dada</li>
                      <li>Lemas / kesemutan separuh badan, wajah mencong, atau bicara pelo</li>
                      <li>Sesak napas</li>
                    </ul>
                  )}
                  {SOS_ENABLED ? (
                    <button className="portal-primary-btn" style={{ background: "linear-gradient(135deg, #ff5c50, #c0392b)" }} onClick={goToSos}>
                      Ya — buka Tombol Emergency
                    </button>
                  ) : (
                    <div className="portal-info-card" style={{ borderColor: "#ff5c50", fontWeight: 700, textAlign: "center" }}>
                      Jika YA: jangan menunggu jawaban chat — segera minta keluarga mengantar ke UGD RSUD Kab. Rejang Lebong atau UGD terdekat.
                    </div>
                  )}
                  <button className="portal-primary-btn" style={{ marginTop: 8 }} onClick={() => setTanyaStep("form")}>
                    Tidak — lanjut menulis pertanyaan
                  </button>
                </div>
              ) : tanyaDanger ? (
                <div className="portal-info-card" style={{ borderColor: "#ff5c50" }}>
                  <p style={{ marginTop: 0, fontWeight: 700 }}>🚨 Pertanyaan Anda menyebut tanda bahaya ({tanyaDanger.join(", ")}).</p>
                  <p className="portal-sub">Jika keluhan itu sedang terjadi sekarang, jangan menunggu jawaban chat — {SOS_ENABLED ? "segera tekan Tombol Emergency atau ke IGD." : "segera minta keluarga mengantar ke UGD RSUD Kab. Rejang Lebong atau UGD terdekat."}</p>
                  {SOS_ENABLED ? (
                    <button className="portal-primary-btn" style={{ background: "linear-gradient(135deg, #ff5c50, #c0392b)" }} onClick={goToSos}>
                      🆘 Buka Tombol Emergency
                    </button>
                  ) : (
                    <div className="portal-info-card" style={{ borderColor: "#ff5c50", fontWeight: 700, textAlign: "center" }}>
                      🚨 Segera ke UGD
                    </div>
                  )}
                  <button className="portal-link-btn" disabled={tanyaBusy} onClick={() => handleAskDoctor(true)}>
                    {tanyaBusy ? "Mengirim..." : "Bukan darurat sekarang, tetap kirim pertanyaan"}
                  </button>
                </div>
              ) : (
                <>
                  {!tanya.service?.open && (
                    <div className="portal-info-card">
                      🕙 Di luar jam layanan. Pertanyaan tetap bisa dikirim sekarang dan akan dijawab {tanya.service?.nextOpenText}.
                    </div>
                  )}
                  <div className="portal-field">
                    <label>Pertanyaan Anda</label>
                    <textarea
                      rows={4}
                      maxLength={tanya.maxChars || 500}
                      value={tanyaText}
                      onChange={(e) => setTanyaText(e.target.value)}
                      placeholder="Contoh: Bolehkah saya makan durian? / Jam berapa sebaiknya cek gula darah?"
                      style={{ width: "100%", boxSizing: "border-box", font: "inherit", padding: 10, borderRadius: 10 }}
                    />
                    <div className="portal-sub" style={{ fontSize: 12, textAlign: "right" }}>{tanyaText.length}/{tanya.maxChars || 500}</div>
                  </div>
                  <button className="portal-primary-btn" disabled={tanyaBusy || tanyaText.trim().length < 5} onClick={() => handleAskDoctor(false)}>
                    {tanyaBusy ? "Mengirim..." : "Kirim ke Dokter"}
                  </button>
                </>
              )}

              {(tanya.questions || []).length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <b>Riwayat Pertanyaan</b>
                  {tanya.questions.map((q) => (
                    <div key={q.id} className="portal-notif-item" style={{ marginTop: 10 }}>
                      <div className="portal-notif-meta">
                        <span className="portal-notif-kind">{TANYA_STATUS[q.status] || q.status}</span>
                        <span className="portal-notif-time">{q.askedAt ? new Date(q.askedAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) : q.dateWib}</span>
                      </div>
                      {q.messages.map((m, i) => (
                        <div key={i} className="portal-notif-text" style={{ marginTop: 6 }}>
                          <b>{m.from === "doctor" ? `👨‍⚕️ ${m.byName || "Dokter"}:` : "Saya:"}</b>{" "}
                          <span style={{ whiteSpace: "pre-wrap" }}>{m.text}</span>
                        </div>
                      ))}
                      {/* REVISI (20 Okt 2026): pasien bisa membalas kapan saja */}
                      {q.status === "answered" && replyText[q.id] === undefined ? (
                        <button className="portal-link-btn" style={{ marginTop: 6 }} onClick={() => setReplyText((r) => ({ ...r, [q.id]: "" }))}>
                          Masih ada pertanyaan? Lanjutkan percakapan ini
                        </button>
                      ) : (
                        <div style={{ marginTop: 8 }}>
                          {q.status === "answered" && (
                            <div className="portal-sub" style={{ fontSize: 13 }}>Konsultasi ini sudah diselesaikan dokter. Tulis pesan Anda, percakapan akan dibuka lagi.</div>
                          )}
                          <textarea
                            rows={3}
                            maxLength={tanya.maxChars || 500}
                            value={replyText[q.id] || ""}
                            onChange={(e) => setReplyText((r) => ({ ...r, [q.id]: e.target.value }))}
                            placeholder={q.status === "awaiting_patient" ? "Balas dokter: jawab pertanyaannya atau tanyakan lanjutan..." : "Tulis pesan tambahan untuk dokter..."}
                            style={{ width: "100%", boxSizing: "border-box", font: "inherit", padding: 10, borderRadius: 10 }}
                          />
                          <button className="portal-primary-btn" disabled={tanyaBusy || !(replyText[q.id] || "").trim()} onClick={() => handleReplyClarification(q.id)}>
                            {tanyaBusy ? "Mengirim..." : "Kirim Balasan"}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          <button className="portal-link-btn" onClick={() => setView("home")}>Kembali</button>
        </div>
      )}

      {view === "help" && (
        <div className="portal-card">
          <h3>Bantuan / Tanda Bahaya</h3>
          <p>Jika Anda mengalami salah satu hal berikut, <b>segera minta keluarga mengantar ke UGD RSUD Kabupaten Rejang Lebong</b> atau UGD rumah sakit terdekat. Jangan menyetir sendiri.</p>
          <ul>
            <li>Nyeri dada hebat / sesak napas berat</li>
            <li>Kelemahan anggota gerak atau bicara pelo mendadak</li>
            <li>Penurunan kesadaran</li>
            <li>Gula darah sangat rendah/tinggi disertai gejala berat</li>
          </ul>
          <p>Aplikasi ini adalah alat bantu pemantauan, <b>bukan pengganti</b> penilaian tenaga kesehatan.</p>

          {/* 20 Okt 2026: Tombol Emergency (SOS) ditunda — lihat lib/features.js */}
          {!SOS_ENABLED && (
            <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--p-glass-border)" }}>
              <div className="portal-info-card" style={{ borderColor: "#ff5c50" }}>
                <p style={{ marginTop: 0, fontWeight: 700 }}>🚨 Ada tanda bahaya → segera ke UGD</p>
                <p className="portal-sub" style={{ marginBottom: 0 }}>Tensi atau gula darah tinggi <b>tanpa keluhan</b>: periksakan diri hari ini ke puskesmas, klinik, atau rumah sakit terdekat. Jangan menunggu jadwal kontrol.</p>
              </div>
            </div>
          )}
          {SOS_ENABLED && (
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
          )}

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
