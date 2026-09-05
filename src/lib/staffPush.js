import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { app } from "./firebase";
import { callApi } from "./api";

/**
 * PENTING: isi dengan VAPID KEY YANG SAMA PERSIS dengan yang sudah Bapak
 * isi di ncd-safety-net-frontend/src/lib/push.js (punya Portal Pasien) —
 * satu project Firebase cukup 1 VAPID key, dipakai bersama.
 */
const VAPID_KEY = "BO99WmWzA9lCDgQQ-1Cvo5uVacAh06hx_m5RUSJQa14wbw99D1DwXSslbmJPmItL6i6pmAuMcIqoAsoVt8ar6eo";

/**
 * requestAndRegisterStaffPush — versi staff dari requestAndRegisterPush
 * (Portal Pasien). Dipanggil dari tombol "Aktifkan Notifikasi" khusus
 * role dokter, supaya dapat push real-time saat ada Home Safety Signal
 * ACTION_NEEDED/URGENT dari pasien.
 */
export async function requestAndRegisterStaffPush() {
  try {
    const supported = await isSupported();
    if (!supported) return { ok: false, reason: "Browser ini tidak mendukung notifikasi push." };

    if (VAPID_KEY.startsWith("GANTI_DENGAN")) {
      return { ok: false, reason: "VAPID key belum diisi (lihat src/lib/staffPush.js)." };
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { ok: false, reason: "Izin notifikasi ditolak. Bisa diaktifkan lagi lewat pengaturan browser." };
    }

    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });

    if (!token) return { ok: false, reason: "Gagal mendapatkan token notifikasi." };

    await callApi("safetyPlan", { action: "registerStaffPushToken", token });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message || "Gagal mengaktifkan notifikasi." };
  }
}
