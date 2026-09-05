import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import PortalLogin from "./pages/portal/PortalLogin";
import PortalHome from "./pages/portal/PortalHome";
import PatientProtectedRoute from "./components/PatientProtectedRoute";
import "./portal-styles.css";

/**
 * portal-main.jsx — entry point TERPISAH khusus Portal Pasien (My NCD
 * Safety), dipakai oleh portal.html (build multi-page Vite). Sengaja
 * tidak mengimpor App.jsx/AuthProvider staff sama sekali — supaya bundle
 * Portal Pasien ringan dan 100% terisolasi dari kode staff.
 *
 * Kenapa perlu HTML terpisah (bukan cuma route di App.jsx yang sudah
 * ada): supaya <link rel="manifest"> Portal Pasien tertanam STATIS sejak
 * awal di portal.html, bukan diganti lewat JavaScript setelah halaman
 * dimuat — teknik ganti-manifest-lewat-JS ternyata tidak diandalkan
 * Safari iOS saat "Add to Home Screen".
 */
function PortalApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/portal/login" element={<PortalLogin />} />
        <Route path="/portal" element={<PatientProtectedRoute><PortalHome /></PatientProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <PortalApp />
  </React.StrictMode>
);
