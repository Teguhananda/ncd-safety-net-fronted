import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { patientPortalLogin } from "../../lib/api";
import { usePortalPwa } from "../../pwa/usePortalPwa";
import QRScanner from "../../components/PortalQRScanner";
import "../../portal-styles.css";

/**
 * PortalLogin.jsx — pintu masuk "My NCD Safety". Dibuka dari QR yang
 * dicetak petugas (URL: /portal/login?pid=<patientId>&token=<qrLoginToken>).
 * TIDAK memakai AuthContext staff (idle timeout dkk) — sesi pasien memang
 * dirancang bertahan lama.
 *
 * BAGIAN BARU: fallback scan QR LANGSUNG DI DALAM aplikasi ini. Diperlukan
 * karena web app yang di-"Add to Home Screen" di iOS punya penyimpanan
 * SENDIRI, terpisah dari Safari — jadi sesi login yang berhasil di Safari
 * TIDAK ikut terbawa ke ikon yang terpasang. Solusinya: begitu ikon dibuka
 * pertama kali tanpa sesi/parameter QR, pasien scan ulang QR fisiknya
 * (kartu/kertas) langsung dari sini — setelah itu sesi tersimpan permanen
 * DI IKON tersebut, tidak perlu scan lagi selanjutnya.
 */
function parsePidToken(rawValue) {
  try {
    const url = new URL(rawValue);
    return { pid: url.searchParams.get("pid"), token: url.searchParams.get("token") };
  } catch {
    return { pid: null, token: null }; // bukan URL yang valid
  }
}

export default function PortalLogin() {
  usePortalPwa();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading"); // loading | error | needScan | ok
  const [errorMsg, setErrorMsg] = useState("");
  const [scanBusy, setScanBusy] = useState(false);

  const doLogin = async (pid, token) => {
    try {
      const { customToken } = await patientPortalLogin(pid, token);
      await signInWithCustomToken(auth, customToken);
      navigate("/portal", { replace: true });
    } catch (err) {
      setStatus("error");
      setErrorMsg(err.message || "Gagal login. Coba scan ulang QR.");
    }
  };

  useEffect(() => {
    const pid = params.get("pid");
    const token = params.get("token");

    if (!pid || !token) {
      // Bukan error permanen — kemungkinan besar ikon di Home Screen yang
      // penyimpanannya terpisah dari Safari. Tawarkan scan ulang dari sini.
      setStatus("needScan");
      return;
    }
    doLogin(pid, token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const handleScanned = (rawValue) => {
    if (scanBusy) return;
    setScanBusy(true);
    const { pid, token } = parsePidToken(rawValue);
    if (!pid || !token) {
      setStatus("error");
      setErrorMsg("QR yang discan bukan QR Portal Pasien yang valid.");
      return;
    }
    setStatus("loading");
    doLogin(pid, token);
  };

  return (
    <div className="portal-shell portal-center">
      <div className="portal-card" style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <img src="/logos/app-logo.png" alt="My NCD Safety" className="portal-logo-img" style={{ width: 64, height: 64 }} />
          <h2 style={{ margin: 0 }}>My NCD Safety</h2>
        </div>

        {status === "loading" && <p>Memuat, mohon tunggu...</p>}

        {status === "needScan" && (
          <>
            <p className="portal-sub" style={{ marginBottom: 10 }}>
              Silakan scan QR Portal Pasien Anda (kartu/kertas dari petugas) untuk masuk.
            </p>
            <QRScanner onDetected={handleScanned} />
          </>
        )}

        {status === "error" && (
          <>
            <p className="portal-error">{errorMsg}</p>
            <p className="portal-sub">Kalau masalah berlanjut, tunjukkan pesan ini ke petugas RSUD Kab. Rejang Lebong.</p>
            <button className="portal-primary-btn" onClick={() => { setStatus("needScan"); setErrorMsg(""); }}>
              Coba Scan Lagi
            </button>
          </>
        )}
      </div>
    </div>
  );
}
