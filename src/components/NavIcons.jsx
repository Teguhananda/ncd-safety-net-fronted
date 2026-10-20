/**
 * NavIcons.jsx — BARU (20 Okt 2026). Ikon ilustrasi DIAM untuk menu samping
 * dasbor petugas. Digambar khusus untuk BERENDO SEHAT (bukan pustaka ikon),
 * memakai palet tosca–coral. Sengaja TANPA animasi: di dasbor petugas,
 * gerakan/kedip hanya dipakai untuk tanda bahaya (pasien URGENT/red flag).
 */
const T = "#0F9F9A";   // tosca
const TD = "#087F8C";  // tosca gelap
const C = "#FF7A6B";   // coral
const A = "#F2B33D";   // amber
const B = "#4385C5";   // biru
const U = "#8B7CC8";   // ungu
const G = "#69A982";   // hijau
const K = "#F6C9A0";   // kulit
const D = "#173B46";   // garis gelap
const W = "#FFFFFF";

const Svg = ({ children }) => (
  <svg viewBox="0 0 32 32" width="31" height="31" aria-hidden="true" focusable="false">{children}</svg>
);

/* Dasbor — rumah kecil (berendo) dengan atap tosca & jendela hati */
const IconDasbor = () => (
  <Svg>
    <path d="M5 15 L16 6 L27 15" fill="none" stroke={TD} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="8" y="14" width="16" height="13" rx="2.5" fill={W} stroke={D} strokeWidth="1.4" />
    <path d="M16 23.5 C11.8 20.6 12.6 17.2 14.6 17.2 C15.4 17.2 16 17.8 16 18.4 C16 17.8 16.6 17.2 17.4 17.2 C19.4 17.2 20.2 20.6 16 23.5 Z" fill={C} />
    <rect x="21" y="7" width="3" height="5" rx="1" fill={A} />
  </Svg>
);

/* Daftar Pasien — kakek berkacamata & nenek tersenyum */
const IconPasien = () => (
  <Svg>
    <path d="M3 28 C3 22 7 19.5 11 19.5 C15 19.5 19 22 19 28 Z" fill={T} />
    <circle cx="11" cy="13" r="5" fill={K} />
    <path d="M6.2 12 C6.6 8.2 10 7.2 11.6 7.6 C14 8 15.6 9.6 15.8 12 C14 10.4 9 10.2 6.2 12 Z" fill="#D7DEE2" />
    <circle cx="9" cy="13.3" r="1.6" fill="none" stroke={D} strokeWidth="0.9" />
    <circle cx="13" cy="13.3" r="1.6" fill="none" stroke={D} strokeWidth="0.9" />
    <path d="M10.6 13.3 H11.4" stroke={D} strokeWidth="0.9" />
    <path d="M9.6 16 Q11 17 12.4 16" fill="none" stroke={D} strokeWidth="0.9" strokeLinecap="round" />
    <path d="M14 28 C14 23 17.4 21 21 21 C24.6 21 29 23 29 28 Z" fill={C} />
    <circle cx="21.5" cy="15.5" r="4.4" fill={K} />
    <circle cx="21.5" cy="10.4" r="2.3" fill="#C9D1D6" />
    <path d="M17 15 C17 11.6 19.4 10.8 21.5 10.8 C23.6 10.8 26 11.6 26 15 C24.6 13.2 18.4 13.2 17 15 Z" fill="#C9D1D6" />
    <circle cx="20.2" cy="15.8" r="0.7" fill={D} />
    <circle cx="22.8" cy="15.8" r="0.7" fill={D} />
    <path d="M20.3 17.6 Q21.5 18.5 22.7 17.6" fill="none" stroke={D} strokeWidth="0.9" strokeLinecap="round" />
    <circle cx="19.3" cy="17.2" r="0.8" fill={C} opacity="0.6" />
    <circle cx="23.7" cy="17.2" r="0.8" fill={C} opacity="0.6" />
  </Svg>
);

/* Skrining NCD — tensimeter digital + tetes gula darah */
const IconSkrining = () => (
  <Svg>
    <rect x="4" y="6" width="16" height="20" rx="3.5" fill={W} stroke={D} strokeWidth="1.4" />
    <rect x="6.5" y="9" width="11" height="7" rx="1.5" fill={TD} />
    <path d="M8 12.5 H10 L11 10.5 L12.4 14.5 L13.4 12.5 H16" fill="none" stroke={W} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="9" cy="20.5" r="1.6" fill={C} />
    <circle cx="15" cy="20.5" r="1.6" fill={A} />
    <path d="M20 16 C22 16 22 22 25 22" fill="none" stroke={D} strokeWidth="1.4" strokeLinecap="round" />
    <path d="M25.5 9 C25.5 9 22.5 12.6 22.5 14.6 C22.5 16.3 23.8 17.5 25.5 17.5 C27.2 17.5 28.5 16.3 28.5 14.6 C28.5 12.6 25.5 9 25.5 9 Z" fill={C} />
    <path d="M24.4 14.4 Q24.6 15.8 25.8 16" fill="none" stroke={W} strokeWidth="0.8" strokeLinecap="round" />
  </Svg>
);

/* Tinjauan Klinis — papan klip + stetoskop */
const IconTinjauan = () => (
  <Svg>
    <rect x="6" y="5" width="16" height="22" rx="2.5" fill={W} stroke={D} strokeWidth="1.4" />
    <rect x="10.5" y="3" width="7" height="4" rx="1.5" fill={A} stroke={D} strokeWidth="1" />
    <path d="M9.5 12 H18.5 M9.5 15.5 H16 M9.5 19 H14" stroke={T} strokeWidth="1.6" strokeLinecap="round" />
    <path d="M23 7 V14 C23 18 19 18 19 21.5" fill="none" stroke={D} strokeWidth="1.5" strokeLinecap="round" />
    <path d="M27 7 V14 C27 19 31 18 28 23" fill="none" stroke={D} strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="26" cy="25" r="3" fill={TD} stroke={D} strokeWidth="1" />
    <circle cx="26" cy="25" r="1.1" fill={W} />
  </Svg>
);

/* Tindak Lanjut — kalender dengan centang coral */
const IconTindakLanjut = () => (
  <Svg>
    <rect x="4" y="7" width="24" height="20" rx="3.5" fill={W} stroke={D} strokeWidth="1.4" />
    <path d="M4 10.5 C4 8.6 5.6 7 7.5 7 H24.5 C26.4 7 28 8.6 28 10.5 V13 H4 Z" fill={T} />
    <rect x="9" y="4" width="2.4" height="5.5" rx="1.2" fill={D} />
    <rect x="20.6" y="4" width="2.4" height="5.5" rx="1.2" fill={D} />
    <circle cx="9.5" cy="18" r="1.2" fill="#C9D9D8" />
    <circle cx="14" cy="18" r="1.2" fill="#C9D9D8" />
    <circle cx="9.5" cy="22.5" r="1.2" fill="#C9D9D8" />
    <circle cx="21" cy="20.5" r="5" fill={C} />
    <path d="M18.6 20.6 L20.4 22.4 L23.6 18.9" fill="none" stroke={W} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

/* Home Safety Signals — rumah kecil memancarkan sinyal */
const IconSinyal = () => (
  <Svg>
    <path d="M6 18 L13 12 L20 18" fill="none" stroke={TD} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="8" y="17" width="10" height="10" rx="2" fill={W} stroke={D} strokeWidth="1.3" />
    <rect x="11.4" y="21" width="3.2" height="6" rx="1" fill={A} />
    <path d="M21 9 C23.5 9.8 25.2 11.6 25.8 14" fill="none" stroke={C} strokeWidth="1.8" strokeLinecap="round" />
    <path d="M21.6 4.8 C25.8 5.8 29 9 29.8 13.4" fill="none" stroke={C} strokeWidth="1.8" strokeLinecap="round" opacity="0.6" />
    <circle cx="20" cy="11.5" r="1.8" fill={C} />
  </Svg>
);

/* Lapor Insiden — perisai dengan tanda seru + pensil */
const IconLapor = () => (
  <Svg>
    <path d="M14 3.5 L23 7 V14.5 C23 20.5 19 24.5 14 27 C9 24.5 5 20.5 5 14.5 V7 Z" fill={A} stroke={D} strokeWidth="1.3" strokeLinejoin="round" />
    <rect x="12.7" y="9" width="2.6" height="8.5" rx="1.3" fill={D} />
    <circle cx="14" cy="21" r="1.5" fill={D} />
    <path d="M21 26.5 L28.5 19 L30.5 21 L23 28.5 L20.3 29.2 Z" fill={C} stroke={D} strokeWidth="1" strokeLinejoin="round" />
    <path d="M27 20.5 L29 22.5" stroke={W} strokeWidth="0.9" />
  </Svg>
);

/* Daftar Insiden — map berisi tumpukan laporan */
const IconDaftarInsiden = () => (
  <Svg>
    <rect x="9" y="4" width="15" height="17" rx="2" fill={W} stroke={D} strokeWidth="1.2" transform="rotate(8 16 12)" />
    <rect x="7" y="5" width="15" height="17" rx="2" fill={W} stroke={D} strokeWidth="1.2" />
    <path d="M10 10 H19 M10 13 H17" stroke={U} strokeWidth="1.5" strokeLinecap="round" />
    <path d="M3 13 C3 11.9 3.9 11 5 11 H11 L13 13.5 H27 C28.1 13.5 29 14.4 29 15.5 V26 C29 27.1 28.1 28 27 28 H5 C3.9 28 3 27.1 3 26 Z" fill={U} stroke={D} strokeWidth="1.2" strokeLinejoin="round" />
    <rect x="12" y="19" width="8" height="3.2" rx="1.6" fill={W} opacity="0.9" />
  </Svg>
);

/* Analitik PMKP — grafik batang warna-warni + bintang */
const IconAnalitik = () => (
  <Svg>
    <rect x="3.5" y="5" width="25" height="22" rx="3.5" fill={W} stroke={D} strokeWidth="1.3" />
    <rect x="8" y="17" width="3.4" height="6.5" rx="1" fill={B} />
    <rect x="13" y="13" width="3.4" height="10.5" rx="1" fill={T} />
    <rect x="18" y="15.5" width="3.4" height="8" rx="1" fill={C} />
    <path d="M7.5 13 L13 9.5 L18 11.5 L23 7.5" fill="none" stroke={A} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M25.5 15.5 L26.3 17.4 L28.3 17.6 L26.8 18.9 L27.3 20.9 L25.5 19.8 L23.7 20.9 L24.2 18.9 L22.7 17.6 L24.7 17.4 Z" fill={A} stroke={D} strokeWidth="0.6" strokeLinejoin="round" />
  </Svg>
);

/* Before–After — tunas kecil tumbuh jadi tanaman berbunga */
const IconBeforeAfter = () => (
  <Svg>
    <path d="M3 26 H13 L12 29 H4 Z" fill={C} />
    <path d="M8 26 V20" stroke={G} strokeWidth="1.6" strokeLinecap="round" />
    <path d="M8 21.5 C6 21.5 5 20 5 18.5 C7 18.5 8 19.8 8 21.5 Z" fill={G} />
    <path d="M14.5 17 H17.5" stroke={D} strokeWidth="1.4" strokeLinecap="round" />
    <path d="M16.5 15.6 L18 17 L16.5 18.4" fill="none" stroke={D} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M19 26 H30 L29 29 H20 Z" fill={C} />
    <path d="M24.5 26 V11" stroke={G} strokeWidth="1.8" strokeLinecap="round" />
    <path d="M24.5 21 C21.5 21 20 19 20 16.8 C23 16.8 24.5 18.6 24.5 21 Z" fill={G} />
    <path d="M24.5 18 C27.5 18 29 16 29 13.8 C26 13.8 24.5 15.6 24.5 18 Z" fill={G} />
    <circle cx="24.5" cy="8.5" r="2.2" fill={A} />
    <circle cx="22.2" cy="8.5" r="1.6" fill={C} />
    <circle cx="26.8" cy="8.5" r="1.6" fill={C} />
    <circle cx="24.5" cy="6.2" r="1.6" fill={C} />
    <circle cx="24.5" cy="10.8" r="1.6" fill={C} />
    <circle cx="24.5" cy="8.5" r="1.3" fill={A} />
  </Svg>
);

/* Jejak Audit — jejak kaki + kaca pembesar */
const IconAudit = () => (
  <Svg>
    <ellipse cx="7" cy="23" rx="2.6" ry="3.6" fill={TD} transform="rotate(-15 7 23)" />
    <circle cx="5.2" cy="18.2" r="0.9" fill={TD} />
    <circle cx="7.2" cy="17.6" r="0.9" fill={TD} />
    <circle cx="9" cy="18.4" r="0.9" fill={TD} />
    <ellipse cx="13" cy="15" rx="2.4" ry="3.3" fill={T} opacity="0.75" transform="rotate(10 13 15)" />
    <circle cx="11.6" cy="10.6" r="0.8" fill={T} opacity="0.75" />
    <circle cx="13.5" cy="10.3" r="0.8" fill={T} opacity="0.75" />
    <circle cx="15.2" cy="11" r="0.8" fill={T} opacity="0.75" />
    <circle cx="22" cy="12" r="6" fill="#EAF6FF" stroke={D} strokeWidth="1.6" />
    <path d="M19.4 10.4 Q20.6 8.6 22.6 8.6" fill="none" stroke={W} strokeWidth="1.4" strokeLinecap="round" />
    <path d="M26.2 16.4 L30 20.4" stroke={C} strokeWidth="3" strokeLinecap="round" />
  </Svg>
);

/* Administrasi — roda gigi tersenyum + kunci */
const IconAdmin = () => (
  <Svg>
    <path d="M13.3 3.5 H16.7 L17.3 6.6 C18.3 6.9 19.2 7.4 20 8 L23 6.9 L24.7 9.8 L22.3 11.8 C22.5 12.8 22.5 13.8 22.3 14.8 L24.7 16.8 L23 19.7 L20 18.6 C19.2 19.2 18.3 19.7 17.3 20 L16.7 23.1 H13.3 L12.7 20 C11.7 19.7 10.8 19.2 10 18.6 L7 19.7 L5.3 16.8 L7.7 14.8 C7.5 13.8 7.5 12.8 7.7 11.8 L5.3 9.8 L7 6.9 L10 8 C10.8 7.4 11.7 6.9 12.7 6.6 Z" fill={T} stroke={D} strokeWidth="1.1" strokeLinejoin="round" />
    <circle cx="15" cy="13.3" r="5" fill={W} />
    <circle cx="13.3" cy="12.6" r="0.8" fill={D} />
    <circle cx="16.7" cy="12.6" r="0.8" fill={D} />
    <path d="M13.2 14.6 Q15 16 16.8 14.6" fill="none" stroke={D} strokeWidth="0.9" strokeLinecap="round" />
    <circle cx="23" cy="24" r="3.2" fill={A} stroke={D} strokeWidth="1" />
    <circle cx="23" cy="24" r="1" fill={W} />
    <path d="M20.6 26.2 L16 30.6 M17.6 29 L19 30.4 M18.8 27.8 L20 29" stroke={D} strokeWidth="1.4" strokeLinecap="round" />
  </Svg>
);

/* Asesmen Pra-RS & UGD — mobil ambulans mungil (menu sedang ditunda) */
const IconAmbulans = () => (
  <Svg>
    <path d="M3 22 V12.5 C3 11.7 3.7 11 4.5 11 H19 V22 Z" fill={W} stroke={D} strokeWidth="1.3" />
    <path d="M19 14 H24 L28.5 18.5 V22 H19 Z" fill={W} stroke={D} strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M20.5 15.5 H23.4 L26.3 18.4 H20.5 Z" fill="#CFE6F5" />
    <path d="M9.5 13.8 V19.2 M6.8 16.5 H12.2" stroke={C} strokeWidth="2.2" strokeLinecap="round" />
    <rect x="9" y="8" width="4" height="3" rx="1" fill={C} />
    <rect x="3" y="21" width="25.5" height="2.6" fill={TD} />
    <circle cx="9" cy="25" r="2.6" fill={D} />
    <circle cx="9" cy="25" r="1" fill={W} />
    <circle cx="23" cy="25" r="2.6" fill={D} />
    <circle cx="23" cy="25" r="1" fill={W} />
  </Svg>
);

export const NAV_ICON = {
  "/": IconDasbor,
  "/prehospital": IconAmbulans,
  "/patients": IconPasien,
  "/screening": IconSkrining,
  "/clinical-review": IconTinjauan,
  "/followup": IconTindakLanjut,
  "/safety-signals": IconSinyal,
  "/incident": IconLapor,
  "/incident-list": IconDaftarInsiden,
  "/analytics": IconAnalitik,
  "/before-after": IconBeforeAfter,
  "/audit-trail": IconAudit,
  "/admin": IconAdmin,
};

/* Warna latar ubin ikon (pastel) per menu */
export const NAV_TINT = {
  "/": "#FFF0ED",
  "/prehospital": "#FDE9E9",
  "/patients": "#E8F5F4",
  "/screening": "#FFF4D9",
  "/clinical-review": "#E8F1FF",
  "/followup": "#E8F5F4",
  "/safety-signals": "#FFF0ED",
  "/incident": "#FFF4D9",
  "/incident-list": "#F0EDFA",
  "/analytics": "#E8F1FF",
  "/before-after": "#E2F7EF",
  "/audit-trail": "#E8F5F4",
  "/admin": "#FFF4D9",
};

export function NavIcon({ to }) {
  const I = NAV_ICON[to];
  if (!I) return <span className="nav-dot"></span>;
  return (
    <span className="nav-icon" style={{ background: NAV_TINT[to] || "#E8F5F4" }}>
      <I />
    </span>
  );
}
