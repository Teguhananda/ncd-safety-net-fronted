import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { useAlarmSound } from "../lib/alarmSound";

/**
 * PrehospitalAlarm.jsx — BARU (Sept 2026). Dipasang SEKALI di App.jsx,
 * jadi aktif di semua halaman staff (bukan hanya Dasbor).
 *
 * - Role UGD: sirene + suara berulang tiap 20 detik selama ada kasus
 *   berstatus WAITING_UGD_READY / WAITING_UGD_DECISION. Berhenti sendiri
 *   begitu dokter jaga UGD memberi keputusan.
 * - Role Ambulans RSUD: sirene + suara berulang selama ada kasus
 *   WAITING_AMBULANCE_CONFIRM (UGD sudah menjawab, menunggu konfirmasi tim).
 *
 * Keterbatasan: suara hanya berbunyi saat aplikasi staff TERBUKA di layar.
 * Saat tertutup, yang masuk hanya push notifikasi biasa.
 */
const UGD_WAIT = ["WAITING_UGD_READY", "WAITING_UGD_DECISION"];
const AMB_WAIT = ["WAITING_AMBULANCE_CONFIRM"];
const REPEAT_MS = 20000;

function speechFor(c, role) {
  const p = c.patient || {};
  const who = `pasien ${p.name || "tidak dikenal"}${p.age ? `, ${p.age} tahun` : ""}`;
  const v = (c.data && c.data.circulation) || {};
  const b = (c.data && c.data.breathing) || {};
  const dm = (c.data && c.data.dm) || {};
  const vit = [
    v.sbp ? `tekanan darah ${v.sbp} per ${v.dbp || "tidak diketahui"}` : null,
    v.hr ? `nadi ${v.hr}` : null,
    b.spo2 ? `saturasi ${b.spo2} persen` : null,
    dm.gdsHi ? "gula darah sangat tinggi" : dm.gds ? `gula darah ${dm.gds}` : null,
  ].filter(Boolean).join(", ");
  const reason = [...((c.triage && c.triage.merah) || []), ...((c.triage && c.triage.kuning) || [])][0] || "";

  if (role === "ugd") {
    if (c.status === "WAITING_UGD_DECISION") {
      return `Perhatian UGD. Laporan pra rumah sakit kategori hijau, ${who}. Tim ambulans mengusulkan pasien tidak dibawa. Mohon keputusan dokter jaga. ${vit}.`;
    }
    const esc = c.escalations && c.escalations.length > 0 ? "Kondisi pasien memburuk. " : "";
    return `Perhatian UGD. ${esc}Pasien kategori ${c.finalCategory === "MERAH" ? "merah, mengancam nyawa" : "kuning"}, sedang dibawa ke UGD. ${who}. ${reason}. ${vit}. Mohon siapkan penerimaan dan tekan siap menerima.`;
  }
  const ask = c.ugdDecision === "TRANSPORT" ? "UGD meminta pasien dibawa" : "UGD menyetujui pasien tidak dibawa";
  return `Balasan UGD untuk ${who}. ${ask}. Mohon konfirmasi di aplikasi.`;
}

export default function PrehospitalAlarm() {
  const { role, user } = useAuth();
  const [cases, setCases] = useState([]);
  const { audioUnlocked, playBeep, speak } = useAlarmSound();
  const announcedRef = useRef(new Set());
  const location = useLocation();

  const watchStatuses = role === "ugd" ? UGD_WAIT : role === "ambulance_rsud" ? AMB_WAIT : null;

  useEffect(() => {
    if (!user || !watchStatuses) return undefined;
    const q = query(collection(db, "prehospital_assessments"), where("closed", "==", false));
    const unsub = onSnapshot(
      q,
      (snap) => setCases(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.error("Alarm pra-RS gagal dimuat:", err)
    );
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role]);

  const waiting = watchStatuses
    ? cases
        .filter((c) => watchStatuses.includes(c.status))
        .sort((a, b) => (b.finalCategory === "MERAH") - (a.finalCategory === "MERAH"))
    : [];

  // Bunyi SEGERA untuk kasus/status baru
  useEffect(() => {
    if (!audioUnlocked) return;
    waiting.forEach((c) => {
      const key = `${c.id}:${c.status}:${(c.escalations || []).length}`;
      if (announcedRef.current.has(key)) return;
      announcedRef.current.add(key);
      playBeep(c.finalCategory === "MERAH");
      setTimeout(() => speak(speechFor(c, role), true), 1300);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cases, audioUnlocked]);

  // Bunyi BERULANG sampai ada keputusan
  useEffect(() => {
    if (!audioUnlocked || waiting.length === 0) return undefined;
    const t = setInterval(() => {
      playBeep(waiting[0].finalCategory === "MERAH");
      setTimeout(() => speak(speechFor(waiting[0], role), true), 1300);
    }, REPEAT_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting.length, waiting[0] && waiting[0].id, waiting[0] && waiting[0].status, audioUnlocked]);

  if (!watchStatuses || !user) return null;
  const onPage = location.pathname === "/prehospital";

  return (
    <>
      <style>{`@keyframes phBlink{0%,100%{background:#c0392b}50%{background:#1f4fd1}}`}</style>
      {!audioUnlocked && (
        <div style={{ position: "fixed", bottom: 16, left: 16, zIndex: 9999, background: "#f5a623", color: "#111", padding: "10px 14px", borderRadius: 12, fontWeight: 700, fontSize: 14, boxShadow: "0 4px 18px rgba(0,0,0,.35)", maxWidth: 320 }}>
          🔊 Ketuk layar sekali untuk mengaktifkan alarm suara {role === "ugd" ? "UGD" : "ambulans"}.
        </div>
      )}
      {waiting.length > 0 && (
        <Link
          to="/prehospital"
          style={{
            position: "fixed", top: "calc(env(safe-area-inset-top, 0px) + 10px)", left: "50%", transform: "translateX(-50%)",
            zIndex: 9999, color: "#fff", padding: "12px 18px", borderRadius: 14, fontWeight: 800, fontSize: 15,
            textDecoration: "none", animation: "phBlink 1s infinite", boxShadow: "0 6px 24px rgba(0,0,0,.45)",
            width: "min(92vw, 560px)", textAlign: "center",
          }}
        >
          {role === "ugd"
            ? `🚑 ${waiting.length} kasus pra-RS menunggu keputusan UGD — ${waiting[0].patient?.name || ""} (${waiting[0].finalCategory})`
            : `🚑 UGD sudah menjawab — ${waiting[0].patient?.name || ""}. Mohon konfirmasi.`}
          {!onPage && <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>Ketuk untuk membuka</div>}
        </Link>
      )}
    </>
  );
}
