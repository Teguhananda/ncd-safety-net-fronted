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

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  self.registration.showNotification(title || "My NCD Safety", {
    body: body || "",
    icon: "/logos/app-logo.png",
    badge: "/logos/app-logo.png",
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/portal"));
});
