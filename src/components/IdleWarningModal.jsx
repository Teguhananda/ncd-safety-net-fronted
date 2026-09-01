import { useAuth } from "../context/AuthContext";

/**
 * IdleWarningModal — muncul setelah 15 menit tanpa aktivitas (Fase 10).
 * Pengguna harus menekan "Tetap Login" secara sadar; kalau dibiarkan sampai
 * hitung mundur habis, sesi otomatis logout (data yang belum disimpan di
 * form manapun akan hilang — ini konsekuensi wajar dari kebijakan keamanan
 * data pasien, bukan bug).
 */
export default function IdleWarningModal() {
  const { idleWarning, warningSecondsLeft, extendSession, logout } = useAuth();

  if (!idleWarning) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(23,38,43,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div className="card" style={{ width: 360, textAlign: "center" }}>
        <h3 style={{ marginBottom: 10 }}>Sesi Akan Berakhir</h3>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 4 }}>
          Anda tidak aktif selama beberapa waktu. Untuk menjaga keamanan data pasien, sesi akan otomatis
          keluar dalam:
        </p>
        <div className="stat-value mono" style={{ color: "var(--redflag)", margin: "10px 0" }}>
          {warningSecondsLeft}s
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 12 }}>
          <button className="btn btn-primary" onClick={extendSession}>
            Tetap Login
          </button>
          <button className="btn btn-ghost" onClick={logout}>
            Keluar Sekarang
          </button>
        </div>
      </div>
    </div>
  );
}
