import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import { app } from "./firebaseApp"; // REVISI PERFORMA: tanpa Firestore, supaya Portal Pasien ringan
import { callApi } from "./api";

/**
 * GANTI dengan VAPID key (Web Push certificate) dari:
 * Firebase Console → Project Settings → Cloud Messaging → Web configuration
 * → Generate key pair. Tanpa ini, getToken() akan gagal.
 */
const VAPID_KEY = "BO99WmWzA9lCDgQQ-1Cvo5uVacAh06hx_m5RUSJQa14wbw99D1DwXSslbmJPmItL6i6pmAuMcIqoAsoVt8ar6eo";

// ==== REVISI (Sept 2026 - bug notif iPhone) ====
// Service worker notifikasi didaftarkan di SCOPE KHUSUS (bukan "/").
// Sebelumnya firebase-messaging-sw.js dan sw.js (cache offline PWA)
// sama-sama memakai scope "/" — satu scope hanya boleh punya SATU
// service worker, jadi yang satu menimpa yang lain. Kalau sw.js yang
// menang, push dari server diterima sw.js yang tidak punya kode
// notifikasi → di iPhone notifikasi tidak pernah muncul dan tidak bunyi.
// Scope ini adalah scope bawaan resmi Firebase Cloud Messaging.
const FCM_SW_SCOPE = "/firebase-cloud-messaging-push-scope";
const TOKEN_CACHE_KEY = "ncdPortalPushToken";

async function getFcmRegistration() {
  return navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: FCM_SW_SCOPE });
}

async function fetchAndSaveToken(patientId, { force } = {}) {
  const registration = await getFcmRegistration();
  const messaging = getMessaging(app);
  const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
  if (!token) return { ok: false, reason: "Gagal mendapatkan token notifikasi." };

  // Kirim ke server hanya kalau token baru/berubah (hemat panggilan API),
  // atau kalau dipaksa (tombol "Aktifkan Notifikasi" ditekan manual).
  const cached = localStorage.getItem(TOKEN_CACHE_KEY);
  if (force || cached !== `${patientId}:${token}`) {
    await callApi("patientPortal", { action: "registerPushToken", patientId, token });
    localStorage.setItem(TOKEN_CACHE_KEY, `${patientId}:${token}`);
  }
  return { ok: true };
}

/**
 * requestAndRegisterPush — minta izin notifikasi browser, ambil token FCM,
 * lalu simpan ke backend (patients/{patientId}.pushToken) supaya bisa
 * dipakai kirim alert/pengingat. Aman dipanggil berkali-kali (idempotent).
 * WAJIB dipanggil dari tombol yang ditekan pasien (aturan iPhone).
 *
 * Return: { ok: true } | { ok: false, reason: string }
 */
export async function requestAndRegisterPush(patientId) {
  try {
    const supported = await isSupported();
    if (!supported) {
      return { ok: false, reason: "HP/browser ini belum mendukung notifikasi. Di iPhone, buka aplikasi dari ikon di Layar Utama (bukan dari Safari)." };
    }

    if (VAPID_KEY.startsWith("GANTI_DENGAN")) {
      return { ok: false, reason: "VAPID key belum diisi (lihat src/lib/push.js)." };
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { ok: false, reason: "Izin notifikasi ditolak. Aktifkan lewat Pengaturan HP → Notifikasi → My NCD Safety." };
    }

    return await fetchAndSaveToken(patientId, { force: true });
  } catch (err) {
    return { ok: false, reason: err.message || "Gagal mengaktifkan notifikasi." };
  }
}

/**
 * BARU: refreshPushTokenSilently — dipanggil otomatis setiap Portal dibuka.
 * Tidak memunculkan pertanyaan izin apa pun (hanya jalan kalau izin SUDAH
 * diberikan). Gunanya: token lama yang mati (PWA dipasang ulang, iOS
 * update, dll.) otomatis diganti token baru tanpa pasien menekan apa-apa.
 */
export async function refreshPushTokenSilently(patientId) {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return { ok: false };
    if (!(await isSupported())) return { ok: false };
    return await fetchAndSaveToken(patientId);
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

/**
 * BARU: listenForegroundMessages — saat Portal SEDANG DIBUKA, push dari
 * server tidak otomatis muncul sebagai notifikasi HP (aturan Firebase).
 * Fungsi ini menangkapnya: tampilkan notifikasi HP + panggil onReceive
 * supaya lonceng/pop-up di dalam aplikasi langsung ter-update.
 * Return: fungsi untuk berhenti mendengarkan.
 */
export async function listenForegroundMessages(onReceive) {
  try {
    if (!(await isSupported())) return () => {};
    const messaging = getMessaging(app);
    return onMessage(messaging, async (payload) => {
      const n = payload.notification || {};
      const d = payload.data || {};
      const title = n.title || d.title || "My NCD Safety";
      const body = n.body || d.body || "";
      try {
        if (Notification.permission === "granted") {
          const reg = await navigator.serviceWorker.getRegistration(FCM_SW_SCOPE);
          if (reg) await reg.showNotification(title, { body, icon: "/logos/app-logo.png", badge: "/logos/app-logo.png", data: { url: "/portal?notif=1" } });
        }
      } catch {
        // tidak fatal — pop-up di dalam aplikasi tetap muncul
      }
      onReceive && onReceive({ title, body, data: d });
    });
  } catch {
    return () => {};
  }
}
