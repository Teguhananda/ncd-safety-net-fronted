/**
 * MenuArt.jsx — BARU (20 Okt 2026). Ilustrasi menu Portal Pasien yang
 * berwarna & beranimasi ringan (SVG + CSS, tanpa gambar impor, tanpa
 * internet). Animasi otomatis berhenti bila HP pasien memakai pengaturan
 * "Kurangi Gerakan" (prefers-reduced-motion) — lihat portal-styles.css.
 *
 *  - ArtCekKondisi : jantung berdetak + garis EKG berjalan + manset tensi
 *  - ArtSafetyPlan : papan catatan, centang muncul bergantian + perisai
 *  - ArtRiwayat    : grafik batang tumbuh + garis tren
 *  - ArtTanyo      : dokter berjas putih + stetoskop + gelembung chat mengetik
 *  - ArtBantuan    : ambulans dengan lampu berkedip (dipakai saat SOS aktif)
 */

export function ArtCekKondisi() {
  return (
    <svg className="mart" width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
      {/* manset tensi */}
      <rect x="6" y="38" width="22" height="14" rx="4" fill="#3b82f6" />
      <rect x="9" y="41" width="16" height="8" rx="2" fill="#93c5fd" />
      <path d="M28 45c6 0 6 8 12 8" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" />
      <circle cx="44" cy="53" r="5" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
      {/* jantung berdetak */}
      <g className="mart-beat">
        <path d="M44 34c-1.2 0-9.5-5.3-9.5-11.2 0-3 2.3-5.3 5.1-5.3 1.9 0 3.5 1 4.4 2.6.9-1.6 2.5-2.6 4.4-2.6 2.8 0 5.1 2.3 5.1 5.3C53.5 28.7 45.2 34 44 34Z" fill="#ef4444" />
        <path d="M38.5 21.5c.6-1.3 1.6-2 2.8-2" fill="none" stroke="#fecaca" strokeWidth="1.6" strokeLinecap="round" />
      </g>
      {/* garis EKG */}
      <path className="mart-ecg" d="M4 22h8l3-7 4 14 3-9 2 2h6" fill="none" stroke="#2dd4bf" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArtSafetyPlan() {
  return (
    <svg className="mart" width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
      <rect x="12" y="10" width="34" height="46" rx="5" fill="#f8fafc" />
      <rect x="22" y="6" width="14" height="8" rx="3" fill="#a16207" />
      <rect x="25" y="8" width="8" height="3" rx="1.5" fill="#fde68a" />
      {[20, 30, 40].map((y, i) => (
        <g key={y}>
          <rect x="17" y={y} width="6" height="6" rx="1.5" fill="none" stroke="#94a3b8" strokeWidth="1.5" />
          <path className={`mart-check mart-check-${i + 1}`} d={`M18 ${y + 3}l2 2 3.5-4.2`} fill="none" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="26" y={y + 1.5} width={i === 1 ? 12 : 15} height="3" rx="1.5" fill="#cbd5e1" />
        </g>
      ))}
      {/* perisai keselamatan */}
      <g className="mart-float">
        <path d="M50 30c3.2 1.5 5.4 1.8 7.5 1.8v6.8c0 5.4-3.2 8.6-7.5 9.9-4.3-1.3-7.5-4.5-7.5-9.9v-6.8c2.1 0 4.3-.3 7.5-1.8Z" fill="#14b8a6" />
        <path d="M50 35.5v6M47 38.5h6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function ArtRiwayat() {
  return (
    <svg className="mart" width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
      <rect x="6" y="10" width="52" height="44" rx="7" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
      <path d="M12 48h40" stroke="#475569" strokeWidth="1.5" />
      {[
        { x: 15, h: 14, c: "#60a5fa", d: 1 },
        { x: 24, h: 22, c: "#34d399", d: 2 },
        { x: 33, h: 17, c: "#fbbf24", d: 3 },
        { x: 42, h: 27, c: "#f472b6", d: 4 },
      ].map((b) => (
        <rect key={b.x} className={`mart-bar mart-bar-${b.d}`} x={b.x} y={48 - b.h} width="7" height={b.h} rx="2" fill={b.c} />
      ))}
      <path className="mart-trend" d="M16 32l9-8 9 5 11-11" fill="none" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle className="mart-blink" cx="45" cy="18" r="2.6" fill="#e2e8f0" />
    </svg>
  );
}

export function ArtTanyo() {
  return (
    <svg className="mart" width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
      {/* dokter */}
      <g className="mart-sway">
        <path d="M8 60c0-11 6-17 16-17s16 6 16 17Z" fill="#f8fafc" />
        <path d="M24 43l-4.5 6 4.5 11 4.5-11Z" fill="#38bdf8" />
        <path d="M20 44l4 7 4-7" fill="none" stroke="#cbd5e1" strokeWidth="1.2" />
        <rect x="20.5" y="35" width="7" height="9" rx="3" fill="#e0a77a" />
        <circle cx="24" cy="27" r="9.5" fill="#f1c19a" />
        <path d="M14.6 25.5c.4-6.5 4.8-9.5 9.4-9.5s9 3 9.4 9.5c-2.2-2.6-5.5-3.6-9.4-3.6s-7.2 1-9.4 3.6Z" fill="#1f2937" />
        <circle cx="20.5" cy="28" r="1.2" fill="#1f2937" />
        <circle cx="27.5" cy="28" r="1.2" fill="#1f2937" />
        <path d="M21.5 31.8c1.6 1.2 3.4 1.2 5 0" fill="none" stroke="#9a3412" strokeWidth="1.3" strokeLinecap="round" />
        {/* stetoskop */}
        <path d="M17 45c-1 6 1 9 5 9s4-3 4-5" fill="none" stroke="#334155" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="26" cy="48.5" r="2.2" fill="#94a3b8" stroke="#334155" strokeWidth="1.2" />
        <rect x="31" y="49" width="5" height="3" rx="1" fill="#ef4444" />
      </g>
      {/* gelembung chat mengetik */}
      <g className="mart-pop">
        <path d="M37 6h19a5 5 0 0 1 5 5v9a5 5 0 0 1-5 5h-9l-6 5v-5h-4a5 5 0 0 1-5-5v-9a5 5 0 0 1 5-5Z" fill="#14b8a6" />
        <circle className="mart-dot mart-dot-1" cx="40" cy="15.5" r="2.2" fill="#fff" />
        <circle className="mart-dot mart-dot-2" cx="46.5" cy="15.5" r="2.2" fill="#fff" />
        <circle className="mart-dot mart-dot-3" cx="53" cy="15.5" r="2.2" fill="#fff" />
      </g>
    </svg>
  );
}

export function ArtBantuan() {
  return (
    <svg className="mart" width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
      <g className="mart-drive">
        <path d="M6 44V26a4 4 0 0 1 4-4h26v22Z" fill="#f8fafc" />
        <path d="M36 28h10l8 9v7H36Z" fill="#e2e8f0" />
        <path d="M39 31h6l5 6H39Z" fill="#7dd3fc" />
        <rect x="6" y="36" width="48" height="4" fill="#ef4444" />
        <path d="M21 26.5v8M17 30.5h8" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
        <rect className="mart-siren" x="16" y="17" width="10" height="5" rx="2" fill="#3b82f6" />
        <circle cx="16" cy="46" r="5" fill="#1e293b" stroke="#94a3b8" strokeWidth="2" />
        <circle cx="44" cy="46" r="5" fill="#1e293b" stroke="#94a3b8" strokeWidth="2" />
      </g>
    </svg>
  );
}
