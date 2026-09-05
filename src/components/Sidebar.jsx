import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";

const ROLE_LABEL = {
  admin: "Admin",
  petugas: "Petugas",
  dokter: "Dokter",
  manajemen: "PMKP",
  case_manager: "Case Manager",
};

const NAV_ITEMS = [
  { to: "/", label: "Dasbor", roles: ["admin", "petugas", "dokter", "manajemen", "case_manager"] },
  { to: "/patients", label: "Daftar Pasien", roles: ["admin", "petugas", "dokter", "case_manager"] },
  { to: "/screening", label: "Skrining NCD", roles: ["admin", "petugas"] },
  { to: "/clinical-review", label: "Tinjauan Klinis", roles: ["admin", "dokter"] },
  { to: "/followup", label: "Tindak Lanjut", roles: ["admin", "petugas", "dokter"] },
  { to: "/safety-signals", label: "Home Safety Signals", roles: ["admin", "petugas", "dokter", "manajemen", "case_manager"] },
  { to: "/incident", label: "Lapor Insiden", roles: ["admin", "petugas", "dokter", "case_manager"] },
  { to: "/incident-list", label: "Daftar Insiden", roles: ["admin", "petugas", "dokter", "case_manager"] },
  { to: "/analytics", label: "Analitik PMKP", roles: ["admin", "manajemen"] },
  { to: "/before-after", label: "Before–After", roles: ["admin", "manajemen"] },
  { to: "/audit-trail", label: "Jejak Audit", roles: ["admin", "manajemen"] },
  { to: "/admin", label: "Administrasi", roles: ["admin"] },
];

export default function Sidebar() {
  const { role, user, logout } = useAuth();
  const visibleItems = NAV_ITEMS.filter((item) => !role || item.roles.includes(role));
  const [activeSignalCount, setActiveSignalCount] = useState(0);

  // Badge merah real-time — dengar langsung perubahan Firestore (bukan
  // sekali ambil saja) supaya begitu ada Home Safety Signal baru masuk,
  // badge-nya langsung berubah tanpa perlu refresh halaman.
  useEffect(() => {
    if (!role) return;
    const unsub = onSnapshot(
      query(collection(db, "safety_signals"), where("workflowStatus", "!=", "CLOSED")),
      (snap) => setActiveSignalCount(snap.size),
      () => {} // diamkan kalau gagal — widget tambahan, tidak boleh mengganggu sidebar utama
    );
    return unsub;
  }, [role]);

  return (
    <aside className="sidebar">
      <div className="brand">
        <img
          src="/logos/app-logo.png"
          alt="NCD Safety Net"
          className="app-logo-img"
          style={{ width: 40, height: 40, objectFit: "contain" }}
        />
        <div className="brand-text">
          <div className="name">NCD Safety Net</div>
          <div className="sub">RSUD KAB. REJANG LEBONG</div>
        </div>
      </div>
      <nav>
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}
          >
            <span className="nav-dot"></span>
            {item.label}
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
            background: "rgba(255, 255, 255, 0.10)",
            border: "1px solid rgba(255, 255, 255, 0.18)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            boxShadow: "0 4px 18px rgba(0, 0, 0, 0.25)",
          }}
        >
          <img
            src="/logos/rsud-logo.png"
            alt="Logo RSUD"
            className="logo-img"
            style={{ width: 56, height: 56, objectFit: "contain" }}
          />
          <img
            src="/logos/komite-logo.png"
            alt="Logo Komite Mutu"
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
  );
}
