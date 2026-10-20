import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import { callApi } from "../lib/api";

// BARU (Okt 2026): tombol "Tanya Dokter" di bagian atas setiap halaman staff,
// dengan angka jumlah pertanyaan pasien yang belum dijawab. Hanya muncul
// untuk Dokter, Perawat, Admin, dan Case Manager (peran lain otomatis
// ditolak server → tombol disembunyikan). Dicek ulang tiap 2 menit.
function TanyaDokterButton() {
  const [count, setCount] = useState(null);
  const location = useLocation();

  useEffect(() => {
    let stopped = false;
    const load = () =>
      callApi("patientHistory", { action: "listDoctorQuestions", days: 7 })
        .then((res) => { if (!stopped) setCount(res.data.openCount || 0); })
        .catch(() => { if (!stopped) setCount(null); });
    load();
    const t = setInterval(load, 120000);
    return () => { stopped = true; clearInterval(t); };
  }, [location.pathname]);

  if (count === null || location.pathname === "/tanya-dokter") return null;
  return (
    <Link to="/tanya-dokter" className="btn btn-ghost" style={{ position: "relative", whiteSpace: "nowrap" }}>
      💬 Tanyo Dokter
      {count > 0 && (
        <span
          style={{
            marginLeft: 6, background: "#c0392b", color: "#fff", borderRadius: 999,
            padding: "1px 7px", fontSize: 12, fontWeight: 700,
          }}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

export default function Layout({ title, meta, children }) {
  return (
    <div className="app">
      <Sidebar pageTitle={title} pageMeta={meta} />
      <div className="main">
        {/* REVISI (20 Okt 2026): identitas aplikasi (logo + BERENDO SEHAT 3D +
            tagline) di tengah spanduk; judul halaman pindah ke pojok kiri atas
            (Sidebar). Di HP judul halaman tetap tampil di bawah spanduk. */}
        <div className="topbar topbar-brand">
          <div className="topbar-side" aria-hidden="true"></div>
          <div className="hero-brand">
            <img src="/logos/app-logo.png" alt="" className="hero-logo" />
            <div className="hero-text">
              <div className="hero-title">BERENDO SEHAT</div>
              <div className="hero-sub">RSUD KABUPATEN REJANG LEBONG</div>
              <div className="hero-tagline">"Dari Berendo Rumah, RS Tetap Menjago"</div>
            </div>
          </div>
          <div className="topbar-side topbar-actions">
            <TanyaDokterButton />
          </div>
        </div>
        <div className="page-heading-mobile">
          <h1>{title}</h1>
          <div className="meta">{meta}</div>
        </div>
        <div className="net-divider"></div>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
