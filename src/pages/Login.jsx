import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// HARUS sama dengan STAFF_ROLES di components/ProtectedRoute.jsx
const STAFF_ROLES = ["admin", "petugas", "dokter", "manajemen", "case_manager"];

export default function Login() {
  const { login, logout, user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // PERBAIKAN (Sept 2026): pindah ke Dasbor HANYA setelah akun & perannya
  // benar-benar selesai dimuat (sebelumnya pindah langsung setelah sandi
  // diterima → terlempar balik ke halaman login → harus login 2 kali).
  // Juga: kalau sudah login lalu membuka /login, otomatis ke Dasbor.
  useEffect(() => {
    if (authLoading || !user) return;
    if (STAFF_ROLES.includes(role)) {
      navigate("/", { replace: true });
    } else {
      setLoading(false);
      setError("Akun ini tidak memiliki akses ke dasbor staff. Hubungi admin.");
      logout();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, role]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      // Tidak navigate di sini — ditangani useEffect di atas setelah peran
      // selesai dimuat. Tombol tetap "Memproses..." sampai pindah halaman.
    } catch (err) {
      setLoading(false);
      const code = err && err.code ? err.code : "";
      if (code === "auth/network-request-failed") {
        setError("Tidak ada koneksi internet. Periksa jaringan lalu coba lagi.");
      } else if (code === "auth/too-many-requests") {
        setError("Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.");
      } else {
        setError("Email atau kata sandi salah.");
      }
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="brand">
          <img
            src="/logos/app-logo.png"
            alt="NCD Safety Net"
            className="brand-mark-img"
            style={{ width: 72, height: 72, objectFit: "contain" }}
          />
          <div className="brand-text">
            <div className="name">NCD Safety Net</div>
            <div className="sub">RSUD KAB. REJANG LEBONG</div>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Email</label>
            <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label>Kata Sandi</label>
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <div className="error-text">{error}</div>}
          <button className="btn btn-primary" style={{ width: "100%", marginTop: 8 }} disabled={loading}>
            {loading ? "Memproses..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}
