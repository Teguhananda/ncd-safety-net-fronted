import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { app } from "./firebase";
import { callApi } from "./api";

/**
 * GANTI dengan VAPID key (Web Push certificate) dari:
 * Firebase Console → Project Settings → Cloud Messaging → Web configuration
 * → Generate key pair. Tanpa ini, getToken() akan gagal.
 */
const VAPID_KEY = "GANTI_DENGAN_VAPID_KEY_DARI_FIREBASE_CONSOLE";

/**
 * requestAndRegisterPush — minta izin notifikasi browser, ambil token FCM,
 * lalu simpan ke backend (patients/{patientId}.pushToken) supaya bisa
 * dipakai kirim alert/pengingat. Aman dipanggil berkali-kali (idempotent).
 *
 * Return: { ok: true } | { ok: false, reason: string }
 */
export async function requestAndRegisterPush(patientId) {
  try {
    const supported = await isSupported();
    if (!supported) return { ok: false, reason: "Browser ini tidak mendukung notifikasi push." };

    if (VAPID_KEY.startsWith("GANTI_DENGAN")) {
      return { ok: false, reason: "VAPID key belum diisi (lihat src/lib/push.js)." };
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { ok: false, reason: "Izin notifikasi ditolak. Bisa diaktifkan lagi lewat pengaturan browser." };
    }

    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });

    if (!token) return { ok: false, reason: "Gagal mendapatkan token notifikasi." };

    await callApi("patientPortal", { action: "registerPushToken", patientId, token });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message || "Gagal mengaktifkan notifikasi." };
  }
}
