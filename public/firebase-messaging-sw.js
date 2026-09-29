/**
 * firebase-messaging-sw.js — service worker KHUSUS untuk terima push
 * notification di background (dipakai firebase/messaging). Harus file
 * terpisah dari sw.js (offline cache) & harus persis nama ini di root
 * domain, sesuai ketentuan Firebase Cloud Messaging.
 *
 * Dipakai importScripts (bukan ES module) karena ini persyaratan resmi
 * Firebase untuk service worker messaging.
 *
 * REVISI (Sept 2026 - bug notif iPhone):
 * 1. Notifikasi yang payload-nya punya "notification" (semua kiriman dari
 *    lib/push.js backend) SUDAH ditampilkan otomatis oleh Firebase SDK.
 *    Dulu file ini menampilkannya LAGI → di Android notif bisa dobel.
 *    Sekarang showNotification manual hanya untuk pesan data-only.
 * 2. Klik notifikasi: notifikasi buatan Firebase SDK (ditandai FCM_MSG)
 *    sudah dibuka otomatis oleh SDK ke fcmOptions.link — handler di bawah
 *    hanya menangani notifikasi buatan file ini, supaya tidak buka 2 tab.
 *    Kalau aplikasi sudah terbuka, jendela yang ada difokuskan (bukan
 *    buka jendela baru).
 */
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

// Nilai sama persis dengan src/lib/firebase.js — aman dipublikasikan
// (bukan rahasia, dilindungi oleh Firestore Security Rules + RBAC backend).
firebase.initializeApp({
  apiKey: "AIzaSyDjO6jilIV1lTAjGxPHqCvUECWVVqva4_A",
  authDomain: "patient-safety-847fe.firebaseapp.com",
  projectId: "patient-safety-847fe",
  storageBucket: "patient-safety-847fe.firebasestorage.app",
  messagingSenderId: "133894571393",
  appId: "1:133894571393:web:7a3f1fece7ed7a7b061480",
});

const messaging = firebase.messaging();

// Tujuan link TIDAK di-hardcode (pernah jadi bug: notif staff membuka
// Portal Pasien). Diambil dari fcmOptions.link / data.link per notifikasi.
messaging.onBackgroundMessage((payload) => {
  if (payload.notification) return; // sudah ditampilkan otomatis oleh Firebase SDK
  const d = payload.data || {};
  const link = (payload.fcmOptions && payload.fcmOptions.link) || d.link || "/";
  return self.registration.showNotification(d.title || "My NCD Safety", {
    body: d.body || "",
    icon: "/logos/app-logo.png",
    badge: "/logos/app-logo.png",
    data: { url: link },
  });
});

self.addEventListener("notificationclick", (event) => {
  const nd = event.notification.data || {};
  if (nd.FCM_MSG) return; // notifikasi buatan Firebase SDK → SDK yang membuka link
  event.notification.close();
  const url = nd.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const target = new URL(url, self.location.origin);
      for (const c of list) {
        const cu = new URL(c.url);
        if (cu.pathname === target.pathname && "focus" in c) {
          if ("navigate" in c) c.navigate(target.href).catch(() => {});
          return c.focus();
        }
      }
      return clients.openWindow(target.href);
    })
  );
});
