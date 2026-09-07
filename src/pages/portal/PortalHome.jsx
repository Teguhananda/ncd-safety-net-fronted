import { useEffect, useRef, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { callApi } from "../../lib/api";
import { usePortalPwa } from "../../pwa/usePortalPwa";
import { requestAndRegisterPush } from "../../lib/push";
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

// SlotButton — render satu slot pengingat obat sesuai statusnya:
// null = belum ada reminder terkirim (cron belum jalan/belum waktunya),
// "sent"/"send_failed" = sudah diingatkan, MENUNGGU konfirmasi pasien →
// tampil tombol, "confirmed_taken"/"confirmed_skipped" = sudah
// dikonfirmasi → tampil badge saja (tidak bisa ditekan lagi).
function SlotButton({ slot, status, onConfirm }) {
  const label = SLOT_LABEL[slot] || slot;
  if (status === "confirmed_taken") {
    return (
      <span className="portal-yn-active" style={{ padding: "8px 14px", borderRadius: 999, fontSize: 13, display: "inline-block" }}>
        ✅ {label} — Sudah Minum
      </span>
    );
  }
  if (status === "confirmed_skipped") {
    return (
      <span style={{ padding: "8px 14px", borderRadius: 999, fontSize: 13, opacity: 0.7, display: "inline-block" }}>
        ⏭️ {label} — Dilewati
      </span>
    );
  }
  if (status === "sent" || status === "send_failed") {
    return (
      <button className="portal-primary-btn" style={{ fontSize: 13, padding: "8px 14px" }} onClick={() => onConfirm("confirmed_taken")}>
        ✅ {label} — Sudah Minum Obat
      </button>
    );
  }
  return (
    <span className="portal-sub" style={{ fontSize: 12, padding: "8px 10px", display: "inline-block" }}>
      {label}: menunggu jadwal
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

  async function loadNotifications() {
    try {
      const patientId = await getPatientId();
      const res = await callApi("patientPortal", { action: "getSummary", patientId, days: 30 });

      const signalItems = (res.data.signals || [])
        .filter((s) => s.status && s.status !== "SAFE")
        .map((s) => ({ kind: "signal", date: s.detectedAt, ...s }));

      const messageItems = (res.data.messages || [])
        .map((m) => ({ kind: "message", date: m.sentAt, ...m }));

      const combined = [...signalItems, ...messageItems].sort((a, b) => new Date(b.date) - new Date(a.date));
      setNotifList(combined);

      const seenAt = localStorage.getItem(NOTIF_SEEN_KEY);
      const unread = seenAt ? combined.filter((n) => new Date(n.date) > new Date(seenAt)).length : combined.length;
      setNotifUnreadCount(unread);
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

  useEffect(() => { loadSnapshot(); loadNotifications(); loadTodayReminders(); }, []);

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
          Promise.all([loadSnapshot(), loadNotifications(), loadTodayReminders()]).finally(() => setRefreshing(false));
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
  const handleConfirmDose = async (medicationId, slot, status) => {
    try {
      const patientId = await getPatientId();
      await callApi("patientPortal", { action: "confirmMedicationDose", patientId, medicationId, slot, status });
      await loadTodayReminders();
    } catch (err) {
      alert(err.message || "Gagal menyimpan konfirmasi.");
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

      {notifPanelOpen && (
        <>
          <div
            onClick={() => setNotifPanelOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 40, background: "transparent" }}
          />
          <div
            className="portal-card"
            style={{
              position: "absolute",
              top: 68,
              right: 16,
              width: "min(320px, calc(100vw - 32px))",
              maxHeight: "60vh",
              overflowY: "auto",
              zIndex: 50,
            }}
          >
            <h3 style={{ marginTop: 0 }}>Notifikasi</h3>
            {notifList.length === 0 ? (
              <p className="portal-sub">Belum ada notifikasi.</p>
            ) : (
              notifList.map((n) => {
                if (n.kind === "message") {
                  return (
                    <div key={`msg-${n.id}`} className="portal-history-row">
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ color: "var(--p-accent, #34d399)", fontWeight: 700 }}>💬 Pesan dari RS</span>
                        <span className="portal-sub" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                          {n.date ? new Date(n.date).toLocaleString("id-ID", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-"}
                        </span>
                      </div>
                      <div style={{ marginTop: 4 }}>{n.message}</div>
                    </div>
                  );
                }
                const info = STATUS_MAP[n.status] || STATUS_MAP.ATTENTION;
                return (
                  <div key={`sig-${n.id}`} className="portal-history-row">
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ color: info.color, fontWeight: 700 }}>{info.emoji} {info.label}</span>
                      <span className="portal-sub" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                        {n.date ? new Date(n.date).toLocaleString("id-ID", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-"}
                      </span>
                    </div>
                    {Array.isArray(n.reason) && n.reason.length > 0 && (
                      <div className="portal-sub" style={{ marginTop: 4 }}>{n.reason[0]}</div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
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
                      <SlotButton key={s.slot} slot={s.slot} status={s.status} onConfirm={(st) => handleConfirmDose(m.id, s.slot, st)} />
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
          {!plan ? (
            <p>Belum ada safety plan aktif. Tanyakan ke petugas/dokter saat kontrol berikutnya.</p>
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                <b>Obat Saya:</b>
                <div style={{ marginTop: 4 }}>{renderMultiPoint(plan.medicationPlan)}</div>
              </div>
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
