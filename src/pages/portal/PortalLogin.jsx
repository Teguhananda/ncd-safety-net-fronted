import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { patientPortalLogin } from "../../lib/api";
import { usePortalPwa } from "../../pwa/usePortalPwa";
import "../../portal-styles.css";

/**
 * PortalLogin.jsx — pintu masuk "My NCD Safety". Dibuka dari QR yang
 * dicetak petugas (URL: /portal/login?pid=<patientId>&token=<qrLoginToken>).
 * TIDAK memakai AuthContext staff (idle timeout dkk) — sesi pasien memang
 * dirancang bertahan lama, sesuai keputusan Bapak.
 */
export default function PortalLogin() {
  usePortalPwa();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading"); // loading | error | ok
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const pid = params.get("pid");
    const token = params.get("token");

    if (!pid || !token) {
      setStatus("error");
      setErrorMsg("Link QR tidak lengkap. Minta petugas cetak ulang QR dari Daftar Pasien.");
      return;
    }

    (async () => {
      try {
        const { customToken } = await patientPortalLogin(pid, token);
        await signInWithCustomToken(auth, customToken);
        navigate("/portal", { replace: true });
      } catch (err) {
        setStatus("error");
        setErrorMsg(err.message || "Gagal login. Coba scan ulang QR.");
      }
    })();
  }, [params, navigate]);

  return (
    <div className="portal-shell portal-center">
      <div className="portal-card">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <img src="/logos/app-logo.png" alt="My NCD Safety" className="portal-logo-img" style={{ width: 64, height: 64 }} />
          <h2 style={{ margin: 0 }}>My NCD Safety</h2>
        </div>
        {status === "loading" && <p>Memuat, mohon tunggu...</p>}
        {status === "error" && (
          <>
            <p className="portal-error">{errorMsg}</p>
            <p className="portal-sub">Kalau masalah berlanjut, tunjukkan pesan ini ke petugas RSUD Kab. Rejang Lebong.</p>
          </>
        )}
      </div>
    </div>
  );
}
