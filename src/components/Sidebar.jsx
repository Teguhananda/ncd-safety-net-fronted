import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { canSeeSignal } from "../lib/signalAccess";
import { SOS_ENABLED } from "../lib/features";
import { NavIcon } from "./NavIcons";

const ROLE_LABEL = {
  admin: "Admin",
  petugas: "Petugas",
  dokter: "Dokter",
  manajemen: "PMKP",
  case_manager: "Case Manager",
  ambulance_rsud: "Ambulans RSUD",
  ambulance_psc119: "Ambulans PSC 119",
  ugd: "UGD",
};

// REVISI (20 Okt 2026): tiap peran HANYA melihat menu yang memang ia kerjakan,
// supaya petugas tidak bingung/salah klik. Menu hanya DISEMBUNYIKAN — tidak ada
// akses baru yang ditambahkan (izin server/Firestore tidak berubah). Halaman yang
// dibuka lewat tombol/tautan di halaman lain (mis. Screening dari Daftar Pasien,
// tautan notifikasi) tetap bisa dibuka sesuai izin server.
//   Perawat      : Dasbor, Daftar Pasien, Skrining NCD, Tindak Lanjut, Home Safety Signals, Lapor Insiden
//   Dokter       : Dasbor, Daftar Pasien (Safety Plan/DPJP), Tinjauan Klinis, Home Safety Signals, Lapor Insiden
//   Case Manager : Dasbor, Daftar Pasien, Home Safety Signals, Lapor Insiden
//   PMKP         : Dasbor, Daftar Insiden, Analitik PMKP, Before–After, Jejak Audit
//   Admin        : semua menu
//   Ambulans/UGD : Dasbor saja selama SOS ditunda (Home Safety Signals + Asesmen Pra-RS muncul lagi bila SOS diaktifkan)
// Tombol "Tanyo Dokter" di atas halaman tetap tampil untuk Dokter, Perawat, Case Manager & Admin.
const NAV_ITEMS = [
  { to: "/", label: "Dasbor", roles: ["admin", "petugas", "dokter", "manajemen", "case_manager", "ambulance_rsud", "ambulance_psc119", "ugd"] },
  // BARU (Sept 2026): satu halaman, label menyesuaikan role (lihat labelFor)
  { to: "/prehospital", label: "Asesmen Pra-RS & UGD", roles: ["admin", "ambulance_rsud", "ambulance_psc119", "ugd"] },
  { to: "/patients", label: "Daftar Pasien", roles: ["admin", "petugas", "dokter", "case_manager"] },
  { to: "/screening", label: "Skrining NCD", roles: ["admin", "petugas"] },
  { to: "/clinical-review", label: "Tinjauan Klinis", roles: ["admin", "dokter"] },
  { to: "/followup", label: "Tindak Lanjut", roles: ["admin", "petugas"] },
  // Ambulans/UGD hanya menerima sinyal SOS → selama SOS ditunda halaman ini kosong
  // bagi mereka, jadi menunya ikut disembunyikan & otomatis muncul lagi bila SOS aktif.
  { to: "/safety-signals", label: "Home Safety Signals", roles: ["admin", "petugas", "dokter", "case_manager", ...(SOS_ENABLED ? ["ambulance_rsud", "ambulance_psc119", "ugd"] : [])] },
  { to: "/incident", label: "Lapor Insiden", roles: ["admin", "petugas", "dokter", "case_manager"] },
  { to: "/incident-list", label: "Daftar Insiden", roles: ["admin", "manajemen"] },
  { to: "/analytics", label: "Analitik PMKP", roles: ["admin", "manajemen"] },
  { to: "/before-after", label: "Before–After", roles: ["admin", "manajemen"] },
  { to: "/audit-trail", label: "Jejak Audit", roles: ["admin", "manajemen"] },
  { to: "/admin", label: "Administrasi", roles: ["admin"] },
];

function labelFor(item, role) {
  if (item.to !== "/prehospital") return item.label;
  if (role === "ugd") return "🚑 Kasus Masuk UGD";
  if (role === "ambulance_rsud" || role === "ambulance_psc119") return "🚑 Asesmen Pra-RS";
  return item.label;
}

export default function Sidebar({ pageTitle, pageMeta }) {
  const { role, user, logout } = useAuth();
  // 20 Okt 2026: menu Asesmen Pra-RS & UGD disembunyikan selama SOS ditunda.
  const visibleItems = NAV_ITEMS
    .filter((item) => SOS_ENABLED || item.to !== "/prehospital")
    .filter((item) => !role || item.roles.includes(role));
  const [activeSignalCount, setActiveSignalCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Badge merah real-time — dengar langsung perubahan Firestore (bukan
  // sekali ambil saja) supaya begitu ada Home Safety Signal baru masuk,
  // badge-nya langsung berubah tanpa perlu refresh halaman.
  useEffect(() => {
    if (!role) return;
    const unsub = onSnapshot(
      query(collection(db, "safety_signals"), where("workflowStatus", "!=", "CLOSED")),
      // REVISI (1 Okt 2026): hitung hanya sinyal yang boleh dilihat role ini
      (snap) => setActiveSignalCount(snap.docs.filter((d) => canSeeSignal(role, d.data())).length),
      () => {} // diamkan kalau gagal — widget tambahan, tidak boleh mengganggu sidebar utama
    );
    return unsub;
  }, [role]);

  return (
    <>
      {/* Tombol hamburger — hanya tampak di layar kecil (lihat CSS
          @media max-width:860px) supaya sidebar bisa disembunyikan/geser
          keluar-masuk di HP, bukan memenuhi seluruh layar. */}
      <button className="mobile-menu-btn" onClick={() => setMobileOpen((o) => !o)} aria-label="Buka menu">
        ☰
      </button>
      {mobileOpen && <div className="mobile-overlay" onClick={() => setMobileOpen(false)} />}

      <aside className={"sidebar" + (mobileOpen ? " sidebar-open" : "")}>
      <div className="brand page-brand">
        {/* REVISI (20 Okt 2026): nama aplikasi pindah ke tengah spanduk;
            di sini kini judul & keterangan halaman yang sedang dibuka. */}
        <div className="brand-text">
          <div className="page-title">{pageTitle || "BERENDO SEHAT"}</div>
          {pageMeta && <div className="page-meta">{pageMeta}</div>}
        </div>
      </div>
      <nav>
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}
          >
            <NavIcon to={item.to} />
            {labelFor(item, role)}
            {item.to === "/safety-signals" && activeSignalCount > 0 && (
              <span
                style={{
                  marginLeft: "auto",
                  background: "var(--redflag, #e6553f)",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 700,
                  borderRadius: 999,
                  padding: "2px 8px",
                  lineHeight: 1.4,
                }}
              >
                {activeSignalCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer" style={{ marginTop: "auto" }}>
        <div
          className="brand-logos-bottom"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            padding: "14px 18px",
            marginBottom: 14,
            borderRadius: 16,
            background: "#f2f7f9",
            border: "1px solid var(--line)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            boxShadow: "none",
          }}
        >
          {/* 20 Okt 2026: logo Komite Mutu diganti — kiri Pemda Rejang Lebong, kanan RSUD */}
          <img
            src="/logos/pemda-rl.png"
            alt="Logo Pemerintah Kabupaten Rejang Lebong"
            className="logo-img"
            style={{ width: 56, height: 56, objectFit: "contain" }}
          />
          <img
            src="/logos/rsud-logo.png"
            alt="Logo RSUD Kabupaten Rejang Lebong"
            className="logo-img"
            style={{ width: 56, height: 56, objectFit: "contain" }}
          />
        </div>
        <div className="role-switch">
          <div>{user && user.email}</div>
          <div style={{ marginBottom: 8 }}>Role: {ROLE_LABEL[role] || role || "-"}</div>
          <button className="btn btn-ghost" style={{ width: "100%" }} onClick={logout}>
            Keluar
          </button>
        </div>
      </div>
      </aside>
    </>
  );
}
