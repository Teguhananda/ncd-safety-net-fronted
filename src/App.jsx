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
import Analytics from "./pages/Analytics";
import BeforeAfter from "./pages/BeforeAfter";
import AuditTrail from "./pages/AuditTrail";
import Administration from "./pages/Administration";
import PatientHistory from "./pages/PatientHistory";

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
          <Route path="/analytics" element={withProtection(<Analytics />)} />
          <Route path="/before-after" element={withProtection(<BeforeAfter />)} />
          <Route path="/audit-trail" element={withProtection(<AuditTrail />)} />
          <Route path="/admin" element={withProtection(<Administration />)} />
          <Route path="/patient-history" element={withProtection(<PatientHistory />)} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
