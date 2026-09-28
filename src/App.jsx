import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import IdleWarningModal from "./components/IdleWarningModal";
import Login from "./pages/Login";

// ==== REVISI PERFORMA (Sept 2026): lazy loading per halaman ====
// Sebelumnya SEMUA halaman (plus library grafik) ikut diunduh sekaligus
// saat aplikasi staff dibuka (~561 kB). Sekarang tiap halaman jadi file
// kecil sendiri yang baru diunduh saat menunya dibuka, jadi layar
// pertama (Login/Dasbor) muncul jauh lebih cepat.
const pageLoaders = {
  Dashboard: () => import("./pages/Dashboard"),
  Patients: () => import("./pages/Patients"),
  Screening: () => import("./pages/Screening"),
  ClinicalReview: () => import("./pages/ClinicalReview"),
  Followup: () => import("./pages/Followup"),
  IncidentReporting: () => import("./pages/IncidentReporting"),
  IncidentList: () => import("./pages/IncidentList"),
  Analytics: () => import("./pages/Analytics"),
  BeforeAfter: () => import("./pages/BeforeAfter"),
  AuditTrail: () => import("./pages/AuditTrail"),
  Administration: () => import("./pages/Administration"),
  PatientHistory: () => import("./pages/PatientHistory"),
  SafetySignals: () => import("./pages/SafetySignals"),
};

const Dashboard = lazy(pageLoaders.Dashboard);
const Patients = lazy(pageLoaders.Patients);
const Screening = lazy(pageLoaders.Screening);
const ClinicalReview = lazy(pageLoaders.ClinicalReview);
const Followup = lazy(pageLoaders.Followup);
const IncidentReporting = lazy(pageLoaders.IncidentReporting);
const IncidentList = lazy(pageLoaders.IncidentList);
const Analytics = lazy(pageLoaders.Analytics);
const BeforeAfter = lazy(pageLoaders.BeforeAfter);
const AuditTrail = lazy(pageLoaders.AuditTrail);
const Administration = lazy(pageLoaders.Administration);
const PatientHistory = lazy(pageLoaders.PatientHistory);
const SafetySignals = lazy(pageLoaders.SafetySignals);

// Setelah layar pertama selesai tampil dan HP sedang santai, halaman lain
// diunduh diam-diam di latar belakang — supaya pindah menu tetap instan
// tanpa membuat pembukaan pertama jadi lambat.
function usePrefetchPages() {
  useEffect(() => {
    const run = () => {
      Object.values(pageLoaders).forEach((load) => {
        load().catch(() => {}); // gagal prefetch tidak masalah, nanti diunduh saat menu dibuka
      });
    };
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(run, { timeout: 5000 });
      return () => window.cancelIdleCallback && window.cancelIdleCallback(id);
    }
    const t = setTimeout(run, 3000);
    return () => clearTimeout(t);
  }, []);
}

function PageLoading() {
  return (
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(244,253,251,0.72)", fontSize: 15 }}>
      Memuat…
    </div>
  );
}

function withProtection(element) {
  return <ProtectedRoute>{element}</ProtectedRoute>;
}

export default function App() {
  usePrefetchPages();
  return (
    <AuthProvider>
      <BrowserRouter>
        <IdleWarningModal />
        <Suspense fallback={<PageLoading />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={withProtection(<Dashboard />)} />
            <Route path="/patients" element={withProtection(<Patients />)} />
            <Route path="/screening" element={withProtection(<Screening />)} />
            <Route path="/clinical-review" element={withProtection(<ClinicalReview />)} />
            <Route path="/followup" element={withProtection(<Followup />)} />
            <Route path="/incident" element={withProtection(<IncidentReporting />)} />
            <Route path="/incident-list" element={withProtection(<IncidentList />)} />
            <Route path="/analytics" element={withProtection(<Analytics />)} />
            <Route path="/before-after" element={withProtection(<BeforeAfter />)} />
            <Route path="/audit-trail" element={withProtection(<AuditTrail />)} />
            <Route path="/admin" element={withProtection(<Administration />)} />
            <Route path="/patient-history" element={withProtection(<PatientHistory />)} />
            <Route path="/safety-signals" element={withProtection(<SafetySignals />)} />
            {/* Rute /portal & /portal/login TIDAK lagi di sini — sudah
                ditangani halaman HTML terpisah (portal.html) lewat rewrite
                di vercel.json, supaya manifest PWA-nya tertanam statis. */}
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
