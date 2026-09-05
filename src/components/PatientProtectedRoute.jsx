import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../lib/firebase";

/**
 * PatientProtectedRoute.jsx — pengganti ProtectedRoute khusus untuk rute
 * /portal/*. SENGAJA tidak memakai AuthContext staff (yang punya idle
 * timeout 15 menit) karena sesi pasien memang harus bertahan lama sampai
 * pasien logout sendiri — sesuai keputusan Bapak sebelumnya.
 */
export default function PatientProtectedRoute({ children }) {
  const [state, setState] = useState({ loading: true, isPasien: false });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setState({ loading: false, isPasien: false });
        return;
      }
      const tokenResult = await u.getIdTokenResult();
      setState({ loading: false, isPasien: tokenResult.claims.role === "pasien", patientId: tokenResult.claims.patientId });
    });
    return unsub;
  }, []);

  if (state.loading) return null;
  if (!state.isPasien) return <Navigate to="/portal/login" replace />;
  return children;
}
