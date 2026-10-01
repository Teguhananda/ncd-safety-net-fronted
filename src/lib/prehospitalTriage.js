/**
 * prehospitalTriage.js — mesin kategori ASESMEN PRA-RUMAH SAKIT (BARU, Sept 2026).
 *
 * FILE INI ADA 2 SALINAN YANG ISINYA HARUS SAMA:
 *   - frontend: src/lib/prehospitalTriage.js  (hitung langsung saat form diisi)
 *   - backend : lib/prehospitalTriage.js      (server menghitung ULANG, supaya
 *               kategori tidak bisa dimanipulasi dari browser)
 *
 * Dasar acuan (internasional & nasional):
 *   - Survei primer ABCDE (ATLS / PHTLS / ERC)
 *   - NEWS2 — National Early Warning Score 2 (Royal College of Physicians, 2017), skala SpO2 1
 *   - Krisis hipertensi: TD ≥180/120 + kerusakan organ target = emergensi (ESH 2023, ACC/AHA 2017)
 *   - Stroke: BE-FAST + waktu onset, jendela trombolisis 4,5 jam (AHA/ASA)
 *   - Hipoglikemia level 1/2/3 & krisis hiperglikemia KAD/HHS (ADA Standards of Care)
 *   - Kriteria gawat darurat Permenkes 47/2018 (mengancam nyawa, gangguan ABC,
 *     penurunan kesadaran, gangguan hemodinamik)
 *
 * Prinsip keselamatan:
 *   - Data TTV belum lengkap → TIDAK PERNAH dinilai HIJAU (minimal KUNING).
 *   - Kategori hanya SARAN; tim ambulans yang menetapkan. Menurunkan kategori
 *     wajib alasan, dan HIJAU (tidak dibawa) wajib persetujuan dokter jaga UGD.
 *
 * [REQUIRES CLINICAL VALIDATION] Ambang di bawah perlu disahkan Komite Medik / UGD.
 */

export const CATEGORY = {
  MERAH: { rank: 3, label: "MERAH", desc: "Mengancam nyawa — bawa SEGERA ke UGD", color: "#ff5c50" },
  KUNING: { rank: 2, label: "KUNING", desc: "Gawat, tidak mengancam segera — bawa ke UGD", color: "#f5a623" },
  HIJAU: { rank: 1, label: "HIJAU", desc: "Tidak gawat darurat — usul tidak dibawa (perlu persetujuan UGD)", color: "#2ecc71" },
};

function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ---- NEWS2 (skala SpO2 1) ----
export function computeNews2(d) {
  const b = (d && d.breathing) || {};
  const c = (d && d.circulation) || {};
  const dis = (d && d.disability) || {};
  const e = (d && d.exposure) || {};
  const rr = num(b.rr), spo2 = num(b.spo2), sbp = num(c.sbp), hr = num(c.hr), temp = num(e.temp);
  const avpu = dis.avpu || null;

  const parts = {};
  if (rr !== null) parts.rr = rr <= 8 ? 3 : rr <= 11 ? 1 : rr <= 20 ? 0 : rr <= 24 ? 2 : 3;
  if (spo2 !== null) parts.spo2 = spo2 <= 91 ? 3 : spo2 <= 93 ? 2 : spo2 <= 95 ? 1 : 0;
  parts.oxygen = b.onOxygen ? 2 : 0;
  if (sbp !== null) parts.sbp = sbp <= 90 ? 3 : sbp <= 100 ? 2 : sbp <= 110 ? 1 : sbp <= 219 ? 0 : 3;
  if (hr !== null) parts.hr = hr <= 40 ? 3 : hr <= 50 ? 1 : hr <= 90 ? 0 : hr <= 110 ? 1 : hr <= 130 ? 2 : 3;
  if (avpu) parts.consciousness = avpu === "A" ? 0 : 3;
  if (temp !== null) parts.temp = temp <= 35 ? 3 : temp <= 36 ? 1 : temp <= 38 ? 0 : temp <= 39 ? 1 : 2;

  const required = ["rr", "spo2", "sbp", "hr", "consciousness", "temp"];
  const missing = required.filter((k) => parts[k] === undefined);
  const total = Object.values(parts).reduce((a, x) => a + x, 0);
  const anyThree = Object.values(parts).some((x) => x === 3);
  let risk = "RENDAH";
  if (total >= 7) risk = "TINGGI";
  else if (total >= 5) risk = "SEDANG";
  else if (anyThree) risk = "RENDAH-SEDANG";
  return { total, parts, anyThree, missing, complete: missing.length === 0, risk };
}

export function computeGcs(dis) {
  const e = num(dis && dis.gcsE), v = num(dis && dis.gcsV), m = num(dis && dis.gcsM);
  if (e === null || v === null || m === null) return null;
  return e + v + m;
}

const NEWS2_LABEL = { rr: "Frekuensi napas", spo2: "SpO2", oxygen: "Pakai oksigen", sbp: "TD sistolik", hr: "Nadi", consciousness: "Kesadaran", temp: "Suhu" };
const MISSING_LABEL = { rr: "frekuensi napas", spo2: "SpO2", sbp: "TD sistolik", hr: "nadi", consciousness: "AVPU", temp: "suhu" };

export function hoursSince(isoOrLocal, now = new Date()) {
  if (!isoOrLocal) return null;
  const t = new Date(isoOrLocal);
  if (Number.isNaN(t.getTime())) return null;
  return (now.getTime() - t.getTime()) / 3600000;
}

/**
 * computeTriage(data) → { suggested, merah[], kuning[], news2, gcs, flags }
 */
export function computeTriage(d, now = new Date()) {
  const data = d || {};
  const b = data.breathing || {};
  const c = data.circulation || {};
  const dis = data.disability || {};
  const ht = data.ht || {};
  const st = data.stroke || {};
  const dm = data.dm || {};
  const cp = data.chestPain || {};

  const news2 = computeNews2(data);
  const gcs = computeGcs(dis);
  const merah = [];
  const kuning = [];

  // A — Airway
  if (data.airway === "parsial") merah.push("Jalan napas tersumbat sebagian");
  if (data.airway === "tersumbat") merah.push("Jalan napas tersumbat total");
  // B — Breathing
  if (b.distress === "berat") merah.push("Distres napas berat");
  if (b.distress === "apnea") merah.push("Henti napas / apnea");
  if (b.distress === "ringan") kuning.push("Sesak napas ringan–sedang");
  const spo2 = num(b.spo2);
  if (spo2 !== null && spo2 < 90) merah.push(`SpO2 sangat rendah (${spo2}%)`);
  // C — Circulation
  if (c.pulseQuality === "tidak_teraba") merah.push("Nadi tidak teraba");
  if (c.pulseQuality === "lemah" && (c.crt === ">2" || c.skin === "pucat_dingin")) merah.push("Tanda syok (nadi lemah + perfusi buruk)");
  if (c.skin === "sianosis") merah.push("Sianosis");
  if (c.bleeding) merah.push("Perdarahan aktif yang sulit dihentikan");
  // D — Disability
  if (dis.avpu && dis.avpu !== "A") merah.push(`Penurunan kesadaran (AVPU: ${dis.avpu === "C" ? "bingung baru" : dis.avpu})`);
  if (gcs !== null && gcs <= 13) merah.push(`GCS ${gcs} (≤13)`);
  if (dis.pupils === "anisokor" || dis.pupils === "tidak_reaktif") merah.push("Pupil anisokor / tidak reaktif");
  if (data.seizure) merah.push("Kejang");

  // NEWS2
  if (news2.total >= 7) merah.push(`NEWS2 ${news2.total} (risiko tinggi)`);
  else if (news2.total >= 5) kuning.push(`NEWS2 ${news2.total} (risiko sedang)`);
  if (news2.anyThree && news2.total < 7) {
    const which = Object.entries(news2.parts).filter(([, v]) => v === 3).map(([k]) => NEWS2_LABEL[k]);
    kuning.push(`Satu parameter NEWS2 bernilai 3 (${which.join(", ")})`);
  }

  // Modul Hipertensi
  const sbp = num(c.sbp), dbp = num(c.dbp);
  const crisis = (sbp !== null && sbp >= 180) || (dbp !== null && dbp >= 120);
  const od = ht.organDamage || {};
  const odList = [
    od.chestPain && "nyeri dada",
    od.dyspnea && "sesak/edema paru",
    od.neuroDeficit && "defisit neurologis",
    od.severeHeadacheVision && "sakit kepala hebat + gangguan penglihatan",
    od.confusion && "bingung/gelisah",
    od.oliguria && "kencing sangat sedikit",
  ].filter(Boolean);
  if (crisis && odList.length > 0) merah.push(`Hipertensi EMERGENSI: TD ${sbp ?? "?"}/${dbp ?? "?"} + ${odList.join(", ")}`);
  else if (crisis) kuning.push(`Hipertensi URGENSI: TD ${sbp ?? "?"}/${dbp ?? "?"} tanpa tanda kerusakan organ`);

  // Modul Stroke — BE-FAST
  const befast = [st.balance && "Balance", st.eyes && "Eyes", st.face && "Face", st.arm && "Arm", st.speech && "Speech"].filter(Boolean);
  let strokeHours = null;
  if (befast.length > 0) {
    strokeHours = hoursSince(st.lastKnownWell, now);
    const strokeWindow = strokeHours !== null && strokeHours >= 0 && strokeHours <= 4.5
      ? ` — onset ${strokeHours.toFixed(1)} jam, MASIH dalam jendela 4,5 jam`
      : strokeHours !== null ? ` — onset ${strokeHours.toFixed(1)} jam` : " — waktu onset tidak diketahui";
    merah.push(`Curiga STROKE (BE-FAST positif: ${befast.join(", ")})${strokeWindow}`);
  }

  // Modul DM
  const gds = dm.gdsHi ? 600 : num(dm.gds);
  if (gds !== null) {
    const alteredLOC = (dis.avpu && dis.avpu !== "A") || (gcs !== null && gcs < 15);
    if (gds < 70 && alteredLOC) merah.push(`Hipoglikemia BERAT (GDS ${gds} + penurunan kesadaran — ADA level 3)`);
    else if (gds < 54) kuning.push(`Hipoglikemia level 2 (GDS ${gds} mg/dL)`);
    else if (gds < 70) kuning.push(`Hipoglikemia level 1 (GDS ${gds} mg/dL)`);

    const dkaSigns = [dm.kussmaul && "napas Kussmaul", dm.vomiting && "muntah terus", dm.dehydration && "dehidrasi berat", dm.abdominalPain && "nyeri perut"].filter(Boolean);
    if (gds >= 600 && (alteredLOC || dm.dehydration)) merah.push(`Curiga HHS (GDS ${dm.gdsHi ? "HI" : gds} + ${alteredLOC ? "penurunan kesadaran" : "dehidrasi berat"})`);
    else if (gds >= 250 && dkaSigns.length > 0) merah.push(`Curiga KAD (GDS ${dm.gdsHi ? "HI" : gds} + ${dkaSigns.join(", ")})`);
    else if (gds >= 250) kuning.push(`Hiperglikemia (GDS ${dm.gdsHi ? "HI (≥600)" : gds}) tanpa tanda KAD/HHS`);
  }

  // Nyeri dada / EKG
  if (cp.ecg === "stemi") merah.push("EKG: STEMI");
  if (cp.ecg === "aritmia_berbahaya") merah.push("EKG: aritmia berbahaya (VT/VF/blok total/bradikardia berat)");
  if (cp.present && cp.typical) merah.push("Nyeri dada khas SKA (tertekan/berat >20 menit, menjalar, keringat dingin)");
  else if (cp.present) kuning.push("Nyeri dada atipikal");
  if (cp.ecg === "iskemia") kuning.push("EKG: gambaran iskemia (non-ST elevasi)");
  if (cp.ecg === "aritmia_lain") kuning.push("EKG: aritmia lain (stabil)");

  if (data.response === "memburuk") merah.push("Kondisi MEMBURUK setelah tindakan di lokasi");

  // Keamanan data: TTV belum lengkap tidak boleh dianggap HIJAU
  const missingLabels = news2.missing.map((k) => MISSING_LABEL[k]);
  if (!data.airway) missingLabels.unshift("jalan napas");
  if (missingLabels.length > 0) {
    kuning.push(`Data belum lengkap (${missingLabels.join(", ")}) — tidak bisa dinilai hijau`);
  }

  const suggested = merah.length > 0 ? "MERAH" : kuning.length > 0 ? "KUNING" : "HIJAU";
  return {
    suggested,
    merah,
    kuning,
    news2,
    gcs,
    flags: { hypertensiveCrisis: crisis, befast, strokeHours, gds },
  };
}

// ---- Serah terima format SBAR ----
export function buildSbar(d, triage, patient, finalCategory) {
  const data = d || {};
  const b = data.breathing || {};
  const c = data.circulation || {};
  const dis = data.disability || {};
  const e = data.exposure || {};
  const dm = data.dm || {};
  const p = patient || {};
  const cat = finalCategory || triage.suggested;
  const reasons = [...triage.merah, ...triage.kuning];
  const lines = [];
  lines.push(`S (Situation): Pasien ${p.name || "-"}${p.age ? `, ${p.age} th` : ""}${p.mrn ? `, No.RM ${p.mrn}` : ""}. Keluhan utama: ${data.chiefComplaint || "-"}. Kategori pra-RS: ${cat}.`);
  lines.push(`B (Background): ${p.conditions || "Pasien program NCD Safety Net (HT/DM)"}. Tombol SOS ditekan pasien; onset keluhan: ${data.onsetTime ? new Date(data.onsetTime).toLocaleString("id-ID") : "tidak diketahui"}.`);
  const vit = [
    `TD ${c.sbp ?? "?"}/${c.dbp ?? "?"} mmHg`,
    `Nadi ${c.hr ?? "?"}x/mnt`,
    `RR ${b.rr ?? "?"}x/mnt`,
    `SpO2 ${b.spo2 ?? "?"}%${b.onOxygen ? " (dengan O2)" : ""}`,
    `Suhu ${e.temp ?? "?"}°C`,
    `AVPU ${dis.avpu || "?"}${triage.gcs !== null ? `, GCS ${triage.gcs}` : ""}`,
    (dm.gds || dm.gdsHi) ? `GDS ${dm.gdsHi ? "HI" : dm.gds} mg/dL` : null,
  ].filter(Boolean).join(", ");
  lines.push(`A (Assessment): Airway ${data.airway || "?"}. ${vit}. NEWS2 ${triage.news2.total}${triage.news2.complete ? "" : " (data belum lengkap)"}. Temuan: ${reasons.length ? reasons.join("; ") : "tidak ada tanda bahaya"}.`);
  lines.push(`R (Recommendation): Tindakan di lokasi: ${data.interventions || "-"}; respons: ${data.response || "-"}. ${cat === "HIJAU" ? "Tim ambulans mengusulkan pasien TIDAK dibawa — mohon keputusan dokter jaga UGD." : "Pasien dibawa ke UGD — mohon persiapan penerimaan."}`);
  return lines.join("\n");
}
