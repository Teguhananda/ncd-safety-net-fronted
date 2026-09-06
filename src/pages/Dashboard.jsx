import { useEffect, useRef, useState } from "react";
import { collection, getDocs, doc, getDoc, updateDoc, onSnapshot, orderBy, limit, query, where } from "firebase/firestore";
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

// ==== BAGIAN BARU: lonceng notifikasi staff ====
// Koleksi "notifications" (lib/notifications.js) cuma nyimpan PENUNJUK
// (toRole, type, relatedEntityId) — bukan teks siap tampil. Jadi di sini
// kita "terjemahkan": ambil dokumen aslinya (safety_signals /
// risk_assessments / followups tergantung type), lalu ambil nama pasien.
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

function useStaffNotifications(role) {
  const [rawNotifs, setRawNotifs] = useState([]);
  const [enriched, setEnriched] = useState([]);
  const cacheRef = useRef({}); // key: `${type}:${relatedEntityId}` -> enrichment data

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
    }, () => {
      // gagal subscribe (misal index belum dibuat) — diamkan, lonceng
      // tetap tampil kosong, tidak boleh mengganggu Dashboard utama.
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
        try {
          if (collectionName && n.relatedEntityId) {
            const entitySnap = await getDoc(doc(db, collectionName, n.relatedEntityId));
            if (entitySnap.exists()) {
              const entity = entitySnap.data();
              patientId = entity.patientId || null;
              if (collectionName === "safety_signals") {
                detail = Array.isArray(entity.reason) && entity.reason.length > 0 ? entity.reason[0] : (entity.status || "");
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
        const enrichment = { patientName, patientId, detail };
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

  // ==== BAGIAN BARU: state lonceng notifikasi staff ====
  const staffNotifs = useStaffNotifications(role);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const unreadNotifCount = staffNotifs.filter((n) => !n.isRead).length;

  const handleAckNotif = async (n) => {
    if (n.isRead) return;
    try {
      await updateDoc(doc(db, "notifications", n.id), { isRead: true });
    } catch {
      // gagal update — tidak fatal, badge cuma tetap kehitung sampai berhasil
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

  useEffect(() => {
    async function load() {
      // Ambil 7 snapshot terakhir (dihasilkan scheduled function computeAnalyticsSummary)
      const summarySnap = await getDocs(
        query(collection(db, "analytics_summary"), orderBy("generatedAt", "desc"), limit(7))
      );
      const summaries = summarySnap.docs.map((d) => ({ periodId: d.id, ...d.data() }));
      if (summaries.length > 0) setSummary(summaries[0]);
      setHistory([...summaries].reverse());

      // Pasien dengan status HIGH/RED_FLAG terbaru
      const riskSnap = await getDocs(
        query(collection(db, "risk_assessments"), orderBy("createdAt", "desc"), limit(20))
      );
      const attention = riskSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((r) => r.riskStatus === "HIGH" || r.riskStatus === "RED_FLAG")
        .slice(0, 5);

      // Ambil nama pasien dari koleksi "patients" berdasarkan patientId
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

      // Home Safety Signals — hitung sinyal aktif (belum CLOSED) dari
      // pemantauan mandiri pasien di rumah (bagian J spesifikasi baru).
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

      // BAGIAN BARU: aktivitas monitoring mandiri terbaru dari semua pasien
      try {
        const res = await callApi("patientHistory", { action: "recentMonitoring" });
        setRecentMonitoring(res.data.entries || []);
      } catch (err) {
        // diamkan — widget tambahan
      }
    }
    load();
  }, []);

  const dist = summary?.riskDistribution || { low: 0, moderate: 0, high: 0, redFlag: 0 };
  const total = dist.low + dist.moderate + dist.high + dist.redFlag || 1;
  const pct = (n) => Math.round((n / total) * 100);

  return (
    <Layout title="Dashboard" meta="Ringkasan keselamatan pasien NCD">
      {/* BAGIAN BARU: lonceng notifikasi staff — melayang pojok kanan atas
          supaya tetap terlihat di halaman Dashboard tanpa perlu ubah Layout.jsx */}
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
            {staffNotifs.length === 0 ? (
              <div className="stat-sub">Belum ada notifikasi.</div>
            ) : (
              staffNotifs.map((n) => {
                const meta = NOTIF_TYPE_LABEL[n.type] || { text: n.type, color: "#888" };
                return (
                  <div
                    key={n.id}
                    onClick={() => handleAckNotif(n)}
                    style={{
                      padding: "10px 8px",
                      borderBottom: "1px solid var(--line, rgba(255,255,255,0.08))",
                      cursor: "pointer",
                      background: n.isRead ? "transparent" : "rgba(255,92,80,0.06)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ color: meta.color, fontWeight: 700, fontSize: 13 }}>{meta.text}</span>
                      {!n.isRead && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ff5c50", marginTop: 4 }} />}
                    </div>
                    <div style={{ fontSize: 13, marginTop: 3 }}>
                      {n.patientId ? (
                        <Link to={`/patient-history?patientId=${n.patientId}`} onClick={(e) => e.stopPropagation()}>{n.patientName}</Link>
                      ) : (
                        n.patientName
                      )}
                    </div>
                    {n.detail && <div className="stat-sub" style={{ fontSize: 12 }}>{n.detail}</div>}
                    <div className="stat-sub" style={{ fontSize: 11, marginTop: 2 }}>
                      {n.createdAt ? n.createdAt.toLocaleString("id-ID", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-"}
                    </div>
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

      {/* BAGIAN BARU: aktivitas monitoring mandiri terbaru dari SEMUA
          pasien — bukan cuma yang lagi kena Home Safety Signal. */}
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
