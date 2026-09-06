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
 * BAGIAN BARU (login diam-diam / silent relogin): ikon "Add to Home
 * Screen" di iOS punya start_url STATIS (sama untuk semua pasien), jadi
 * TIDAK PERNAH membawa pid/token di URL setiap dibuka. Selain itu sesi
 * Firebase Auth yang tersimpan di penyimpanan iOS kadang dihapus sendiri
 * oleh sistem tanpa sebab yang bisa kita kendalikan dari kode.
 *
 * Solusinya: begitu pasien login sukses (baik lewat scan pertama kali
 * maupun scan ulang), pid+token disimpan di localStorage HP itu sendiri.
 * Setiap kali halaman ini dibuka TANPA parameter URL, kita coba login
 * ulang OTOMATIS & DIAM-DIAM pakai kredensial tersimpan tsb — pasien
 * tidak melihat kotak scan sama sekali. Kotak scan hanya muncul kalau:
 * (a) memang belum pernah login di HP ini, atau
 * (b) kredensial tersimpan sudah tidak berlaku lagi (QR kadaluarsa 180
 *     hari tidak dipakai, atau petugas mencetak ulang QR baru).
 */

const CREDS_KEY = "ncdPortalCreds"; // { pid, token } tersimpan lokal di HP ini

function parsePidToken(rawValue) {
  try {
    const url = new URL(rawValue);
    return { pid: url.searchParams.get("pid"), token: url.searchParams.get("token") };
  } catch {
    return { pid: null, token: null }; // bukan URL yang valid
  }
}

function saveCreds(pid, token) {
  try {
    localStorage.setItem(CREDS_KEY, JSON.stringify({ pid, token }));
  } catch {
    // localStorage penuh/diblokir browser — tidak fatal, paling pasien
    // akan diminta scan manual lagi kalau sesi Firebase-nya hilang.
  }
}

function loadCreds() {
  try {
    const raw = localStorage.getItem(CREDS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearCreds() {
  try {
    localStorage.removeItem(CREDS_KEY);
  } catch {
    // abaikan
  }
}

export default function PortalLogin() {
  usePortalPwa();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading"); // loading | error | needScan | ok
  const [errorMsg, setErrorMsg] = useState("");
  const [scanBusy, setScanBusy] = useState(false);

  const doLogin = async (pid, token, { silent = false } = {}) => {
    try {
      const { customToken } = await patientPortalLogin(pid, token);
      await signInWithCustomToken(auth, customToken);
      saveCreds(pid, token);
      navigate("/portal", { replace: true });
    } catch (err) {
      if (silent) {
        // Percobaan login otomatis (tanpa scan) gagal — kemungkinan QR
        // sudah kadaluarsa atau sudah diganti petugas. Hapus kredensial
        // lama supaya tidak dicoba berulang-ulang, lalu minta scan manual.
        clearCreds();
        setStatus("needScan");
        return;
      }
      setStatus("error");
      setErrorMsg(err.message || "Gagal login. Coba scan ulang QR.");
    }
  };

  useEffect(() => {
    const pid = params.get("pid");
    const token = params.get("token");

    if (pid && token) {
      doLogin(pid, token);
      return;
    }

    // Tidak ada pid/token di URL — normal untuk ikon Home Screen. Coba
    // login diam-diam pakai kredensial tersimpan dari scan sebelumnya.
    const saved = loadCreds();
    if (saved && saved.pid && saved.token) {
      setStatus("loading");
      doLogin(saved.pid, saved.token, { silent: true });
      return;
    }

    setStatus("needScan");
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
