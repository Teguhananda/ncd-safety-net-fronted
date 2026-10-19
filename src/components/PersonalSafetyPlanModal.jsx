import { useEffect, useState } from "react";
import { callApi } from "../lib/api";

const PARAM_OPTIONS = ["systolicBP", "bloodGlucose"];
const PARAM_LABEL = { systolicBP: "Tekanan Darah", bloodGlucose: "Gula Darah" };

// REVISI (Okt 2026): daftar obat + jadwal minum dipindah dari Skrining
// perawat ke sini, dan HANYA bisa diisi DOKTER. Jam pilihan HARUS sama dengan
// SLOT_HOUR_RANGE & DEFAULT_SLOT_HOUR di backend lib/medSchedule.js dan
// tercakup cron vercel.json (04.00–23.00 WIB).
const MED_SLOT_OPTIONS = [
  { key: "pagi", label: "Pagi", min: 4, max: 10, defaultHour: 7 },
  { key: "siang", label: "Siang", min: 11, max: 15, defaultHour: 12 },
  { key: "malam", label: "Malam", min: 16, max: 23, defaultHour: 19 },
];
function hourOptions(min, max) {
  const out = [];
  for (let h = min; h <= max; h++) out.push(h);
  return out;
}
// PERBAIKAN (Okt 2026): CSS global ".field input { width:100% }" ikut
// melebarkan kotak centang → kotak Pagi/Siang/Malam tidak terlihat & teks
// tanda bahaya terdorong ke kanan. Kotak centang diberi ukuran tetap.
const CB = { width: 18, height: 18, minWidth: 18, flex: "0 0 18px", margin: 0, padding: 0, cursor: "pointer", accentColor: "#34d399" };
const CB_LABEL = { fontSize: 13, display: "flex", alignItems: "flex-start", justifyContent: "flex-start", textAlign: "left", gap: 8, margin: "5px 0", cursor: "pointer" };

const emptyMed = () => ({ name: "", dose: "", frequency: "", slots: [], slotTimes: {} });

// ==== BARU (Okt 2026): Tanda Bahaya & Instruksi Eskalasi jadi PILIHAN CENTANG ====
// Supaya dokter tidak perlu mengetik. Disimpan tetap sebagai teks per baris
// (field warningSigns & escalationInstruction yang sama), sehingga Portal
// Pasien menampilkannya per poin tanpa perubahan backend.
// Angka ambang = batas umum (krisis hipertensi ≥180/120, hipoglikemia <70,
// hiperglikemia berat >300) — [perlu validasi Komite Medik].
const WARNING_GROUPS = [
  {
    key: "ht",
    label: "Hipertensi / Jantung / Stroke",
    condition: "Hipertensi",
    items: [
      "Nyeri dada atau dada terasa berat/tertekan",
      "Sesak napas",
      "Lemah/kesemutan separuh badan, wajah mencong, atau bicara pelo",
      "Sakit kepala hebat mendadak, pandangan kabur, atau bingung",
      "Tensi 180/120 mmHg atau lebih saat diukur ulang",
      "Pingsan atau sulit dibangunkan",
    ],
  },
  {
    key: "dm",
    label: "Diabetes Melitus",
    condition: "Diabetes",
    items: [
      "Gula darah di bawah 70 mg/dL, atau gemetar, keringat dingin, berdebar, lapar hebat",
      "Gula darah di atas 300 mg/dL disertai sangat haus, sering kencing, atau mual-muntah",
      "Napas cepat/berbau buah, nyeri perut, atau sangat lemas",
      "Luka di kaki yang bengkak, bernanah, menghitam, atau berbau",
    ],
  },
  {
    key: "umum",
    label: "Umum",
    condition: null,
    items: [
      "Kejang",
      "Bengkak di kaki/wajah dan berat badan naik cepat",
    ],
  },
];
const ALL_WARNING_ITEMS = WARNING_GROUPS.flatMap((g) => g.items);

const ESCALATION_OPTIONS = [
  "Segera ke IGD RSUD Kab. Rejang Lebong",
  "Segera ke IGD rumah sakit atau puskesmas terdekat",
  "Tekan Tombol Darurat (SOS) di aplikasi ini",
  "Minta keluarga mengantar — jangan menyetir sendiri",
  "Jangan menambah dosis obat sendiri",
];
const DEFAULT_ESCALATION = [ESCALATION_OPTIONS[0], ESCALATION_OPTIONS[2]];

function splitLines(text) {
  return (text || "").split(/\r?\n+/).map((t) => t.replace(/^\s*(\d+[.)]|[-•])\s*/, "").trim()).filter(Boolean);
}
function defaultWarnings(conditions) {
  const cond = (conditions || []).join(" ").toLowerCase();
  const picked = WARNING_GROUPS.filter((g) => g.condition && cond.includes(g.condition.toLowerCase())).flatMap((g) => g.items);
  return picked.length > 0 ? picked : WARNING_GROUPS[0].items;
}

/**
 * PersonalSafetyPlanModal.jsx — form Personal Safety Plan dari Daftar Pasien.
 * REVISI (Okt 2026):
 *  - Form terisi otomatis dari Safety Plan & obat yang sedang aktif
 *    (tidak mulai dari kosong lagi setiap dibuka).
 *  - Bagian "Obat & Jadwal Minum" = SATU-SATUNYA sumber obat untuk pengingat,
 *    "Jadwal Hari Ini" & "Obat Saya" di Portal Pasien. Hanya Dokter yang bisa
 *    mengubahnya; peran lain melihat saja.
 */
export default function PersonalSafetyPlanModal({ patient, onClose }) {
  const [form, setForm] = useState({
    diagnosis: (patient.conditions || []).join(", "),
    monitoringParameters: [],
    monitoringFrequency: "Setiap hari",
    medicationPlan: "",
    followUpDate: "",
    warningSigns: "",
    escalationInstruction: "Segera hubungi IGD RSUD Kab. Rejang Lebong jika tanda bahaya muncul.",
  });
  const [meds, setMeds] = useState([emptyMed()]);
  const [warnings, setWarnings] = useState(() => defaultWarnings(patient.conditions));
  const [warningOther, setWarningOther] = useState("");
  const [escalations, setEscalations] = useState(DEFAULT_ESCALATION);
  const toggleIn = (setter) => (item) => setter((prev) => (prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]));
  const toggleWarning = toggleIn(setWarnings);
  const toggleEscalation = toggleIn(setEscalations);
  const [canEditMeds, setCanEditMeds] = useState(false);
  const [hasPlan, setHasPlan] = useState(false);
  const [loadingForm, setLoadingForm] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await callApi("safetyPlan", { action: "getPersonalPlanForm", patientId: patient.id });
        const { plan, medications, canEditMedications } = res.data;
        setCanEditMeds(!!canEditMedications);
        if (plan) {
          setHasPlan(true);
          setForm((f) => ({
            ...f,
            diagnosis: plan.diagnosis || f.diagnosis,
            monitoringParameters: plan.monitoringParameters || [],
            monitoringFrequency: plan.monitoringFrequency || f.monitoringFrequency,
            medicationPlan: plan.medicationPlan || "",
            followUpDate: plan.followUpDate || "",
            warningSigns: plan.warningSigns || "",
            escalationInstruction: plan.escalationInstruction || f.escalationInstruction,
          }));
          // Isi ulang centang dari teks yang tersimpan; baris yang bukan
          // pilihan baku masuk ke kolom "lainnya" supaya tidak hilang.
          const savedWarnings = splitLines(plan.warningSigns);
          if (savedWarnings.length > 0) {
            setWarnings(savedWarnings.filter((w) => ALL_WARNING_ITEMS.includes(w)));
            setWarningOther(savedWarnings.filter((w) => !ALL_WARNING_ITEMS.includes(w)).join("; "));
          }
          const savedEsc = splitLines(plan.escalationInstruction).filter((e) => ESCALATION_OPTIONS.includes(e));
          if (savedEsc.length > 0) setEscalations(savedEsc);
        }
        if (medications && medications.length > 0) {
          setMeds(medications.map((m) => ({ name: m.name, dose: m.dose, frequency: m.frequency, slots: m.slots || [], slotTimes: m.slotTimes || {} })));
        }
      } catch (err) {
        setError("Gagal memuat Safety Plan yang ada: " + (err.message || "") + " — form dimulai kosong.");
      } finally {
        setLoadingForm(false);
      }
    })();
  }, [patient.id]);

  const toggleParam = (p) => {
    setForm((f) => ({
      ...f,
      monitoringParameters: f.monitoringParameters.includes(p)
        ? f.monitoringParameters.filter((x) => x !== p)
        : [...f.monitoringParameters, p],
    }));
  };

  const updateMed = (i, field, value) => setMeds((prev) => prev.map((m, idx) => (idx === i ? { ...m, [field]: value } : m)));
  const toggleSlot = (i, slot) =>
    setMeds((prev) =>
      prev.map((m, idx) => {
        if (idx !== i) return m;
        const next = m.slots.includes(slot) ? m.slots.filter((s) => s !== slot) : [...m.slots, slot];
        return { ...m, slots: next };
      })
    );
  const setSlotTime = (i, slot, hour) =>
    setMeds((prev) => prev.map((m, idx) => (idx === i ? { ...m, slotTimes: { ...(m.slotTimes || {}), [slot]: Number(hour) } } : m)));

  const handleSave = async () => {
    if (form.monitoringParameters.length === 0) {
      setError("Pilih minimal 1 parameter yang dipantau.");
      return;
    }
    const warningList = [...ALL_WARNING_ITEMS.filter((w) => warnings.includes(w)), ...(warningOther.trim() ? [warningOther.trim()] : [])];
    const escalationList = ESCALATION_OPTIONS.filter((e) => escalations.includes(e));
    if (warningList.length === 0) {
      setError("Centang minimal 1 tanda bahaya.");
      return;
    }
    if (escalationList.length === 0) {
      setError("Centang minimal 1 instruksi bila tanda bahaya muncul.");
      return;
    }
    const filledMeds = meds.filter((m) => m.name.trim());
    if (canEditMeds) {
      const noSchedule = filledMeds.filter((m) => m.slots.length === 0);
      if (noSchedule.length > 0 && !window.confirm(`${noSchedule.map((m) => m.name).join(", ")} tidak diberi jadwal minum, jadi TIDAK akan diingatkan ke pasien (obat "jika perlu"). Lanjutkan?`)) {
        return;
      }
      if (filledMeds.length === 0 && !window.confirm("Daftar obat kosong. Semua obat aktif pasien akan DIHENTIKAN dan pengingat obat berhenti. Lanjutkan?")) {
        return;
      }
    }
    setSaving(true);
    setError("");
    try {
      const res = await callApi("safetyPlan", {
        action: "createPersonalPlan",
        patientId: patient.id,
        ...form,
        warningSigns: warningList.join("\n"),
        escalationInstruction: escalationList.join("\n"),
        ...(canEditMeds ? { updateMedications: true, medications: filledMeds } : {}),
      });
      setDone({ medicationCount: res.data.medicationCount });
    } catch (err) {
      setError(err.message || "Gagal menyimpan safety plan.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(23,38,43,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div className="card" style={{ width: 560, maxWidth: "94vw", maxHeight: "88vh", overflowY: "auto" }}>
        <h3 style={{ marginBottom: 10 }}>Personal Safety Plan — {patient.name}</h3>

        {done ? (
          <>
            <p>Safety plan tersimpan & aktif. Pasien sudah bisa melihatnya di Portal.</p>
            {done.medicationCount != null && (
              <p className="stat-sub">💊 {done.medicationCount} obat aktif — pengingat minum obat mengikuti daftar ini mulai sekarang.</p>
            )}
            <button className="btn btn-primary" style={{ width: "100%" }} onClick={onClose}>Tutup</button>
          </>
        ) : loadingForm ? (
          <p className="stat-sub">Memuat Safety Plan yang ada...</p>
        ) : (
          <>
            {hasPlan && <div className="stat-sub" style={{ marginBottom: 8 }}>Terisi dari Safety Plan yang sedang aktif. Menyimpan akan memperbaruinya.</div>}
            <div className="field">
              <label>Diagnosis</label>
              <input value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} />
            </div>
            <div className="field">
              <label>Parameter yang Dipantau di Rumah</label>
              <div style={{ display: "flex", gap: 10 }}>
                {PARAM_OPTIONS.map((p) => (
                  <label key={p} style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", cursor: "pointer" }}>
                    <input type="checkbox" style={CB} checked={form.monitoringParameters.includes(p)} onChange={() => toggleParam(p)} />
                    {PARAM_LABEL[p]}
                  </label>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Frekuensi Monitoring</label>
              <select value={form.monitoringFrequency} onChange={(e) => setForm({ ...form, monitoringFrequency: e.target.value })}>
                <option>Setiap hari</option>
                <option>2 hari sekali</option>
                <option>Seminggu sekali</option>
              </select>
            </div>

            {/* ==== BARU (Okt 2026): Obat & Jadwal Minum — khusus Dokter ==== */}
            <div className="field">
              <label>💊 Obat &amp; Jadwal Minum {canEditMeds ? "" : "(hanya Dokter yang bisa mengubah)"}</label>
              <div className="stat-sub" style={{ marginBottom: 6 }}>
                Daftar ini dipakai untuk pengingat minum obat di HP pasien. Kosongkan semua jadwal untuk obat "jika perlu" (tidak diingatkan).
              </div>
              {meds.map((m, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <div className="grid cols-3" style={{ flex: 1 }}>
                      <input placeholder="Nama obat" value={m.name} disabled={!canEditMeds} onChange={(e) => updateMed(i, "name", e.target.value)} />
                      <input placeholder="Dosis (mis. 5 mg)" value={m.dose} disabled={!canEditMeds} onChange={(e) => updateMed(i, "dose", e.target.value)} />
                      <input placeholder="Aturan (mis. 1x1)" value={m.frequency} disabled={!canEditMeds} onChange={(e) => updateMed(i, "frequency", e.target.value)} />
                    </div>
                    {canEditMeds && (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ padding: "6px 8px", fontSize: 12, color: "#c0392b" }}
                        onClick={() => setMeds((prev) => (prev.length <= 1 ? [emptyMed()] : prev.filter((_, idx) => idx !== i)))}
                        title="Hapus obat ini"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", paddingLeft: 4 }}>
                    {MED_SLOT_OPTIONS.map((o) => {
                      const checked = m.slots.includes(o.key);
                      const hour = (m.slotTimes && m.slotTimes[o.key]) ?? o.defaultHour;
                      return (
                        <div key={o.key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: canEditMeds ? "pointer" : "default", whiteSpace: "nowrap" }}>
                            <input type="checkbox" style={CB} checked={checked} disabled={!canEditMeds} onChange={() => toggleSlot(i, o.key)} />
                            {o.label}
                          </label>
                          <select
                            aria-label={`Jam minum ${o.label}`}
                            value={hour}
                            disabled={!canEditMeds || !checked}
                            onChange={(e) => setSlotTime(i, o.key, e.target.value)}
                            style={{ fontSize: 13, padding: "4px 6px", width: "auto", opacity: checked ? 1 : 0.45 }}
                          >
                            {hourOptions(o.min, o.max).map((h) => (
                              <option key={h} value={h}>{String(h).padStart(2, "0")}.00</option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {canEditMeds && (
                <button type="button" className="btn btn-ghost" onClick={() => setMeds((prev) => [...prev, emptyMed()])}>
                  + Tambah Obat
                </button>
              )}
            </div>

            <div className="field">
              <label>Catatan Obat Tambahan (opsional)</label>
              <textarea rows={2} value={form.medicationPlan} disabled={!canEditMeds} onChange={(e) => setForm({ ...form, medicationPlan: e.target.value })} placeholder="mis. diminum setelah makan, hindari jus jeruk" />
            </div>
            <div className="field">
              <label>Tanggal Follow-Up</label>
              <input type="date" value={form.followUpDate} onChange={(e) => setForm({ ...form, followUpDate: e.target.value })} />
            </div>
            <div className="field">
              <label>⚠️ Tanda Bahaya (untuk pasien) — centang satu atau lebih</label>
              {WARNING_GROUPS.map((g) => (
                <div key={g.key} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="stat-sub" style={{ fontWeight: 700 }}>{g.label}</span>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ padding: "2px 8px", fontSize: 11 }}
                      onClick={() => {
                        const allOn = g.items.every((it) => warnings.includes(it));
                        setWarnings((prev) => (allOn ? prev.filter((x) => !g.items.includes(x)) : [...new Set([...prev, ...g.items])]));
                      }}
                    >
                      {g.items.every((it) => warnings.includes(it)) ? "Kosongkan" : "Pilih semua"}
                    </button>
                  </div>
                  {g.items.map((it) => (
                    <label key={it} style={CB_LABEL}>
                      <input type="checkbox" checked={warnings.includes(it)} onChange={() => toggleWarning(it)} style={{ ...CB, marginTop: 1 }} />
                      {it}
                    </label>
                  ))}
                </div>
              ))}
              <input
                placeholder="Tanda bahaya lain (opsional, boleh dikosongkan)"
                value={warningOther}
                onChange={(e) => setWarningOther(e.target.value)}
                style={{ marginTop: 4 }}
              />
            </div>
            <div className="field">
              <label>🚑 Jika Tanda Bahaya Muncul — centang satu atau lebih</label>
              {ESCALATION_OPTIONS.map((it) => (
                <label key={it} style={CB_LABEL}>
                  <input type="checkbox" checked={escalations.includes(it)} onChange={() => toggleEscalation(it)} style={{ ...CB, marginTop: 1 }} />
                  {it}
                </label>
              ))}
            </div>
            {error && <div className="error-text">{error}</div>}
            <button className="btn btn-primary" style={{ width: "100%", marginTop: 8 }} disabled={saving} onClick={handleSave}>
              {saving ? "Menyimpan..." : hasPlan ? "Simpan Perubahan Safety Plan" : "Simpan & Aktifkan Safety Plan"}
            </button>
            <button className="btn btn-ghost" style={{ width: "100%", marginTop: 6 }} onClick={onClose}>Batal</button>
          </>
        )}
      </div>
    </div>
  );
}
