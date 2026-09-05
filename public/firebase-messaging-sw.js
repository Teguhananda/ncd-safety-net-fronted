/**
 * firebase-messaging-sw.js — service worker KHUSUS untuk terima push
 * notification di background (dipakai firebase/messaging). Harus file
 * terpisah dari sw.js (offline cache) & harus persis nama ini di root
 * domain, sesuai ketentuan Firebase Cloud Messaging.
 *
 * Dipakai importScripts (bukan ES module) karena ini persyaratan resmi
 * Firebase untuk service worker messaging.
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

// BAGIAN YANG DIPERBAIKI: sebelumnya tujuan klik notifikasi di-hardcode
// ke "/portal" untuk SEMUA notifikasi (pasien maupun staff) — akibatnya
// notifikasi dokter/Case Manager ikut membuka Portal Pasien (scan QR),
// bukan halaman Home Safety Signals yang seharusnya. Sekarang tujuan
// link diambil dari `fcmOptions.link` yang sudah dikirim per notifikasi
// (lihat lib/push.js: sendPushToPatient pakai "/portal", sendPushToRole
// pakai "/safety-signals") — disimpan di data notifikasi, lalu dibaca
// lagi saat diklik.
messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  const link = (payload.fcmOptions && payload.fcmOptions.link) || (payload.data && payload.data.link) || "/";
  self.registration.showNotification(title || "My NCD Safety", {
    body: body || "",
    icon: "/logos/app-logo.png",
    badge: "/logos/app-logo.png",
    data: { url: link },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(clients.openWindow(url));
});
