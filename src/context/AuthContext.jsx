import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "../lib/firebase";

const AuthContext = createContext(null);

/**
 * Kebijakan session idle timeout (Fase 10, item checklist #5).
 * IDLE_LIMIT_MS = waktu tanpa aktivitas sebelum peringatan muncul.
 * WARNING_DURATION_MS = berapa lama peringatan tampil sebelum auto-logout.
 * Total waktu sampai logout otomatis = IDLE_LIMIT_MS + WARNING_DURATION_MS.
 *
 * [REQUIRES GOVERNANCE VALIDATION] Nilai 15 menit + 60 detik peringatan ini
 * adalah default wajar untuk aplikasi kesehatan, tapi kebijakan final tetap
 * sebaiknya dikonfirmasi komite/kebijakan keamanan RS. Bisa diubah cukup
 * lewat dua konstanta di bawah ini, tidak perlu ubah logika lain.
 */
const IDLE_LIMIT_MS = 15 * 60 * 1000; // 15 menit
const WARNING_DURATION_MS = 60 * 1000; // 60 detik peringatan sebelum logout

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [idleWarning, setIdleWarning] = useState(false);
  const [warningSecondsLeft, setWarningSecondsLeft] = useState(WARNING_DURATION_MS / 1000);

  const idleTimerRef = useRef(null);
  const warningTimerRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const tokenResult = await u.getIdTokenResult(true);
        setRole(tokenResult.claims.role || null);
        setUser(u);
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);

  const logout = useCallback(() => {
    clearTimeout(idleTimerRef.current);
    clearTimeout(warningTimerRef.current);
    clearInterval(countdownIntervalRef.current);
    setIdleWarning(false);
    return signOut(auth);
  }, []);

  const startWarningCountdown = useCallback(() => {
    setIdleWarning(true);
    setWarningSecondsLeft(WARNING_DURATION_MS / 1000);

    countdownIntervalRef.current = setInterval(() => {
      setWarningSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);

    warningTimerRef.current = setTimeout(() => {
      logout();
    }, WARNING_DURATION_MS);
  }, [logout]);

  const resetIdleTimer = useCallback(() => {
    if (!user) return; // hanya aktif untuk user yang sudah login
    clearTimeout(idleTimerRef.current);
    clearTimeout(warningTimerRef.current);
    clearInterval(countdownIntervalRef.current);
    setIdleWarning(false);
    idleTimerRef.current = setTimeout(startWarningCountdown, IDLE_LIMIT_MS);
  }, [user, startWarningCountdown]);

  // "Tetap Login" — dipanggil dari IdleWarningModal
  const extendSession = useCallback(() => {
    resetIdleTimer();
  }, [resetIdleTimer]);

  useEffect(() => {
    if (!user) {
      clearTimeout(idleTimerRef.current);
      clearTimeout(warningTimerRef.current);
      clearInterval(countdownIntervalRef.current);
      setIdleWarning(false);
      return;
    }

    resetIdleTimer();

    const handleActivity = () => {
      // Selama peringatan sedang tampil, aktivitas biasa TIDAK otomatis
      // membatalkannya — pengguna harus menekan "Tetap Login" secara sadar,
      // supaya sesi tidak diperpanjang tanpa sepengetahuan (mis. mouse
      // tersenggol tanpa sengaja saat pengguna sudah meninggalkan komputer).
      if (!idleWarning) {
        resetIdleTimer();
      }
    };

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, handleActivity));
    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, handleActivity));
      clearTimeout(idleTimerRef.current);
      clearTimeout(warningTimerRef.current);
      clearInterval(countdownIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, idleWarning]);

  return (
    <AuthContext.Provider
      value={{ user, role, loading, login, logout, idleWarning, warningSecondsLeft, extendSession }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
