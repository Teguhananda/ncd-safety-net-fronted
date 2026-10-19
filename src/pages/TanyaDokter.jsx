import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import { callApi } from "../lib/api";

/**
 * TanyaDokter.jsx — BARU (Okt 2026). Kotak masuk "Tanya Dokter" untuk staff.
 *  - Dokter: hanya melihat pasien yang ia DPJP-i, bisa menjawab atau meminta
 *    keterangan tambahan (balasan pasien tidak memakan jatah harian).
 *  - Perawat/Admin/Case Manager: melihat semua, TIDAK bisa menjawab, punya
 *    tombol "Ingatkan Dokter" (kirim ulang notifikasi ke HP DPJP).
 * Jawaban hanya edukasi — perubahan dosis obat TIDAK lewat chat.
 */

// Template jawaban cepat — dokter tinggal pilih lalu sesuaikan seperlunya.
const ANSWER_TEMPLATES = [
  {
    label: "Diet garam",
    text:
      "Batasi garam maksimal 1 sendok teh sehari (sudah termasuk garam dalam masakan). Kurangi makanan asin: ikan asin, mi instan, kerupuk, makanan kaleng, kecap & saus botolan. Perbanyak sayur dan buah. Tetap minum obat tensi sesuai jadwal.",
  },
  {
    label: "Cara cek gula darah",
    text:
      "Cuci tangan dengan sabun lalu keringkan. Tusuk sisi ujung jari, buang tetes darah pertama bila dianjurkan petugas, lalu teteskan ke strip. Cek gula puasa pagi sebelum makan, atau 2 jam setelah makan sesuai anjuran. Catat hasilnya di menu Kontrol Saya.",
  },
  {
    label: "Cara cek tensi",
    text:
      "Duduk tenang 5 menit sebelum mengukur, punggung bersandar, kaki menapak lantai, lengan diletakkan setinggi jantung. Jangan mengukur setelah merokok, minum kopi, atau olahraga. Ukur 2 kali dengan jarak 1–2 menit, lalu isi hasilnya di menu Kontrol Saya.",
  },
  {
    label: "Lupa minum obat",
    text:
      "Kalau lupa, minum segera begitu ingat. Tetapi kalau sudah dekat dengan jadwal minum berikutnya, lewati dosis yang lupa dan minum seperti biasa. JANGAN minum dua dosis sekaligus. Pasang pengingat dan tekan \"Sudah Minum\" di aplikasi.",
  },
  {
    label: "Aktivitas fisik",
    text:
      "Jalan kaki santai 30 menit sehari, minimal 5 hari seminggu, sangat baik untuk tensi dan gula darah. Mulai pelan-pelan. Hentikan dan istirahat bila nyeri dada, sesak, atau pusing berat — bila tidak membaik segera ke IGD.",
  },
  {
    label: "Soal dosis → saat kontrol",
    text:
      "Untuk perubahan dosis atau jenis obat tidak bisa dilakukan lewat chat. Tetap minum obat sesuai jadwal yang ada sekarang, dan bicarakan saat kontrol berikutnya. Bila ada keluhan berat, segera ke IGD.",
  },
];

const STATUS_INFO = {
  open: { label: "Menunggu jawaban dokter", color: "#c0392b" },
  awaiting_patient: { label: "Menunggu keterangan pasien", color: "#d68910" },
  answered: { label: "Sudah dijawab", color: "#1e8449" },
};

const FILTERS = [
  ["open", "Menunggu jawaban"],
  ["awaiting_patient", "Perlu keterangan pasien"],
  ["answered", "Sudah dijawab"],
  ["all", "Semua (30 hari)"],
];

function fmt(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function QuestionCard({ q, viewer, onChanged }) {
  const [answer, setAnswer] = useState("");
  const [clarify, setClarify] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const isMyPatient = viewer.role === "dokter" && q.dpjpUid === viewer.uid;
  const canRemind = ["admin", "petugas", "case_manager"].includes(viewer.role) && q.status === "open";
  const info = STATUS_INFO[q.status] || STATUS_INFO.open;

  const submitAnswer = async () => {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const res = await callApi("patientHistory", { action: "answerDoctorQuestion", questionId: q.id, text: answer, needsClarification: clarify });
      setAnswer("");
      setClarify(false);
      setMsg(res.data.pushSent ? "Terkirim. Notifikasi masuk ke HP pasien." : "Tersimpan. Notifikasi HP pasien belum aktif — jawaban tetap terlihat saat pasien membuka aplikasi.");
      onChanged();
    } catch (e) {
      setErr(e.message || "Gagal mengirim jawaban.");
    } finally {
      setBusy(false);
    }
  };

  const remind = async () => {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const res = await callApi("patientHistory", { action: "remindDoctor", questionId: q.id });
      setMsg(res.data.pushSent ? "✅ Notifikasi pengingat terkirim ke HP dokter." : "⚠️ Tercatat, tetapi notifikasi HP dokter belum aktif. Hubungi dokter langsung.");
      onChanged();
    } catch (e) {
      setErr(e.message || "Gagal mengingatkan dokter.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card" style={{ marginBottom: 12, borderLeft: `4px solid ${q.dangerOverride ? "#c0392b" : info.color}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <div>
          <b>{q.patientName || q.patientId}</b>
          {q.patientMrn && <span className="mono stat-sub"> · RM {q.patientMrn}</span>}
          <div className="stat-sub">DPJP: {q.dpjpName || "-"} · ditanya {fmt(q.askedAt)}{q.askedOutsideHours ? " (di luar jam layanan)" : ""}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <span style={{ color: info.color, fontWeight: 700, fontSize: 13 }}>{info.label}</span>
          {q.remindCount > 0 && <div className="stat-sub">Diingatkan {q.remindCount}x (terakhir {fmt(q.lastRemindedAt)})</div>}
        </div>
      </div>

      {q.dangerOverride && (
        <div className="alert redflag" style={{ marginTop: 8 }}>
          <span>🚨</span>
          <div>Pertanyaan menyebut tanda bahaya ({(q.dangerKeywords || []).join(", ")}); pasien menyatakan <b>bukan darurat</b>. Pertimbangkan menelepon pasien.</div>
        </div>
      )}

      <div style={{ marginTop: 10 }}>
        {q.messages.map((m, i) => (
          <div
            key={i}
            style={{
              margin: "6px 0",
              padding: "8px 10px",
              borderRadius: 8,
              background: m.from === "doctor" ? "var(--surface-2)" : "transparent",
              border: "1px solid var(--line)",
            }}
          >
            <div className="stat-sub" style={{ fontSize: 11 }}>
              {m.from === "doctor" ? `👨‍⚕️ ${m.byName || "Dokter"}${m.kind === "clarification" ? " — minta keterangan" : ""}` : "🧑 Pasien"} · {fmt(m.at)}
            </div>
            <div style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>{m.text}</div>
          </div>
        ))}
      </div>

      {isMyPatient && q.status === "open" && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
            {ANSWER_TEMPLATES.map((t) => (
              <button key={t.label} type="button" className="btn btn-ghost" style={{ padding: "3px 8px", fontSize: 12 }} onClick={() => setAnswer(t.text)}>
                {t.label}
              </button>
            ))}
          </div>
          <textarea rows={4} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Tulis jawaban edukasi untuk pasien..." style={{ width: "100%" }} maxLength={1500} />
          <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, margin: "6px 0" }}>
            <input type="checkbox" checked={clarify} onChange={(e) => setClarify(e.target.checked)} />
            Ini pertanyaan balik / minta keterangan tambahan (pasien bisa membalas tanpa memakai jatah harian)
          </label>
          <div className="stat-sub" style={{ marginBottom: 6 }}>
            ⚠️ Tanya Dokter hanya untuk edukasi. <b>Jangan mengubah dosis/jenis obat lewat chat</b> — perubahan obat dilakukan saat kontrol atau di Safety Plan.
          </div>
          <button className="btn btn-primary" onClick={submitAnswer} disabled={busy || answer.trim().length < 3}>
            {busy ? "Mengirim..." : clarify ? "Kirim Pertanyaan Balik" : "Kirim Jawaban"}
          </button>
        </div>
      )}

      {viewer.role === "dokter" && !isMyPatient && q.status === "open" && (
        <div className="stat-sub" style={{ marginTop: 8 }}>Hanya DPJP pasien ini yang bisa menjawab.</div>
      )}

      {canRemind && (
        <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={remind} disabled={busy}>
          {busy ? "Mengirim..." : "🔔 Ingatkan Dokter"}
        </button>
      )}

      <div style={{ marginTop: 8 }}>
        <Link className="btn btn-ghost" style={{ padding: "3px 8px", fontSize: 12 }} to={`/patient-history?patientId=${q.patientId}`}>Riwayat pasien</Link>
      </div>
      {msg && <div className="stat-sub" style={{ marginTop: 6 }}>{msg}</div>}
      {err && <div className="error-text" style={{ marginTop: 6 }}>{err}</div>}
    </div>
  );
}

export default function TanyaDokter() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("open");

  async function load() {
    setError("");
    try {
      const res = await callApi("patientHistory", { action: "listDoctorQuestions", days: 30 });
      setData(res.data);
    } catch (e) {
      setError(e.message || "Gagal memuat Tanya Dokter.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 60000); // muat ulang tiap 1 menit
    return () => clearInterval(t);
  }, []);

  const questions = (data?.questions || []).filter((q) => filter === "all" || q.status === filter);
  const viewer = data?.viewer || {};

  return (
    <Layout
      title="Tanya Dokter"
      meta={viewer.role === "dokter" ? "Pertanyaan edukasi dari pasien yang Anda DPJP-i" : "Pantau pertanyaan pasien & ingatkan dokter"}
    >
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <b>Jam layanan: Senin–Sabtu, 10.00–14.00 WIB</b>
            <div className="stat-sub">
              {data?.service?.open ? "🟢 Sedang buka" : "⚪ Sedang tutup"} · 1 pertanyaan per pasien per hari · pengingat otomatis pukul 10.00 & 13.00
            </div>
          </div>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ padding: "8px 12px", border: "1px solid var(--line)", borderRadius: 8, fontSize: 13 }}>
            {FILTERS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}{v === "open" && data ? ` (${data.openCount})` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="stat-sub">Memuat...</div>
      ) : error ? (
        <div className="error-text">{error}</div>
      ) : questions.length === 0 ? (
        <div className="card stat-sub">Tidak ada pertanyaan pada pilihan ini.</div>
      ) : (
        questions.map((q) => <QuestionCard key={q.id} q={q} viewer={viewer} onChanged={load} />)
      )}
    </Layout>
  );
}
