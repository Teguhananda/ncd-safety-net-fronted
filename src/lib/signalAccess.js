/**
 * signalAccess.js — BARU (1 Okt 2026). Siapa boleh MELIHAT & MENUTUP
 * Home Safety Signal. HARUS SAMA dengan konstanta di backend
 * api/safetyPlan.js (backend tetap penentu akhir).
 *
 * - SOS (tombol Emergency pasien): hanya Admin (Komite PMKP), UGD, Ambulans.
 *   Yang boleh MENUTUP (Closed) SOS: hanya Ambulans.
 * - Sinyal lain (TTV/gejala/kepatuhan, tindak lanjut 24 jam): petugas,
 *   dokter, PMKP, case manager, admin — seperti sebelumnya.
 */
import { SOS_ENABLED } from "./features";

export const SOS_SIGNAL_TYPE = "patient_emergency_button";
export const SOS_VIEW_ROLES = ["admin", "ugd", "ambulance_rsud", "ambulance_psc119"];
// 20 Okt 2026: selama SOS ditunda, Admin (Komite PMKP) juga boleh menutup SOS lama.
export const SOS_CLOSE_ROLES = SOS_ENABLED
  ? ["ambulance_rsud", "ambulance_psc119"]
  : ["ambulance_rsud", "ambulance_psc119", "admin"];
export const OTHER_VIEW_ROLES = ["petugas", "dokter", "admin", "manajemen", "case_manager"];
export const OTHER_CLOSE_ROLES = ["dokter", "admin", "case_manager", "manajemen"];

export function isSosSignal(s) {
  return !!s && s.signalType === SOS_SIGNAL_TYPE;
}
export function canSeeSignal(role, s) {
  return (isSosSignal(s) ? SOS_VIEW_ROLES : OTHER_VIEW_ROLES).includes(role);
}
export function canCloseSignal(role, s) {
  return (isSosSignal(s) ? SOS_CLOSE_ROLES : OTHER_CLOSE_ROLES).includes(role);
}
