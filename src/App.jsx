import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import IdleWarningModal from "./components/IdleWarningModal";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Patients from "./pages/Patients";
import Screening from "./pages/Screening";
import ClinicalReview from "./pages/ClinicalReview";
import Followup from "./pages/Followup";
import IncidentReporting from "./pages/IncidentReporting";
import IncidentList from "./pages/IncidentList";
import Analytics from "./pages/Analytics";
import BeforeAfter from "./pages/BeforeAfter";
import AuditTrail from "./pages/AuditTrail";
import Administration from "./pages/Administration";
import PatientHistory from "./pages/PatientHistory";
import SafetySignals from "./pages/SafetySignals";
import PortalLogin from "./pages/portal/PortalLogin";
import PortalHome from "./pages/portal/PortalHome";
import PatientProtectedRoute from "./components/PatientProtectedRoute";

function withProtection(element) {
  return <ProtectedRoute>{element}</ProtectedRoute>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <IdleWarningModal />
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

          {/* Portal Pasien "My NCD Safety" — auth & proteksi TERPISAH dari staff */}
          <Route path="/portal/login" element={<PortalLogin />} />
          <Route path="/portal" element={<PatientProtectedRoute><PortalHome /></PatientProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
