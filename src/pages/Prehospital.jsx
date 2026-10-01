import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import Layout from "../components/Layout";
import { db } from "../lib/firebase";
import { callApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { CATEGORY, computeTriage, buildSbar, hoursSince } from "../lib/prehospitalTriage";

/**
 * Prehospital.jsx — BARU (Sept 2026): Asesmen Pra-Rumah Sakit & Kasus Masuk UGD.
 *
 * - Ambulans RSUD : mulai asesmen dari panggilan SOS, isi form ABCDE + NEWS2
 *                   + modul HT/Stroke/DM/Nyeri dada, kirim ke UGD, konfirmasi.
 * - UGD           : lihat laporan masuk, "Siap Menerima" atau putuskan kasus HIJAU.
 * - PSC 119, dokter, PMKP, case manager, admin : pantau (baca saja).
 *
 * Harus sama dengan ASSESSOR_ROLES di backend api/prehospital.js.
 */
const ASSESSOR_ROLES = ["ambulance_rsud"];
const UGD_ROLES = ["ugd", "admin"];

const STATUS_LABEL = {
  WAITING_UGD_READY: "Menunggu UGD siap menerima",
  WAITING_UGD_DECISION: "Menunggu keputusan dokter jaga UGD",
  WAITING_AMBULANCE_CONFIRM: "UGD sudah menjawab — menunggu konfirmasi tim ambulans",
  UGD_READY: "UGD siap — pasien dalam perjalanan",
  CLOSED_ARRIVED: "Selesai — pasien tiba di UGD",
  CLOSED_NO_TRANSPORT: "Selesai — tidak dibawa (disetujui UGD), tindak lanjut 24 jam",
};

function fmt(ts) {
  if (!ts) return "-";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function nowLocalInput() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

const EMPTY_FORM = {
  chiefComplaint: "",
  onsetTime: "",
  airway: "",
  breathing: { rr: "", spo2: "", onOxygen: false, distress: "tidak" },
  circulation: { hr: "", sbp: "", dbp: "", crt: "<2", skin: "normal", pulseQuality: "kuat", bleeding: false },
  disability: { avpu: "", gcsE: "", gcsV: "", gcsM: "", pupils: "normal" },
  seizure: false,
  exposure: { temp: "", notes: "" },
  ht: { organDamage: { chestPain: false, dyspnea: false, neuroDeficit: false, severeHeadacheVision: false, confusion: false, oliguria: false } },
  stroke: { balance: false, eyes: false, face: false, arm: false, speech: false, lastKnownWell: "" },
  dm: { gds: "", gdsHi: false, kussmaul: false, vomiting: false, dehydration: false, abdominalPain: false },
  chestPain: { present: false, typical: false, ecg: "tidak_ada" },
  interventions: "",
  response: "",
};

// ---------- komponen kecil form ----------
function Section({ title, children }) {
  return (
    <div className="card-list" style={{ background: "var(--surface-2)", marginBottom: 12 }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}
function Grid({ children }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>{children}</div>;
}
function NumField({ label, value, onChange, unit, step }) {
  return (
    <div className="field">
      <label>{label}{unit ? ` (${unit})` : ""}</label>
      <input type="number" inputMode="decimal" step={step || "1"} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
function Select({ label, value, onChange, options }) {
  return (
    <div className="field">
      <label>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
    </div>
  );
}
function Check({ label, checked, onChange }) {
  return (
    <label style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "6px 0", cursor: "pointer", fontSize: 14 }}>
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} style={{ width: 20, height: 20, flexShrink: 0 }} />
      <span>{label}</span>
    </label>
  );
}
function CategoryBadge({ cat, big }) {
  const c = CATEGORY[cat];
  if (!c) return null;
  return (
    <span style={{ background: c.color, color: cat === "KUNING" ? "#111" : "#fff", fontWeight: 800, borderRadius: 8, padding: big ? "6px 12px" : "2px 8px", fontSize: big ? 16 : 12 }}>
      {c.label}
    </span>
  );
}

// ---------- FORM ASESMEN ----------
function AssessmentForm({ candidate, onCancel, onDone }) {
  const [f, setF] = useState(() => ({ ...EMPTY_FORM, onsetTime: nowLocalInput() }));
  const [finalCategory, setFinalCategory] = useState(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const set = (path, value) => {
    setF((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split(".");
      let o = next;
      for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
      o[keys[keys.length - 1]] = value;
      return next;
    });
  };

  const triage = useMemo(() => computeTriage(f), [f]);
  const chosen = finalCategory || triage.suggested;
  const downgraded = CATEGORY[chosen].rank < CATEGORY[triage.suggested].rank;
  const sbar = useMemo(() => buildSbar(f, triage, candidate.patient, chosen), [f, triage, candidate, chosen]);
  const strokeH = hoursSince(f.stroke.lastKnownWell);
  const anyBefast = f.stroke.balance || f.stroke.eyes || f.stroke.face || f.stroke.arm || f.stroke.speech;

  const submit = async () => {
    setErr("");
    if (!f.chiefComplaint.trim()) { setErr("Keluhan utama wajib diisi."); return; }
    if (downgraded && overrideReason.trim().length < 10) { setErr("Kategori diturunkan dari saran sistem — tulis alasan klinis (min. 10 karakter)."); return; }
    const msg = chosen === "HIJAU"
      ? "Kirim usulan TIDAK DIBAWA ke dokter jaga UGD? Pasien tetap harus ditunggui sampai UGD memutuskan."
      : `Kirim laporan kategori ${chosen} ke UGD dan bawa pasien sekarang?`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    try {
      await callApi("prehospital", {
        action: "submitAssessment",
        patientId: candidate.patientId,
        signalId: candidate.signalId || null,
        data: f,
        finalCategory: chosen,
        overrideReason: overrideReason.trim() || null,
      });
      onDone();
    } catch (e) {
      setErr(e.message || "Gagal mengirim asesmen.");
    } finally {
      setBusy(false);
    }
  };

  const p = candidate.patient || {};
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 17 }}>📝 Asesmen Pra-RS — {p.name || candidate.patientId}</div>
          <div className="stat-sub">{p.mrn ? `No.RM ${p.mrn}` : ""}{p.age ? ` · ${p.age} th` : ""}{p.conditions ? ` · ${p.conditions}` : ""}</div>
        </div>
        <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>Batal</button>
      </div>

      <div className="stat-sub" style={{ marginBottom: 12 }}>
        ⚠️ Jika pasien jelas kritis (henti napas/jantung, tidak sadar, sesak berat), <b>tangani & bawa dulu</b> — form boleh dilengkapi di dalam ambulans.
      </div>

      <Section title="Keluhan">
        <div className="field">
          <label>Keluhan utama *</label>
          <input value={f.chiefComplaint} onChange={(e) => set("chiefComplaint", e.target.value)} placeholder="mis. nyeri kepala hebat, lemas separuh badan" />
        </div>
        <div className="field">
          <label>Mulai keluhan (onset)</label>
          <input type="datetime-local" value={f.onsetTime} onChange={(e) => set("onsetTime", e.target.value)} />
        </div>
      </Section>

      <Section title="A — Airway (jalan napas)">
        <Select label="Jalan napas" value={f.airway} onChange={(v) => set("airway", v)} options={[["", "— pilih —"], ["paten", "Paten / bebas"], ["parsial", "Tersumbat sebagian (snoring/gurgling/stridor)"], ["tersumbat", "Tersumbat total"]]} />
      </Section>

      <Section title="B — Breathing (pernapasan)">
        <Grid>
          <NumField label="Frekuensi napas" unit="x/mnt" value={f.breathing.rr} onChange={(v) => set("breathing.rr", v)} />
          <NumField label="SpO2" unit="%" value={f.breathing.spo2} onChange={(v) => set("breathing.spo2", v)} />
          <Select label="Distres napas" value={f.breathing.distress} onChange={(v) => set("breathing.distress", v)} options={[["tidak", "Tidak ada"], ["ringan", "Ringan–sedang"], ["berat", "Berat (retraksi, bicara terputus)"], ["apnea", "Henti napas"]]} />
        </Grid>
        <Check label="Sedang memakai oksigen tambahan" checked={f.breathing.onOxygen} onChange={(v) => set("breathing.onOxygen", v)} />
      </Section>

      <Section title="C — Circulation (sirkulasi)">
        <Grid>
          <NumField label="TD sistolik" unit="mmHg" value={f.circulation.sbp} onChange={(v) => set("circulation.sbp", v)} />
          <NumField label="TD diastolik" unit="mmHg" value={f.circulation.dbp} onChange={(v) => set("circulation.dbp", v)} />
          <NumField label="Nadi" unit="x/mnt" value={f.circulation.hr} onChange={(v) => set("circulation.hr", v)} />
          <Select label="Kualitas nadi" value={f.circulation.pulseQuality} onChange={(v) => set("circulation.pulseQuality", v)} options={[["kuat", "Kuat, teratur"], ["lemah", "Lemah / cepat"], ["tidak_teraba", "Tidak teraba"]]} />
          <Select label="CRT" value={f.circulation.crt} onChange={(v) => set("circulation.crt", v)} options={[["<2", "< 2 detik"], [">2", "> 2 detik"]]} />
          <Select label="Kulit / akral" value={f.circulation.skin} onChange={(v) => set("circulation.skin", v)} options={[["normal", "Normal, hangat"], ["pucat_dingin", "Pucat, dingin, basah"], ["sianosis", "Sianosis"]]} />
        </Grid>
        <Check label="Perdarahan aktif yang sulit dihentikan" checked={f.circulation.bleeding} onChange={(v) => set("circulation.bleeding", v)} />
      </Section>

      <Section title="D — Disability (kesadaran & neurologis)">
        <Grid>
          <Select label="AVPU" value={f.disability.avpu} onChange={(v) => set("disability.avpu", v)} options={[["", "— pilih —"], ["A", "A — Sadar penuh"], ["C", "C — Bingung/confusion BARU"], ["V", "V — Respons suara"], ["P", "P — Respons nyeri"], ["U", "U — Tidak respons"]]} />
          <Select label="GCS Mata (E)" value={f.disability.gcsE} onChange={(v) => set("disability.gcsE", v)} options={[["", "-"], ["4", "4"], ["3", "3"], ["2", "2"], ["1", "1"]]} />
          <Select label="GCS Verbal (V)" value={f.disability.gcsV} onChange={(v) => set("disability.gcsV", v)} options={[["", "-"], ["5", "5"], ["4", "4"], ["3", "3"], ["2", "2"], ["1", "1"]]} />
          <Select label="GCS Motorik (M)" value={f.disability.gcsM} onChange={(v) => set("disability.gcsM", v)} options={[["", "-"], ["6", "6"], ["5", "5"], ["4", "4"], ["3", "3"], ["2", "2"], ["1", "1"]]} />
          <Select label="Pupil" value={f.disability.pupils} onChange={(v) => set("disability.pupils", v)} options={[["normal", "Isokor, reaktif"], ["anisokor", "Anisokor"], ["tidak_reaktif", "Tidak reaktif"]]} />
        </Grid>
        {triage.gcs !== null && <div className="stat-sub">GCS total: <b>{triage.gcs}</b></div>}
        <Check label="Kejang" checked={f.seizure} onChange={(v) => set("seizure", v)} />
      </Section>

      <Section title="E — Exposure">
        <Grid>
          <NumField label="Suhu" unit="°C" step="0.1" value={f.exposure.temp} onChange={(v) => set("exposure.temp", v)} />
        </Grid>
        <div className="field">
          <label>Temuan lain (luka, edema, dll.)</label>
          <input value={f.exposure.notes} onChange={(e) => set("exposure.notes", e.target.value)} />
        </div>
      </Section>

      <Section title="Modul Hipertensi — tanda kerusakan organ target">
        <div className="stat-sub" style={{ marginBottom: 4 }}>Dinilai bila TD ≥ 180/120. Ada tanda di bawah = hipertensi EMERGENSI.</div>
        <Check label="Nyeri dada" checked={f.ht.organDamage.chestPain} onChange={(v) => set("ht.organDamage.chestPain", v)} />
        <Check label="Sesak / tanda edema paru (ronki, batuk berbusa)" checked={f.ht.organDamage.dyspnea} onChange={(v) => set("ht.organDamage.dyspnea", v)} />
        <Check label="Defisit neurologis (lemah separuh badan, bicara pelo)" checked={f.ht.organDamage.neuroDeficit} onChange={(v) => set("ht.organDamage.neuroDeficit", v)} />
        <Check label="Sakit kepala hebat + gangguan penglihatan" checked={f.ht.organDamage.severeHeadacheVision} onChange={(v) => set("ht.organDamage.severeHeadacheVision", v)} />
        <Check label="Bingung / gelisah" checked={f.ht.organDamage.confusion} onChange={(v) => set("ht.organDamage.confusion", v)} />
        <Check label="Kencing sangat sedikit" checked={f.ht.organDamage.oliguria} onChange={(v) => set("ht.organDamage.oliguria", v)} />
      </Section>

      <Section title="Modul Stroke — BE-FAST">
        <Check label="B — Balance: tiba-tiba hilang keseimbangan / pusing berputar" checked={f.stroke.balance} onChange={(v) => set("stroke.balance", v)} />
        <Check label="E — Eyes: tiba-tiba penglihatan kabur/ganda/hilang" checked={f.stroke.eyes} onChange={(v) => set("stroke.eyes", v)} />
        <Check label="F — Face: wajah mencong saat tersenyum" checked={f.stroke.face} onChange={(v) => set("stroke.face", v)} />
        <Check label="A — Arm: satu lengan/tungkai lemah" checked={f.stroke.arm} onChange={(v) => set("stroke.arm", v)} />
        <Check label="S — Speech: bicara pelo / sulit dimengerti" checked={f.stroke.speech} onChange={(v) => set("stroke.speech", v)} />
        {anyBefast && (
          <div className="field">
            <label>Terakhir terlihat normal (last known well)</label>
            <input type="datetime-local" value={f.stroke.lastKnownWell} onChange={(e) => set("stroke.lastKnownWell", e.target.value)} />
            {strokeH !== null && (
              <div style={{ marginTop: 6, fontWeight: 700, color: strokeH <= 4.5 ? "#ff5c50" : undefined }}>
                {strokeH <= 4.5 ? `⏱️ ${strokeH.toFixed(1)} jam — MASIH dalam jendela 4,5 jam, segera ke UGD!` : `${strokeH.toFixed(1)} jam sejak terakhir normal`}
              </div>
            )}
          </div>
        )}
      </Section>

      <Section title="Modul Diabetes">
        <Grid>
          <NumField label="GDS" unit="mg/dL" value={f.dm.gds} onChange={(v) => set("dm.gds", v)} />
        </Grid>
        <Check label='Glukometer menunjukkan "HI" (terlalu tinggi)' checked={f.dm.gdsHi} onChange={(v) => set("dm.gdsHi", v)} />
        <Check label="Napas cepat dalam (Kussmaul) / bau keton" checked={f.dm.kussmaul} onChange={(v) => set("dm.kussmaul", v)} />
        <Check label="Muntah terus-menerus" checked={f.dm.vomiting} onChange={(v) => set("dm.vomiting", v)} />
        <Check label="Dehidrasi berat (mulut sangat kering, turgor jelek)" checked={f.dm.dehydration} onChange={(v) => set("dm.dehydration", v)} />
        <Check label="Nyeri perut" checked={f.dm.abdominalPain} onChange={(v) => set("dm.abdominalPain", v)} />
      </Section>

      <Section title="Nyeri Dada / EKG">
        <Check label="Ada nyeri dada" checked={f.chestPain.present} onChange={(v) => set("chestPain.present", v)} />
        {f.chestPain.present && (
          <Check label="Khas SKA: tertekan/berat > 20 menit, menjalar ke lengan/rahang, keringat dingin" checked={f.chestPain.typical} onChange={(v) => set("chestPain.typical", v)} />
        )}
        <Select label="EKG (bila tersedia)" value={f.chestPain.ecg} onChange={(v) => set("chestPain.ecg", v)} options={[["tidak_ada", "Tidak dilakukan / tidak tersedia"], ["normal", "Normal / sinus"], ["stemi", "STEMI"], ["iskemia", "Iskemia non-ST elevasi"], ["aritmia_berbahaya", "Aritmia berbahaya (VT/VF/AV blok total/bradikardia berat)"], ["aritmia_lain", "Aritmia lain yang stabil (mis. AF respons terkontrol)"]]} />
      </Section>

      <Section title="Tindakan di Lokasi">
        <div className="field">
          <label>Tindakan yang dilakukan</label>
          <input value={f.interventions} onChange={(e) => set("interventions", e.target.value)} placeholder="mis. O2 nasal 3 lpm, posisi semi-fowler, dekstrosa 40% ..." />
        </div>
        <Select label="Respons setelah tindakan" value={f.response} onChange={(v) => set("response", v)} options={[["", "— pilih —"], ["membaik", "Membaik"], ["tetap", "Tetap"], ["memburuk", "Memburuk"]]} />
      </Section>

      {/* ---- HASIL ---- */}
      <div className="card-list" style={{ border: `2px solid ${CATEGORY[triage.suggested].color}`, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <b>Saran sistem:</b> <CategoryBadge cat={triage.suggested} big />
          <span className="stat-sub">NEWS2 {triage.news2.total} ({triage.news2.risk}){triage.news2.complete ? "" : " — belum lengkap"}</span>
        </div>
        {triage.merah.length > 0 && (
          <ul style={{ margin: "8px 0 0 18px", color: "#ff5c50" }}>{triage.merah.map((r, i) => <li key={i}>{r}</li>)}</ul>
        )}
        {triage.kuning.length > 0 && (
          <ul style={{ margin: "6px 0 0 18px", color: "#f5a623" }}>{triage.kuning.map((r, i) => <li key={i}>{r}</li>)}</ul>
        )}
        {triage.suggested === "HIJAU" && <div className="stat-sub" style={{ marginTop: 6 }}>Tidak ditemukan tanda gawat darurat. Usulan tidak dibawa tetap WAJIB disetujui dokter jaga UGD.</div>}

        <div style={{ marginTop: 12, fontWeight: 700 }}>Kategori yang ditetapkan tim ambulans:</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
          {["MERAH", "KUNING", "HIJAU"].map((k) => (
            <button
              key={k}
              className="btn"
              onClick={() => setFinalCategory(k)}
              style={{
                background: chosen === k ? CATEGORY[k].color : "transparent",
                color: chosen === k ? (k === "KUNING" ? "#111" : "#fff") : "inherit",
                border: `2px solid ${CATEGORY[k].color}`,
                fontWeight: 800,
              }}
            >
              {k}
            </button>
          ))}
        </div>
        <div className="stat-sub" style={{ marginTop: 4 }}>{CATEGORY[chosen].desc}. Ragu-ragu = bawa.</div>
        {downgraded && (
          <div className="field" style={{ marginTop: 8 }}>
            <label style={{ color: "#ff5c50" }}>Alasan klinis menurunkan kategori dari {triage.suggested} *</label>
            <input value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
          </div>
        )}
      </div>

      <details style={{ marginBottom: 12 }}>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>Pratinjau serah terima (SBAR) yang dikirim ke UGD</summary>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: 13, marginTop: 8, fontFamily: "inherit" }}>{sbar}</pre>
      </details>

      {err && <div className="error-text" style={{ marginBottom: 8 }}>{err}</div>}
      <button className="btn btn-primary" style={{ width: "100%", padding: 14, fontSize: 16, background: CATEGORY[chosen].color, color: chosen === "KUNING" ? "#111" : "#fff" }} disabled={busy} onClick={submit}>
        {busy ? "Mengirim..." : chosen === "HIJAU" ? "Kirim usulan TIDAK DIBAWA ke dokter UGD" : `Kirim ke UGD & bawa pasien (${chosen})`}
      </button>
    </div>
  );
}

// ---------- KARTU KASUS ----------
function CaseCard({ c, role, onChanged }) {
  const [doctorName, setDoctorName] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [checklist, setChecklist] = useState({ educationGiven: false, dangerSignsExplained: false, patientAgrees: false, consentName: "", relation: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const p = c.patient || {};
  const d = c.data || {};
  const isUgd = UGD_ROLES.includes(role);
  const isAssessor = ASSESSOR_ROLES.includes(role);
  const cat = CATEGORY[c.finalCategory] || CATEGORY.KUNING;

  const call = async (payload, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setErr("");
    setBusy(true);
    try {
      await callApi("prehospital", { id: c.id, ...payload });
      onChanged && onChanged();
    } catch (e) {
      setErr(e.message || "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  };

  const escalate = () => {
    const n = window.prompt("Kondisi memburuk — tulis singkat perburukannya (mis. 'penurunan kesadaran, SpO2 85%'):");
    if (n) call({ action: "escalate", note: n });
  };

  return (
    <div className="card-list" style={{ border: `2px solid ${cat.color}`, marginBottom: 12, background: "var(--surface-2)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <div>
          <CategoryBadge cat={c.finalCategory} /> <b style={{ fontSize: 16 }}>{p.name || c.patientId}</b>
          <span className="stat-sub"> {p.age ? `· ${p.age} th` : ""} {p.mrn ? `· No.RM ${p.mrn}` : ""}</span>
        </div>
        <span className="stat-sub">Dikirim {fmt(c.submittedAt)}</span>
      </div>
      <div style={{ margin: "6px 0", fontWeight: 700 }}>{STATUS_LABEL[c.status] || c.status}</div>
      <div style={{ fontSize: 14 }}>Keluhan: {d.chiefComplaint || "-"}</div>
      <div style={{ fontSize: 14 }}>
        TD {d.circulation?.sbp || "?"}/{d.circulation?.dbp || "?"} · Nadi {d.circulation?.hr || "?"} · RR {d.breathing?.rr || "?"} · SpO2 {d.breathing?.spo2 || "?"}% · Suhu {d.exposure?.temp || "?"} · AVPU {d.disability?.avpu || "?"}
        {d.dm?.gds || d.dm?.gdsHi ? ` · GDS ${d.dm.gdsHi ? "HI" : d.dm.gds}` : ""} · <b>NEWS2 {c.triage?.news2 ?? "?"}</b>
      </div>
      {(c.triage?.merah?.length > 0 || c.triage?.kuning?.length > 0) && (
        <ul style={{ margin: "6px 0 0 18px", fontSize: 13 }}>
          {(c.triage.merah || []).map((r, i) => <li key={"m" + i} style={{ color: "#ff5c50" }}>{r}</li>)}
          {(c.triage.kuning || []).map((r, i) => <li key={"k" + i} style={{ color: "#f5a623" }}>{r}</li>)}
        </ul>
      )}
      {c.downgraded && (
        <div style={{ marginTop: 6, fontSize: 13, color: "#ff5c50" }}>
          ⚠️ Diturunkan dari saran sistem ({c.triage?.suggested}). Alasan: {c.overrideReason}
        </div>
      )}
      {(c.escalations || []).map((e, i) => (
        <div key={i} style={{ marginTop: 6, fontSize: 13, color: "#ff5c50", fontWeight: 700 }}>🔺 Perburukan ({fmt(e.at)}): {e.note}</div>
      ))}
      {c.ugdDoctorName && (
        <div style={{ marginTop: 6, fontSize: 13 }}>
          🩺 Dokter jaga UGD: <b>{c.ugdDoctorName}</b>
          {c.ugdDecision === "APPROVE_NO_TRANSPORT" && " — MENYETUJUI tidak dibawa"}
          {c.ugdDecision === "TRANSPORT" && " — MEMINTA pasien dibawa"}
          {c.ugdDecision === "READY" && " — siap menerima"}
          {c.ugdDecisionNote && <div>Instruksi: {c.ugdDecisionNote}</div>}
        </div>
      )}
      {c.ambulanceConfirm?.checklist?.consentName && (
        <div style={{ marginTop: 6, fontSize: 13 }}>✍️ Disetujui oleh: {c.ambulanceConfirm.checklist.consentName} {c.ambulanceConfirm.checklist.relation ? `(${c.ambulanceConfirm.checklist.relation})` : ""}</div>
      )}
      <div className="stat-sub" style={{ marginTop: 4 }}>Petugas ambulans: {c.submittedBy?.name || "-"}</div>

      <details style={{ marginTop: 8 }}>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>Serah terima SBAR</summary>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: 13, marginTop: 6, fontFamily: "inherit" }}>{c.sbar}</pre>
      </details>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        {c.mapsUrl && <a className="btn btn-ghost" style={{ textDecoration: "none" }} href={c.mapsUrl} target="_blank" rel="noopener noreferrer">📍 Lokasi pasien</a>}
        <Link className="btn btn-ghost" style={{ textDecoration: "none" }} to={`/patient-history?patientId=${c.patientId}`}>Riwayat pasien</Link>
      </div>

      {/* ---- aksi UGD ---- */}
      {isUgd && ["WAITING_UGD_READY", "WAITING_UGD_DECISION"].includes(c.status) && (
        <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: "var(--glass-bg)" }}>
          <div className="field">
            <label>Nama dokter jaga UGD *</label>
            <input value={doctorName} onChange={(e) => setDoctorName(e.target.value)} placeholder="dr. ..." />
          </div>
          {c.status === "WAITING_UGD_READY" && (
            <button className="btn btn-primary" disabled={busy} style={{ width: "100%", padding: 12 }} onClick={() => call({ action: "ugdRespond", response: "READY", doctorName })}>
              ✅ UGD Siap Menerima
            </button>
          )}
          {c.status === "WAITING_UGD_DECISION" && (
            <>
              <div className="field">
                <label>Instruksi / saran untuk pasien (wajib bila tidak dibawa)</label>
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="mis. lanjut obat, kontrol poli besok, kembali bila ..." />
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn btn-primary" disabled={busy} style={{ flex: 1, background: "#f5a623", color: "#111" }} onClick={() => call({ action: "ugdRespond", response: "TRANSPORT", doctorName, note })}>
                  🚑 Minta Dibawa ke UGD
                </button>
                <button className="btn btn-primary" disabled={busy} style={{ flex: 1, background: "#2ecc71" }} onClick={() => call({ action: "ugdRespond", response: "APPROVE_NO_TRANSPORT", doctorName, note }, "Setujui pasien TIDAK dibawa ke UGD? Keputusan ini tercatat atas nama dokter jaga.")}>
                  🟢 Setujui Tidak Dibawa
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ---- aksi ambulans ---- */}
      {isAssessor && c.status === "WAITING_AMBULANCE_CONFIRM" && (
        <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: "var(--glass-bg)" }}>
          {c.ugdDecision === "TRANSPORT" ? (
            <button className="btn btn-primary" disabled={busy} style={{ width: "100%", padding: 12 }} onClick={() => call({ action: "ambulanceConfirm", choice: "TRANSPORT" })}>
              🚑 Konfirmasi — Bawa Pasien ke UGD
            </button>
          ) : (
            <>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Checklist sebelum pasien ditinggal di rumah:</div>
              <Check label="Edukasi kondisi & obat sudah diberikan" checked={checklist.educationGiven} onChange={(v) => setChecklist((x) => ({ ...x, educationGiven: v }))} />
              <Check label="Tanda bahaya & kapan menekan SOS lagi sudah dijelaskan" checked={checklist.dangerSignsExplained} onChange={(v) => setChecklist((x) => ({ ...x, dangerSignsExplained: v }))} />
              <Check label="Pasien/keluarga memahami dan SETUJU tidak dibawa" checked={checklist.patientAgrees} onChange={(v) => setChecklist((x) => ({ ...x, patientAgrees: v }))} />
              <Grid>
                <div className="field"><label>Nama yang menyetujui *</label><input value={checklist.consentName} onChange={(e) => setChecklist((x) => ({ ...x, consentName: e.target.value }))} /></div>
                <div className="field"><label>Hubungan</label><input value={checklist.relation} onChange={(e) => setChecklist((x) => ({ ...x, relation: e.target.value }))} placeholder="pasien / istri / anak ..." /></div>
              </Grid>
              <button className="btn btn-primary" disabled={busy} style={{ width: "100%", padding: 12, background: "#2ecc71", marginTop: 6 }} onClick={() => call({ action: "ambulanceConfirm", choice: "NO_TRANSPORT", checklist })}>
                🟢 Konfirmasi Tidak Dibawa
              </button>
              <div className="field" style={{ marginTop: 10 }}>
                <label>…atau tetap bawa — alasan (pasien/keluarga minta, tim ragu)</label>
                <input value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              <button className="btn btn-ghost" disabled={busy} style={{ width: "100%" }} onClick={() => call({ action: "ambulanceConfirm", choice: "TRANSPORT", reason })}>
                🚑 Tetap Bawa ke UGD
              </button>
            </>
          )}
        </div>
      )}

      {(isAssessor || isUgd) && ["UGD_READY", "WAITING_UGD_READY"].includes(c.status) && c.transportDecision === "TRANSPORT" && (
        <button className="btn btn-ghost" disabled={busy} style={{ width: "100%", marginTop: 8 }} onClick={() => call({ action: "markArrived" }, "Pasien sudah tiba & diserahterimakan di UGD?")}>
          🏥 Pasien Tiba di UGD (selesai)
        </button>
      )}
      {isAssessor && !c.closed && (
        <button className="btn btn-ghost" disabled={busy} style={{ width: "100%", marginTop: 8, color: "#ff5c50", borderColor: "#ff5c50" }} onClick={escalate}>
          🔺 Kondisi Memburuk — Naikkan ke MERAH
        </button>
      )}
      {err && <div className="error-text" style={{ marginTop: 6 }}>{err}</div>}
    </div>
  );
}

// ---------- HALAMAN ----------
export default function Prehospital() {
  const { role } = useAuth();
  const isAssessor = ASSESSOR_ROLES.includes(role);
  const [cases, setCases] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [closed, setClosed] = useState([]);
  const [formFor, setFormFor] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const q = query(collection(db, "prehospital_assessments"), where("closed", "==", false));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        rows.sort((a, b) => (CATEGORY[b.finalCategory]?.rank || 0) - (CATEGORY[a.finalCategory]?.rank || 0) || (b.submittedAt?.toMillis?.() || 0) - (a.submittedAt?.toMillis?.() || 0));
        setCases(rows);
      },
      (err) => setError("Gagal memuat kasus: " + err.message)
    );
    return unsub;
  }, []);

  async function loadSide() {
    try {
      const [c, h] = await Promise.all([
        callApi("prehospital", { action: "listSosCandidates" }),
        callApi("prehospital", { action: "listRecentClosed" }),
      ]);
      setCandidates(c.data.candidates || []);
      setClosed(h.data.items || []);
    } catch (e) {
      setError(e.message || "Gagal memuat data.");
    }
  }
  useEffect(() => { loadSide(); }, [cases.length]);

  const title = role === "ugd" ? "Kasus Masuk UGD" : "Asesmen Pra-Rumah Sakit";
  const waitingSos = candidates.filter((x) => !x.hasOpenAssessment);

  return (
    <Layout title={title} meta="Triase pra-RS standar ABCDE + NEWS2 · Bawa = boleh langsung · Tidak dibawa = wajib persetujuan dokter jaga UGD">
      {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}

      {formFor && (
        <AssessmentForm
          candidate={formFor}
          onCancel={() => setFormFor(null)}
          onDone={() => { setFormFor(null); loadSide(); window.scrollTo(0, 0); }}
        />
      )}

      {!formFor && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>🆘 Panggilan SOS menunggu asesmen ({waitingSos.length})</h3>
            {waitingSos.length === 0 ? (
              <div className="stat-sub">Tidak ada panggilan SOS yang belum diasesmen.</div>
            ) : (
              waitingSos.map((s) => (
                <div key={s.signalId} className="card-list" style={{ background: "rgba(255,92,80,0.12)", border: "2px solid #ff5c50", marginBottom: 10 }}>
                  <b>{s.patient?.name}</b>
                  <span className="stat-sub"> {s.patient?.age ? `· ${s.patient.age} th` : ""} {s.patient?.mrn ? `· No.RM ${s.patient.mrn}` : ""} · SOS {fmt(s.detectedAt)}</span>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                    {s.mapsUrl && <a className="btn btn-ghost" style={{ textDecoration: "none" }} href={s.mapsUrl} target="_blank" rel="noopener noreferrer">📍 Lokasi GPS</a>}
                    {isAssessor ? (
                      <button className="btn btn-primary" onClick={() => setFormFor(s)}>📝 Mulai Asesmen Pra-RS</button>
                    ) : (
                      <span className="stat-sub" style={{ alignSelf: "center" }}>Menunggu tim Ambulans RSUD melakukan asesmen.</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>🚑 Kasus aktif ({cases.length})</h3>
            {cases.length === 0 ? (
              <div className="stat-sub">Belum ada kasus pra-RS yang aktif.</div>
            ) : (
              cases.map((c) => <CaseCard key={c.id} c={c} role={role} onChanged={loadSide} />)
            )}
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Riwayat 7 hari terakhir ({closed.length})</h3>
            {closed.length === 0 ? (
              <div className="stat-sub">Belum ada.</div>
            ) : (
              closed.map((c) => (
                <div key={c.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--line)", fontSize: 14 }}>
                  <CategoryBadge cat={c.finalCategory} /> <b>{c.patient?.name}</b>
                  <span className="stat-sub"> · {STATUS_LABEL[c.status] || c.status} · {fmt(c.closedAt)}</span>
                  {c.ugdDoctorName && <span className="stat-sub"> · dokter jaga: {c.ugdDoctorName}</span>}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </Layout>
  );
}
