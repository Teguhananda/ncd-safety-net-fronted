import { getFirestore } from "firebase/firestore";
import { app, auth } from "./firebaseApp";

/**
 * REVISI PERFORMA (Sept 2026): konfigurasi Firebase (apiKey dst.) sekarang
 * ada di src/lib/firebaseApp.js — kalau perlu mengganti konfigurasi, ubah
 * di file itu. File ini menambahkan Firestore (db) untuk aplikasi staff,
 * dan tetap mengekspor app & auth yang SAMA supaya semua halaman lama yang
 * menulis `import { db, auth } from "../lib/firebase"` tetap jalan tanpa
 * diubah.
 */
export { app, auth };
export const db = getFirestore(app);
