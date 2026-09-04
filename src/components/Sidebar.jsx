import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { to: "/", label: "Dasbor", roles: ["admin", "petugas", "dokter", "manajemen"] },
  { to: "/patients", label: "Daftar Pasien", roles: ["admin", "petugas", "dokter"] },
  { to: "/screening", label: "Skrining NCD", roles: ["admin", "petugas"] },
  { to: "/clinical-review", label: "Tinjauan Klinis", roles: ["admin", "dokter"] },
  { to: "/followup", label: "Tindak Lanjut", roles: ["admin", "petugas", "dokter"] },
  { to: "/incident", label: "Lapor Insiden", roles: ["admin", "petugas", "dokter"] },
  { to: "/incident-list", label: "Daftar Insiden", roles: ["admin", "petugas", "dokter"] },
  { to: "/analytics", label: "Analitik PMKP", roles: ["admin", "manajemen"] },
  { to: "/before-after", label: "Before–After", roles: ["admin", "manajemen"] },
  { to: "/audit-trail", label: "Jejak Audit", roles: ["admin", "manajemen"] },
  { to: "/admin", label: "Administrasi", roles: ["admin"] },
];

export default function Sidebar() {
  const { role, user, logout } = useAuth();
  const visibleItems = NAV_ITEMS.filter((item) => !role || item.roles.includes(role));

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
          <div style={{ marginBottom: 8 }}>Role: {role || "-"}</div>
          <button className="btn btn-ghost" style={{ width: "100%" }} onClick={logout}>
            Keluar
          </button>
        </div>
      </div>
    </aside>
  );
}
