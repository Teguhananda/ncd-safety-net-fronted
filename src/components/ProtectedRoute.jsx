import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// REVISI (Sept 2026): + ambulans & UGD — sebelumnya akun ambulans yang
// login dilempar ke Portal Pasien karena tidak dikenal sebagai staff.
const STAFF_ROLES = ["admin", "petugas", "dokter", "manajemen", "case_manager", "ambulance_rsud", "ambulance_psc119", "ugd"];

export default function ProtectedRoute({ children }) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="login-wrap">
        <div className="stat-sub">Memuat...</div>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  // Perbaikan: sebelumnya hanya cek "sudah login", tidak cek role — jadi
  // kalau pasien (login lewat QR Portal) entah kenapa mendarat di rute
  // staff (mis. root "/"), tetap tampil kerangka Dashboard staff karena
  // dianggap "sudah login". Sekarang pasien (role "pasien") dialihkan ke
  // Portal-nya sendiri, bukan ditampilkan halaman staff.
  if (!STAFF_ROLES.includes(role)) {
    return <Navigate to="/portal" replace />;
  }
  return children;
}
