/**
 * DoctorMascot.jsx — BARU (20 Okt 2026). Karakter dokter di kartu status
 * Portal Pasien. Raut wajah & gerakan mengikuti status keselamatan terkini:
 *  - SAFE          : tersenyum lebar, pipi merona, melambaikan tangan, badan memantul ringan
 *  - ATTENTION     : berpikir — alis terangkat sebelah, tangan di dagu, kepala miring pelan
 *  - ACTION_NEEDED : khawatir — alis turun ke dalam, mulut cemberut, memegang papan catatan
 *  - URGENT        : serius/waspada — mata melebar, telapak tangan terangkat, keringat
 * SVG + CSS saja (ringan, tanpa internet). Animasi berhenti bila HP memakai
 * "Kurangi Gerakan". Teks pesan ditampilkan di luar SVG (lihat MASCOT_MESSAGE).
 */

export const MASCOT_MESSAGE = {
  SAFE: "Kondisi Anda baik. Pertahankan, ya! Tetap minum obat & cek tensi/gula teratur.",
  ATTENTION: "Ada yang perlu diperhatikan. Cek ulang tensi/gula darah dan minum obat sesuai jadwal.",
  ACTION_NEEDED: "Kondisi Anda perlu ditindaklanjuti. Ikuti Safety Plan Anda; petugas RS akan memantau.",
  URGENT: "Kondisi Anda perlu perhatian segera. Bila ada tanda bahaya, segera minta diantar ke UGD.",
};

const SHIRT = { SAFE: "#34d399", ATTENTION: "#f5a623", ACTION_NEEDED: "#f2994a", URGENT: "#ff5c50" };

function Face({ mood }) {
  const ink = "#1f2937";
  if (mood === "ATTENTION") {
    return (
      <g>
        <path d="M65 70 Q70 65.5 75.5 69" fill="none" stroke={ink} strokeWidth="2.4" strokeLinecap="round" />
        <path d="M84.5 71 L94.5 71" fill="none" stroke={ink} strokeWidth="2.4" strokeLinecap="round" />
        <g className="dm-blink"><circle cx="71" cy="79" r="2.6" fill={ink} /><circle cx="89" cy="79.5" r="2.6" fill={ink} /></g>
        <path d="M74 92 Q81 90.5 87 91.5" fill="none" stroke="#9a3412" strokeWidth="2.2" strokeLinecap="round" />
      </g>
    );
  }
  if (mood === "ACTION_NEEDED") {
    return (
      <g>
        <path d="M65.5 72 L76 68.5" fill="none" stroke={ink} strokeWidth="2.4" strokeLinecap="round" />
        <path d="M84 68.5 L94.5 72" fill="none" stroke={ink} strokeWidth="2.4" strokeLinecap="round" />
        <g className="dm-blink"><circle cx="71" cy="79.5" r="2.6" fill={ink} /><circle cx="89" cy="79.5" r="2.6" fill={ink} /></g>
        <path d="M72.5 93.5 Q80 88 87.5 93.5" fill="none" stroke="#9a3412" strokeWidth="2.4" strokeLinecap="round" />
      </g>
    );
  }
  if (mood === "URGENT") {
    return (
      <g>
        <path d="M65 67.5 Q70.5 63.5 76 66.5" fill="none" stroke={ink} strokeWidth="2.4" strokeLinecap="round" />
        <path d="M84 66.5 Q89.5 63.5 95 67.5" fill="none" stroke={ink} strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="71" cy="79" r="4.4" fill="#fff" /><circle cx="89" cy="79" r="4.4" fill="#fff" />
        <circle cx="71" cy="79.5" r="2.7" fill={ink} /><circle cx="89" cy="79.5" r="2.7" fill={ink} />
        <ellipse cx="80" cy="93" rx="3.6" ry="4.6" fill="#7c2d12" />
        <path className="dm-sweat" d="M104 62 C101 67 101 70 104 70.5 C107 70 107 67 104 62 Z" fill="#7dd3fc" />
      </g>
    );
  }
  // SAFE
  return (
    <g>
      <path d="M65.5 70.5 Q70.5 67 75.5 70" fill="none" stroke={ink} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M84.5 70 Q89.5 67 94.5 70.5" fill="none" stroke={ink} strokeWidth="2.4" strokeLinecap="round" />
      <g className="dm-blink"><circle cx="71" cy="79" r="2.7" fill={ink} /><circle cx="89" cy="79" r="2.7" fill={ink} /></g>
      <circle cx="65" cy="87" r="3.6" fill="#fb7185" opacity="0.45" />
      <circle cx="95" cy="87" r="3.6" fill="#fb7185" opacity="0.45" />
      <path d="M70 88.5 Q80 100 90 88.5 Q80 93 70 88.5 Z" fill="#9a3412" />
      <path d="M73.5 90.2 Q80 92.6 86.5 90.2" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
    </g>
  );
}

function RightArm({ mood }) {
  const sleeve = "#f8fafc";
  const skin = "#f1c19a";
  if (mood === "ATTENTION") {
    // tangan di dagu
    return (
      <g>
        <path d="M110 124 Q104 112 94 104 L89 110 Q98 118 102 128 Z" fill={sleeve} stroke="#cbd5e1" strokeWidth="1" />
        <circle cx="90" cy="102" r="6.5" fill={skin} />
      </g>
    );
  }
  if (mood === "ACTION_NEEDED") {
    // memegang papan catatan di depan dada
    return (
      <g className="dm-clip">
        <path d="M110 124 Q112 134 104 140 L98 134 Q103 130 102 124 Z" fill={sleeve} stroke="#cbd5e1" strokeWidth="1" />
        <rect x="84" y="118" width="24" height="30" rx="3" fill="#a16207" />
        <rect x="87" y="122" width="18" height="23" rx="1.5" fill="#f8fafc" />
        <rect x="91" y="116" width="10" height="5" rx="1.5" fill="#64748b" />
        <path d="M90 128h12M90 133h9M90 138h11" stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="103" cy="140" r="5.5" fill={skin} />
      </g>
    );
  }
  if (mood === "URGENT") {
    // telapak tangan terangkat (isyarat "perhatian!")
    return (
      <g className="dm-alert">
        <path d="M108 122 L124 92 L132 97 L116 127 Z" fill={sleeve} stroke="#cbd5e1" strokeWidth="1" />
        <rect x="120" y="72" width="16" height="22" rx="7" fill={skin} />
        <path d="M124 74v-4M128 73v-5M132 74v-4" stroke={skin} strokeWidth="3.4" strokeLinecap="round" />
      </g>
    );
  }
  // SAFE — melambai
  return (
    <g className="dm-wave">
      <path d="M108 122 L126 94 L134 99 L116 127 Z" fill={sleeve} stroke="#cbd5e1" strokeWidth="1" />
      <circle cx="131" cy="91" r="7.5" fill={skin} />
      <path d="M127 84.5v-4M131 84v-5M135 85v-4" stroke={skin} strokeWidth="3.2" strokeLinecap="round" />
    </g>
  );
}

export default function DoctorMascot({ status = "SAFE" }) {
  const mood = SHIRT[status] ? status : "SAFE";
  const shirt = SHIRT[mood];
  return (
    <svg className={`dm dm-${mood.toLowerCase()}`} width="150" height="150" viewBox="0 0 160 160" role="img" aria-label="Karakter dokter">
      {/* bayangan lantai */}
      <ellipse cx="80" cy="157" rx="40" ry="3" fill="rgba(0,0,0,0.25)" />
      <g className="dm-body">
        {/* tangan kiri (diam) */}
        <path d="M52 122 L44 150 L53 152 L60 126 Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
        <circle cx="48" cy="152" r="6" fill="#f1c19a" />
        {/* jas */}
        <path d="M40 160 C40 126 56 112 80 112 C104 112 120 126 120 160 Z" fill="#f8fafc" />
        <path d="M70 113 L80 133 L90 113 Z" fill={shirt} />
        <path d="M70 113 L76 140 M90 113 L84 140" stroke="#cbd5e1" strokeWidth="1.4" fill="none" />
        <rect x="93" y="128" width="13" height="8" rx="2" fill={shirt} />
        {/* stetoskop */}
        <path d="M68 114 C62 130 64 142 73 143 C79 143 81 137 80 133" fill="none" stroke="#334155" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="80" cy="131" r="3.6" fill="#94a3b8" stroke="#334155" strokeWidth="1.6" />
        {/* leher & kepala */}
        <rect x="74" y="96" width="12" height="18" rx="5" fill="#e0a77a" />
        <g className="dm-head">
          <circle cx="56.5" cy="80" r="4.5" fill="#e8b48c" />
          <circle cx="103.5" cy="80" r="4.5" fill="#e8b48c" />
          <circle cx="80" cy="78" r="24" fill="#f1c19a" />
          <path d="M56 75 C55 55 67 50 80 50 C95 50 105 57 104 75 C99 65 91 61.5 80 61.5 C69 61.5 61 65 56 75 Z" fill="#1f2937" />
          <Face mood={mood} />
        </g>
        <RightArm mood={mood} />
      </g>
    </svg>
  );
}
