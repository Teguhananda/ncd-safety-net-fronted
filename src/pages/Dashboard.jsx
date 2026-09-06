import { useEffect, useRef, useState } from "react";
import { collection, getDocs, doc, getDoc, onSnapshot, orderBy, limit, query, where } from "firebase/firestore";
import { Link } from "react-router-dom";
import { db } from "../lib/firebase";
import { callApi } from "../lib/api";
import Layout from "../components/Layout";
import RiskBadge from "../components/RiskBadge";
import TrendChart from "../components/TrendChart";
import RiskPieChart from "../components/RiskPieChart";
import { useAuth } from "../context/AuthContext";
import { requestAndRegisterStaffPush } from "../lib/staffPush";

const PARAM_LABEL_ID = {
  systolicBP: "Tensi Sistolik",
  diastolicBP: "Tensi Diastolik",
  bloodGlucose: "Gula Darah",
};

const NOTIF_TYPE_COLLECTION = {
  patient_emergency: "safety_signals",
  home_safety_signal: "safety_signals",
  red_flag: "risk_assessments",
  high_risk: "risk_assessments",
  followup_overdue: "followups",
  high_followup_risk: "followups",
};

const NOTIF_TYPE_LABEL = {
  patient_emergency: { text: "🆘 DARURAT — Tombol Emergency Ditekan", color: "#ff5c50" },
  home_safety_signal: { text: "🏠 Sinyal Keselamatan Rumah", color: "#f5a623" },
  red_flag: { text: "🚩 Red Flag", color: "#e6553f" },
  high_risk: { text: "⚠️ Risiko Tinggi", color: "#e6553f" },
  followup_overdue: { text: "📅 Follow-up Terlewat", color: "#f5a623" },
  high_followup_risk: { text: "📅 Risiko Follow-up Tinggi", color: "#f5a623" },
};

// ==== BAGIAN BARU: susun kalimat yang akan dibacakan suara, per jenis
// notifikasi. Untuk patient_emergency, kalimat DIBEDAKAN kalau yang
// mendengar adalah peran Ambulans — dibuat lebih tegas & langsung sesuai
// permintaan ("khusus panggil ambulan suaranya dipertegas").
function buildSpeechText(n, myRole) {
  const name = n.patientName && n.patientName !== "-" ? n.patientName : "pasien tidak dikenal";
  const isAmbulance = myRole === "ambulance_rsud" || myRole === "ambulance_psc119";

  if (n.type === "patient_emergency") {
    if (isAmbulance) {
      return `Panggilan ambulans. Segera berangkat. Kondisi gawat darurat pasien ${name}. Pasien menekan tombol darurat. ${n.hasLocation ? "Lokasi pasien tersedia, silakan cek layar." : ""}`;
    }
    return `Perhatian. Kondisi darurat. Pasien ${name} menekan tombol darurat. Ambulans sedang diberitahu. ${n.hasLocation ? "Lokasi pasien tersedia di layar." : ""} Segera tindak lanjuti.`;
  }
  if (n.type === "home_safety_signal") {
    return `Perhatian. Sinyal keselamatan rumah untuk pasien ${name}. ${n.detail || ""}`;
  }
  if (n.type === "red_flag") {
    return `Perhatian. Hasil skrining pasien ${name} menunjukkan tanda bahaya, red flag.`;
  }
  if (n.type === "high_risk") {
    return `Perhatian. Pasien ${name} berada dalam kategori risiko tinggi.`;
  }
  if (n.type === "followup_overdue") {
    return `Pengingat. Follow-up pasien ${name} sudah terlewat dari jadwal.`;
  }
  if (n.type === "high_followup_risk") {
    return `Pengingat. Pasien ${name} berisiko tinggi untuk hilang dari tindak lanjut.`;
  }
  return `Ada notifikasi baru untuk pasien ${name}.`;
}

// ==== BAGIAN BARU: alarm suara — text-to-speech bawaan browser (gratis)
// + nada peringatan (Web Audio API, tanpa file suara eksternal). ====
function useAlarmSound() {
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const audioCtxRef = useRef(null);

  useEffect(() => {
    if (audioUnlocked) return;
    function unlock() {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC && !audioCtxRef.current) audioCtxRef.current = new AC();
        audioCtxRef.current?.resume();
        // Ucapan kosong sekali — di banyak browser ini yang "membuka
        // izin" agar speechSynthesis bisa dipakai otomatis setelahnya.
        const u = new SpeechSynthesisUtterance(" ");
        u.volume = 0;
        window.speechSynthesis?.speak(u);
      } catch {
        // abaikan — kalau gagal, banner tetap tampil sampai berhasil
      }
      setAudioUnlocked(true);
      document.removeEventListener("click", unlock);
      document.removeEventListener("touchstart", unlock);
    }
    document.addEventListener("click", unlock);
    document.addEventListener("touchstart", unlock);
    return () => {
      document.removeEventListener("click", unlock);
      document.removeEventListener("touchstart", unlock);
    };
  }, [audioUnlocked]);

  function playBeep(urgent) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audioCtxRef.current) audioCtxRef.current = new AC();
      const ctx = audioCtxRef.current;
      const beepCount = urgent ? 3 : 1;
      const freq = urgent ? 880 : 660;
      for (let i = 0; i < beepCount; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        const startAt = ctx.currentTime + i * 0.28;
        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(0.35, startAt + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.22);
        osc.connect(gain).connect(ctx.destination);
        osc.start(startAt);
        osc.stop(startAt + 0.24);
      }
    } catch {
      // abaikan — beep gagal tidak boleh mengganggu alur utama
    }
  }

  function speak(text, urgent) {
    try {
      if (!window.speechSynthesis) return;
      const utter = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const idVoice = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("id"));
      if (idVoice) utter.voice = idVoice;
      utter.lang = idVoice ? idVoice.lang : "id-ID";
      utter.rate = urgent ? 0.95 : 1;
      utter.pitch = urgent ? 0.9 : 1;
      utter.volume = 1;
      if (urgent) window.speechSynthesis.cancel(); // potong ucapan lama, darurat harus didengar duluan
      window.speechSynthesis.speak(utter);
    } catch {
      // abaikan
    }
  }

  return { audioUnlocked, playBeep, speak };
}

function useStaffNotifications(role) {
  const [rawNotifs, setRawNotifs] = useState([]);
  const [enriched, setEnriched] = useState([]);
  const cacheRef = useRef({});

  useEffect(() => {
    if (!role) return;
    const q = query(
      collection(db, "notifications"),
      where("toRole", "==", role),
      orderBy("createdAt", "desc"),
      limit(30)
    );
    const unsub = onSnapshot(q, (snap) => {
      setRawNotifs(snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          createdAt: data.createdAt && data.createdAt.toDate ? data.createdAt.toDate() : null,
        };
      }));
    }, (err) => {
      // BAGIAN BARU: sebelumnya error di sini ditelan diam-diam sehingga
      // masalah index Firestore (atau sejenisnya) tidak pernah kelihatan
      // di Console. Sekarang dicatat supaya bisa didiagnosis.
      console.error("Lonceng notifikasi staff gagal dimuat:", err);
    });
    return unsub;
  }, [role]);

  useEffect(() => {
    let cancelled = false;
    async function enrich() {
      const results = await Promise.all(rawNotifs.map(async (n) => {
        const cacheKey = `${n.type}:${n.relatedEntityId}`;
        if (cacheRef.current[cacheKey]) {
          return { ...n, ...cacheRef.current[cacheKey] };
        }
        const collectionName = NOTIF_TYPE_COLLECTION[n.type];
        let patientName = "-";
        let patientId = null;
        let detail = "";
        let hasLocation = false;
        let mapUrl = null;
        try {
          if (collectionName && n.relatedEntityId) {
            const entitySnap = await getDoc(doc(db, collectionName, n.relatedEntityId));
            if (entitySnap.exists()) {
              const entity = entitySnap.data();
              patientId = entity.patientId || null;
              if (collectionName === "safety_signals") {
                detail = Array.isArray(entity.reason) && entity.reason.length > 0 ? entity.reason[0] : (entity.status || "");
                if (entity.location && entity.location.lat && entity.location.lng) {
                  hasLocation = true;
                  mapUrl = `https://maps.google.com/maps/search/?api=1&query=${entity.location.lat},${entity.location.lng}`;
                }
              } else if (collectionName === "risk_assessments") {
                detail = entity.riskStatus ? `Status: ${entity.riskStatus}` : "";
              } else if (collectionName === "followups") {
                detail = entity.dueDate ? `Jatuh tempo: ${entity.dueDate}` : "";
              }
              if (patientId) {
                const patientSnap = await getDoc(doc(db, "patients", patientId));
                if (patientSnap.exists()) {
                  const p = patientSnap.data();
                  patientName = p.name || p.fullName || "-";
                }
              }
            }
          }
        } catch {
          // gagal ambil detail — tetap tampilkan baris notifikasi generik
        }
        const enrichment = { patientName, patientId, detail, hasLocation, mapUrl };
        cacheRef.current[cacheKey] = enrichment;
        return { ...n, ...enrichment };
      }));
      if (!cancelled) setEnriched(results);
    }
    enrich();
    return () => { cancelled = true; };
  }, [rawNotifs]);

  return enriched;
}

export default function Dashboard() {
  const { role } = useAuth();
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [attentionList, setAttentionList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSignalCount, setActiveSignalCount] = useState(0);
  const [latestSignalTime, setLatestSignalTime] = useState(null);
  const [recentMonitoring, setRecentMonitoring] = useState([]);
  const [notifStatus, setNotifStatus] = useState(typeof Notification !== "undefined" ? Notification.permission : "unsupported");
  const [notifMsg, setNotifMsg] = useState("");

  const staffNotifs = useStaffNotifications(role);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const unreadNotifCount = staffNotifs.filter((n) => !n.isRead).length;

  // ==== BAGIAN BARU: alarm suara ====
  const { audioUnlocked, playBeep, speak } = useAlarmSound();
  const spokenOnceRef = useRef(new Set()); // notif id yang sudah dibacakan sekali

  // Bacakan SEKALI setiap notifikasi baru yang belum pernah dibacakan.
  useEffect(() => {
    if (!audioUnlocked) return;
    staffNotifs.forEach((n) => {
      if (n.isRead) return;
      if (spokenOnceRef.current.has(n.id)) return;
      spokenOnceRef.current.add(n.id);
      const urgent = n.type === "patient_emergency";
      playBeep(urgent);
      // beri jeda sedikit supaya beep selesai dulu baru suara bicara
      setTimeout(() => speak(buildSpeechText(n, role), urgent), urgent ? 500 : 350);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffNotifs, audioUnlocked]);

  // Alarm patient_emergency BERULANG tiap ~20 detik selama belum ada yang
  // menekan (acknowledge) notifikasinya — supaya tidak terlewat begitu
  // pasien menekan tombol darurat.
  useEffect(() => {
    if (!audioUnlocked) return;
    const interval = setInterval(() => {
      const activeEmergencies = staffNotifs.filter((n) => n.type === "patient_emergency" && !n.isRead);
      if (activeEmergencies.length === 0) return;
      playBeep(true);
      setTimeout(() => speak(buildSpeechText(activeEmergencies[0], role), true), 500);
    }, 20000);
    return () => clearInterval(interval);
  }, [staffNotifs, audioUnlocked, role, playBeep, speak]);

  // BAGIAN BARU: hanya notifikasi BELUM ditangani yang ditampilkan di
  // panel — begitu ditandai "Saya Tangani", langsung hilang dari daftar
  // (bukan cuma pudar warnanya), dan otomatis berhenti memicu alarm
  // berulang karena alarm memang cuma cek yang belum dibaca.
  const unreadNotifs = staffNotifs.filter((n) => !n.isRead);

  // BAGIAN BARU: dipindah lewat backend (bukan updateDoc/deleteDoc
  // langsung dari browser) — firestore.rules sengaja melarang client
  // menulis ke koleksi notifications (allow write: if false), jadi
  // aksi ini harus lewat Admin SDK di server.
  const handleAckNotif = async (n) => {
    if (n.isRead) return;
    try {
      await callApi("patientHistory", { action: "ackNotification", notificationId: n.id });
    } catch (err) {
      alert("Gagal menandai notifikasi: " + (err.message || "terjadi kesalahan."));
    }
  };

  const handleDeleteNotif = async (n) => {
    try {
      await callApi("patientHistory", { action: "deleteNotification", notificationId: n.id });
    } catch (err) {
      alert("Gagal menghapus notifikasi: " + (err.message || "terjadi kesalahan."));
    }
  };

  const handleEnableStaffNotif = async () => {
    setNotifMsg("Memproses...");
    const result = await requestAndRegisterStaffPush();
    if (result.ok) {
      setNotifStatus("granted");
      setNotifMsg("Notifikasi aktif. Anda akan diberi tahu real-time saat ada Home Safety Signal baru.");
    } else {
      setNotifMsg(result.reason);
    }
  };

  async function load() {
    const summarySnap = await getDocs(
      query(collection(db, "analytics_summary"), orderBy("generatedAt", "desc"), limit(7))
    );
    const summaries = summarySnap.docs.map((d) => ({ periodId: d.id, ...d.data() }));
    if (summaries.length > 0) setSummary(summaries[0]);
    setHistory([...summaries].reverse());

    const riskSnap = await getDocs(
      query(collection(db, "risk_assessments"), orderBy("createdAt", "desc"), limit(20))
    );
    const attention = riskSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((r) => r.riskStatus === "HIGH" || r.riskStatus === "RED_FLAG")
      .slice(0, 5);

    const attentionWithNames = await Promise.all(
      attention.map(async (r) => {
        if (!r.patientId) return { ...r, patientName: "-", patientMrn: "-" };
        try {
          const patientSnap = await getDoc(doc(db, "patients", r.patientId));
          const p = patientSnap.exists() ? patientSnap.data() : null;
          return {
            ...r,
            patientName: p?.name || p?.fullName || "Nama tidak ditemukan",
            patientMrn: p?.mrn || p?.rmNumber || r.patientId,
          };
        } catch (err) {
          return { ...r, patientName: "Gagal memuat nama", patientMrn: r.patientId };
        }
      })
    );

    setAttentionList(attentionWithNames);
    setLoading(false);

    try {
      const signalSnap = await getDocs(
        query(collection(db, "safety_signals"), where("workflowStatus", "!=", "CLOSED"))
      );
      setActiveSignalCount(signalSnap.size);
      let latest = null;
      signalSnap.docs.forEach((d) => {
        const dt = d.data().detectedAt;
        const dtDate = dt && dt.toDate ? dt.toDate() : null;
        if (dtDate && (!latest || dtDate > latest)) latest = dtDate;
      });
      setLatestSignalTime(latest);
    } catch (err) {
      // diamkan — widget tambahan, tidak boleh mengganggu dashboard utama
    }

    try {
      const res = await callApi("patientHistory", { action: "recentMonitoring" });
      setRecentMonitoring(res.data.entries || []);
    } catch (err) {
      // diamkan — widget tambahan
    }
  }

  useEffect(() => { load(); }, []);

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
          load().finally(() => setRefreshing(false));
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

  const dist = summary?.riskDistribution || { low: 0, moderate: 0, high: 0, redFlag: 0 };
  const total = dist.low + dist.moderate + dist.high + dist.redFlag || 1;
  const pct = (n) => Math.round((n / total) * 100);

  return (
    <Layout title="Dashboard" meta="Ringkasan keselamatan pasien NCD">
      {!audioUnlocked && (
        <div className="card" style={{ marginBottom: 16, textAlign: "center", border: "1px dashed var(--line, rgba(255,255,255,0.25))" }}>
          🔊 Ketuk di mana saja pada layar ini untuk mengaktifkan suara peringatan darurat.
        </div>
      )}

      {(pullDistance > 0 || refreshing) && (
        <div
          style={{
            height: refreshing ? 44 : pullDistance,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            color: "var(--stat-sub-color, #8aa0a8)",
            transition: refreshing ? "height 0.15s ease" : "none",
            overflow: "hidden",
          }}
        >
          {refreshing ? "🔄 Memuat ulang..." : pullDistance > 55 ? "↓ Lepas untuk refresh" : "↓ Tarik untuk refresh"}
        </div>
      )}

      <button
        onClick={() => setNotifPanelOpen((o) => !o)}
        aria-label="Notifikasi"
        style={{
          position: "fixed",
          top: 18,
          right: 18,
          zIndex: 900,
          background: "var(--surface, #17262b)",
          border: "1px solid var(--line, rgba(255,255,255,0.15))",
          borderRadius: "50%",
          width: 44,
          height: 44,
          fontSize: 20,
          cursor: "pointer",
          boxShadow: "0 4px 14px rgba(0,0,0,0.3)",
        }}
      >
        🔔
        {unreadNotifCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              background: "#ff5c50",
              color: "#fff",
              borderRadius: "50%",
              minWidth: 18,
              height: 18,
              fontSize: 11,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 3px",
            }}
          >
            {unreadNotifCount > 9 ? "9+" : unreadNotifCount}
          </span>
        )}
      </button>

      {notifPanelOpen && (
        <>
          <div onClick={() => setNotifPanelOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 890, background: "transparent" }} />
          <div className="card" style={{ position: "fixed", top: 70, right: 18, width: 360, maxHeight: "70vh", overflowY: "auto", zIndex: 899 }}>
            <h3 style={{ marginTop: 0 }}>Notifikasi</h3>
            {unreadNotifs.length === 0 ? (
              <div className="stat-sub">Tidak ada notifikasi aktif — semua sudah ditangani.</div>
            ) : (
              unreadNotifs.map((n) => {
                const meta = NOTIF_TYPE_LABEL[n.type] || { text: n.type, color: "#888" };
                const isEmergency = n.type === "patient_emergency";
                return (
                  <div
                    key={n.id}
                    style={{
                      padding: "10px 8px",
                      borderBottom: "1px solid var(--line, rgba(255,255,255,0.08))",
                      background: isEmergency ? "rgba(255,92,80,0.12)" : "rgba(255,92,80,0.06)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ color: meta.color, fontWeight: 700, fontSize: 13 }}>{meta.text}</span>
                      <button
                        onClick={() => handleDeleteNotif(n)}
                        title="Hapus notifikasi ini"
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--stat-sub-color, #8aa0a8)", padding: 0, marginTop: 2 }}
                      >
                        🗑
                      </button>
                    </div>
                    <div style={{ fontSize: 13, marginTop: 3 }}>
                      {n.patientId ? (
                        <Link to={`/patient-history?patientId=${n.patientId}`}>{n.patientName}</Link>
                      ) : (
                        n.patientName
                      )}
                    </div>
                    {n.detail && <div className="stat-sub" style={{ fontSize: 12 }}>{n.detail}</div>}
                    <div className="stat-sub" style={{ fontSize: 11, marginTop: 2 }}>
                      {n.createdAt ? n.createdAt.toLocaleString("id-ID", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-"}
                    </div>
                    {isEmergency && n.hasLocation && n.mapUrl && (
                      <a href={n.mapUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ display: "inline-block", marginTop: 6, fontSize: 12, padding: "4px 10px" }}>
                        📍 Buka Peta Lokasi Pasien
                      </a>
                    )}
                    <button
                      className="btn btn-primary"
                      style={{ display: "block", marginTop: 6, fontSize: 12, padding: "5px 10px", width: "100%" }}
                      onClick={() => handleAckNotif(n)}
                    >
                      ✓ Saya Tangani (hilangkan dari daftar)
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {(role === "dokter" || role === "case_manager") && notifStatus !== "granted" && notifStatus !== "unsupported" && (
        <div className="card" style={{ marginBottom: 16 }}>
          🔔 Aktifkan notifikasi supaya langsung diberi tahu real-time di HP saat ada Home Safety Signal baru dari pasien.
          <button className="btn btn-primary" style={{ marginTop: 8, display: "block" }} onClick={handleEnableStaffNotif}>
            Aktifkan Notifikasi
          </button>
          {notifMsg && <div className="stat-sub" style={{ marginTop: 6 }}>{notifMsg}</div>}
        </div>
      )}
      {activeSignalCount > 0 && (
        <Link to="/safety-signals" className="card" style={{ display: "block", marginBottom: 16, textDecoration: "none", border: "1px solid var(--redflag, #e6553f)" }}>
          <b>🏠 {activeSignalCount} Home Safety Signal aktif</b> — dari pemantauan mandiri pasien di rumah, perlu ditinjau.
          {latestSignalTime && (
            <span className="stat-sub"> Sinyal terbaru: {latestSignalTime.toLocaleString("id-ID", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}.</span>
          )}
          {" "}Klik untuk buka.
        </Link>
      )}
            <div className="grid cols-3">
        <div className="card">
          <div className="stat-label">Total Skrining</div>
          <div className="stat-value mono">{summary ? summary.totalScreenings : "-"}</div>
          <div className="stat-sub">Data agregat (snapshot harian)</div>
        </div>
        <div className="card">
          <div className="stat-label">Red Flag Aktif</div>
          <div className="stat-value mono" style={{ color: "var(--redflag)" }}>
            {dist.redFlag}
          </div>
          <div className="stat-sub">Menunggu tinjauan klinis</div>
        </div>
        <div className="card">
          <div className="stat-label">Hilang dari Tindak Lanjut</div>
          <div className="stat-value mono" style={{ color: "var(--moderate)" }}>
            {summary ? summary.lostToFollowupCount : "-"}
          </div>
          <div className="stat-sub">Perlu tindak lanjut</div>
        </div>
      </div>

      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>Distribusi Risiko</h3>
        <RiskPieChart data={dist} />
        <div style={{ marginTop: 14 }}>
          {[["Low",dist.low,"#2fae6f"],["Moderate",dist.moderate,"#f5a623"],["High",dist.high,"#e6553f"],["Red Flag",dist.redFlag,"#a5281f"]].map(([l,v,col]) => (
            <div key={l} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", fontSize:12.5, marginBottom:6 }}>
              <span style={{ display:"flex", alignItems:"center", gap:6 }}><span style={{ width:9, height:9, borderRadius:"50%", background:col, display:"inline-block" }}></span>{l}</span>
              <span className="mono">{v}</span>
            </div>
          ))}
        </div>
      </div>
        <div className="card">
          <h3>Pasien Perlu Perhatian</h3>
          {loading ? (
            <div className="stat-sub">Memuat...</div>
          ) : attentionList.length === 0 ? (
            <div className="stat-sub">Tidak ada pasien High/Red Flag saat ini.</div>
          ) : (
            <table>
              <tbody>
                {attentionList.map((r) => (
                  <tr key={r.id} className={r.riskStatus === "RED_FLAG" ? "row-redflag" : ""}>
                    <td>{r.patientName}</td>
                    <td>
                      <RiskBadge status={r.riskStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Tren 7 Hari Terakhir</h3>
        <TrendChart
          data={history}
          height={180}
          lines={[
            { key: "totalScreenings", label: "Total Skrining", color: "#3B5670" },
            { key: "lostToFollowupCount", label: "Hilang dari Tindak Lanjut", color: "#C8552B" },
          ]}
        />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>🏠 Aktivitas Monitoring Mandiri Terbaru</h3>
        <div className="stat-sub" style={{ marginBottom: 10 }}>
          Hasil tensi/gula darah yang diinput langsung oleh pasien dari rumah lewat Portal My NCD Safety.
        </div>
        {recentMonitoring.length === 0 ? (
          <div className="stat-sub">Belum ada aktivitas monitoring mandiri dari pasien.</div>
        ) : (
          <table>
            <thead>
              <tr><th>Tanggal &amp; Jam</th><th>Pasien</th><th>Parameter</th><th>Nilai</th><th>Keluhan</th></tr>
            </thead>
            <tbody>
              {recentMonitoring.map((e) => (
                <tr key={e.id}>
                  <td className="mono">{e.timestamp ? new Date(e.timestamp).toLocaleString("id-ID", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-"}</td>
                  <td>
                    <Link to={`/patient-history?patientId=${e.patientId}`}>{e.patientName}</Link>
                    {e.patientMrn && <span className="stat-sub"> ({e.patientMrn})</span>}
                  </td>
                  <td>{PARAM_LABEL_ID[e.parameterType] || e.parameterType}</td>
                  <td>{e.value} {e.unit}</td>
                  <td>{e.symptom || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}
