import { auth } from "./firebase";

/**
 * GANTI dengan URL dasar project Vercel Bapak setelah deploy backend API
 * (lihat ncd-safety-net-api/README-DEPLOY-API.md langkah 5).
 * Contoh: "https://ncd-safety-net-api-xxxxx.vercel.app"
 */
const API_BASE_URL = "https://ncd-safety-net-api.vercel.app";

/**
 * callApi — pengganti httpsCallable(functions, name) dari Firebase Cloud
 * Functions. Melakukan hal yang sama: kirim Firebase ID token pengguna
 * yang sedang login, backend (Vercel) yang verifikasi & cek role.
 *
 * Dipakai persis seperti httpsCallable sebelumnya:
 *   const res = await callApi("screening", { visitId, patientId });
 *   res.data.status  <- sama strukturnya dengan sebelumnya
 */
export async function callApi(endpoint, data = {}) {
  const user = auth.currentUser;
  if (!user) {
    throw new ApiCallError("unauthenticated", "Anda harus login terlebih dahulu.");
  }
  const token = await user.getIdToken();

  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
  } catch (networkErr) {
    throw new ApiCallError("network-error", "Tidak bisa menghubungi server. Cek koneksi internet.");
  }

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    const code = json?.error?.code || "internal";
    const message = json?.error?.message || "Terjadi kesalahan.";
    throw new ApiCallError(code, message);
  }

  // Bungkus supaya kompatibel dengan pola `res.data.xxx` yang sudah dipakai
  // di semua halaman (sama seperti hasil httpsCallable sebelumnya).
  return { data: json };
}

/**
 * ApiCallError — dibuat supaya kode di halaman (Screening.jsx, dst.) yang
 * sudah menulis `e.code === "functions/failed-precondition"` dkk tetap
 * jalan tanpa perlu diubah — kita samakan format code-nya.
 */
export class ApiCallError extends Error {
  constructor(code, message) {
    super(message);
    this.code = `functions/${code}`;
  }
}
