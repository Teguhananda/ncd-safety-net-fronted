import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

/**
 * GANTI nilai di bawah ini dengan konfigurasi project Firebase Bapak.
 * Ambil dari: Firebase Console → Project Settings → General → Your apps → Web app.
 * Nilai ini AMAN untuk ditaruh di kode frontend (bukan rahasia) — keamanan
 * sesungguhnya dijaga oleh Firestore Security Rules + RBAC di backend API.
 *
 * CATATAN: getFunctions (Firebase Cloud Functions) TIDAK dipakai lagi di
 * sini — backend sekarang dihosting di Vercel (lihat src/lib/api.js) karena
 * Cloud Functions mewajibkan plan Blaze. Firestore & Auth tetap Firebase.
 */
const firebaseConfig = {
  apiKey: "AIzaSyDjO6jilIV1lTAjGxPHqCvUECWVVqva4_A",
  authDomain: "patient-safety-847fe.firebaseapp.com",
  projectId: "patient-safety-847fe",
  storageBucket: "patient-safety-847fe.firebasestorage.app",
  messagingSenderId: "133894571393",
  appId: "1:133894571393:web:7a3f1fece7ed7a7b061480",
  measurementId: "G-RW95DT5EP5"
};
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
