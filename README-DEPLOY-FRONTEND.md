## ⚠️ PERUBAHAN ARSITEKTUR — Backend Pindah ke Vercel

Karena Firebase Cloud Functions mewajibkan kartu kredit/debit (plan Blaze)
bahkan untuk fungsi paling sederhana, backend sekarang dihosting di
**Vercel** (gratis, tanpa kartu apapun) — lihat folder
`ncd-safety-net-api` yang terpisah dari folder frontend ini.

**Yang perlu diisi di `src/lib/api.js` sebelum aplikasi berfungsi:**
```js
const API_BASE_URL = "GANTI_DENGAN_URL_VERCEL_ANDA";
```
Ganti dengan URL project Vercel Bapak setelah deploy backend API (lihat
`ncd-safety-net-api/README-DEPLOY-API.md`).

Firestore & Firebase Auth tetap dipakai seperti biasa (`src/lib/firebase.js`
masih perlu diisi konfigurasi Firebase seperti sebelumnya) — hanya bagian
Cloud Functions yang pindah rumah ke Vercel.

---

# Panduan Deploy Frontend — NCD Safety Net (Fase 8)

Frontend ini adalah aplikasi React (Vite) yang terhubung langsung ke Firebase
(Auth, Firestore, Cloud Functions). Fase 8 sekarang **lengkap** — seluruh 16
halaman dari wireframe Fase 5 sudah ada kecuali Scan QR (digantikan input
manual No.RM sementara; kamera QR bisa ditambahkan di Fase 9/10 sebagai
penyempurnaan) dan Audit Trail (direncanakan di Fase 10 bersama security
hardening):

- Login
- Dashboard
- Daftar Pasien
- NCD Screening (alur menyatu: red flag → medication reconciliation → risk
  score → edukasi → safety plan/follow-up, sesuai status risiko)
- Clinical Review (khusus dokter)
- Follow-up
- Incident Reporting
- Analytics PMKP
- Before–After Dashboard (baca `config/before_baseline` vs `analytics_summary`)
- Administration (khusus admin: risk threshold, kebijakan follow-up, before
  baseline)

Backend Fase 7 juga sudah ditambah fungsi baru untuk mendukung halaman ini:
`submitEducation`, `submitSafetyIncident`, `updateRiskThresholds`,
`updateEducationTemplate`, `updateFollowupPolicy`, `setBeforeBaseline` —
pastikan Bapak deploy ulang backend (`firebase deploy --only functions`)
sebelum mencoba halaman-halaman baru ini.

## Langkah Persiapan

1. **Isi konfigurasi Firebase** — buka `src/lib/firebase.js` di TextEdit,
   ganti semua nilai `"GANTI_DENGAN_..."` dengan konfigurasi asli dari:
   Firebase Console → Project Settings → General → scroll ke "Your apps" →
   pilih/​buat Web app → salin objek `firebaseConfig`.

2. **Cek region Cloud Functions** — di file yang sama, baris:
   ```
   export const functions = getFunctions(app, "asia-southeast2");
   ```
   Samakan dengan region tempat Bapak deploy functions di Fase 7 (default
   Firebase Functions v2 biasanya `us-central1` kecuali diatur lain saat deploy).

## Langkah Menjalankan di Lokal (uji coba dulu sebelum deploy)

```
cd path/ke/ncd-safety-net-frontend
npm install
npm run dev
```
Buka alamat yang muncul di Terminal (biasanya `http://localhost:5173`) di browser.

## Langkah Deploy ke Firebase Hosting

1. Pastikan folder ini **satu level** dengan folder backend dari Fase 7, atau
   gabungkan `firebase.json` keduanya (folder `public` di `firebase.json`
   backend perlu diarahkan ke folder `dist` hasil build frontend ini).

   Cara termudah: salin isi `dist/` (hasil build) ke folder `public/` di
   project backend Fase 7, ATAU ubah `firebase.json` backend menjadi:
   ```json
   "hosting": {
     "public": "../ncd-safety-net-frontend/dist",
     ...
   }
   ```

2. Build frontend:
   ```
   npm run build
   ```
   Ini menghasilkan folder `dist/` — inilah yang di-hosting.

3. Deploy (dari folder yang berisi `firebase.json`, yaitu folder backend):
   ```
   firebase deploy --only hosting
   ```

## Menguji Alur End-to-End

1. Buat user lewat Firebase Console → Authentication → Add user.
2. Set custom claim role-nya (lihat README-DEPLOY.md di folder backend,
   bagian "Menetapkan Role User").
3. Login di aplikasi dengan user tsb.
4. Buat 1 dokumen dummy di `patients` (lewat Firestore Console) supaya bisa
   dicoba di halaman Daftar Pasien → Screening.
5. Isi `config/risk_thresholds` (lihat README backend) supaya perhitungan
   skor tidak memakai nilai default fallback.

## Catatan

- Semua perhitungan risiko tetap terjadi di **server** (Cloud Functions) —
  frontend hanya menampilkan hasil, sesuai prinsip keamanan Fase 2.
- Halaman Screening saat ini membuat `visitId` sederhana dari
  `patientId + tanggal` sebagai contoh kerja; kalau Bapak nanti punya alur
  kunjungan (visit) yang lebih formal dari sisi pendaftaran pasien, bagian
  ini perlu disesuaikan.

## Fase 9 — Dashboard PMKP (update)

Halaman **Analytics PMKP** sekarang menjadi dashboard mutu lengkap sesuai
Fase 1 §11: filter periode (7/14/30 hari), rata-rata completion rate,
distribusi risiko snapshot terbaru, dua grafik tren (total screening vs
lost-to-follow-up, dan tren completion rate), serta tabel rincian harian.
Halaman **Dashboard** utama juga menampilkan mini grafik tren 7 hari.

Chart memakai library **recharts** — jalankan `npm install` ulang setelah
menarik file zip ini supaya dependency baru ikut terpasang.
