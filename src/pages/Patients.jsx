import { useEffect, useRef, useState } from "react";
import { collection, getDocs, orderBy, query, limit, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import Layout from "../components/Layout";
import RiskBadge from "../components/RiskBadge";
import QRScanner from "../components/QRScanner";
import PatientQRModal from "../components/PatientQRModal";
import { Link, useNavigate } from "react-router-dom";
import { callApi } from "../lib/api";

const NCD_OPTIONS = ["Hipertensi", "Diabetes Mellitus", "Dislipidemia", "Obesitas", "Penyakit Jantung", "Stroke", "CKD", "Lainnya"];

export default function Patients() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [adding, setAdding] = useState(false);
  const [qrPatient, setQrPatient] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [usbScanNotFound, setUsbScanNotFound] = useState("");
  const navigate = useNavigate();
  const searchInputRef = useRef(null);

  const [form, setForm] = useState({
    mrn: "", name: "", dob: "", gender: "Laki-laki", conditions: [],
  });

  const toggleCondition = (c) => {
    setForm((f) => ({
      ...f,
      conditions: f.conditions.includes(c)
        ? f.conditions.filter((x) => x !== c)
        : [...f.conditions, c],
    }));
  };

  const handleDetected = (rawValue) => {
    setScanning(false);
    const clean = (rawValue || "").trim();
    const match = rows.find((r) => r.id === clean || r.mrn === clean);
    if (match) {
      navigate(`/screening?patientId=${match.id}`);
    } else {
      setUsbScanNotFound(clean);
    }
  };

  // Dukungan USB barcode scanner: alat mengetik kode ke kolom yang sedang fokus
  // lalu otomatis menekan Enter. Kita jaga kolom pencarian selalu fokus (kecuali
  // saat panel Tambah Pasien / Scan Kamera sedang terbuka), lalu tangkap Enter-nya.
  useEffect(() => {
    if (!adding && !scanning) {
      searchInputRef.current?.focus();
    }
  }, [adding, scanning]);

  const handleSearchKeyDown = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const val = search.trim();
    if (!val) return;
    setUsbScanNotFound("");
    handleDetected(val);
  };

  async function loadPatients() {
    setLoading(true);
    setLoadError("");
    try {
      const [patientsSnap, assessmentsSnap] = await Promise.all([
        getDocs(query(collection(db, "patients"), limit(100))),
        getDocs(query(collection(db, "risk_assessments"), orderBy("createdAt", "desc"), limit(200))),
      ]);

      const latestByPatient = {};
      assessmentsSnap.docs.forEach((d) => {
        const data = d.data();
        if (!latestByPatient[data.patientId]) latestByPatient[data.patientId] = data;
      });

      const merged = patientsSnap.docs.map((d) => {
        const p = { id: d.id, ...d.data() };
        const risk = latestByPatient[d.id];
        return { ...p, riskStatus: risk ? risk.riskStatus : null };
      });
      setRows(merged);
    } catch (err) {
      console.error(err);
      setLoadError("Gagal memuat data pasien: " + (err.message || "terjadi kesalahan."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPatients();
  }, []);

  const handleAddPatient = async (e) => {
    e.preventDefault();
    if (!form.mrn || !form.name) {
      setSaveError("No. RM dan Nama wajib diisi.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      await addDoc(collection(db, "patients"), {
        mrn: form.mrn,
        name: form.name,
        dob: form.dob || null,
        gender: form.gender,
        conditions: form.conditions,
        createdAt: serverTimestamp(),
      });
      setForm({ mrn: "", name: "", dob: "", gender: "Laki-laki", conditions: [] });
      setAdding(false);
      await loadPatients();
    } catch (err) {
      console.error(err);
      setSaveError("Gagal menyimpan pasien: " + (err.message || "terjadi kesalahan."));
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePatient = async (patient) => {
    const konfirmasi1 = window.confirm(
      `Yakin hapus PERMANEN data pasien "${patient.name}" (No. RM: ${patient.mrn})? Semua riwayat skrining, obat, dan follow-up ikut terhapus.`
    );
    if (!konfirmasi1) return;
    const konfirmasi2 = window.confirm("Ini tidak bisa dibatalkan. Benar-benar hapus permanen?");
    if (!konfirmasi2) return;

    setDeletingId(patient.id);
    setDeleteError("");
    try {
      await callApi("adminConfig", { action: "deletePatient", patientId: patient.id });
      await loadPatients();
    } catch (err) {
      console.error(err);
      setDeleteError("Gagal menghapus: " + (err.message || "terjadi kesalahan."));
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = rows.filter(
    (r) =>
      !search ||
      (r.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (r.mrn || "").includes(search)
  );

  return (
    <Layout title="Daftar Pasien" meta="Seluruh pasien yang sudah discan/discreen">
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, gap: 8, flexWrap: "wrap" }}>
          <input
            ref={searchInputRef}
            placeholder="Cari nama / No. RM — atau scan barcode di sini"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setUsbScanNotFound(""); }}
            onKeyDown={handleSearchKeyDown}
            style={{ padding: "8px 12px", border: "1px solid var(--line)", borderRadius: 8, fontSize: 13, width: 300 }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" onClick={() => setAdding(true)}>
              + Tambah Pasien
            </button>
            <button className="btn btn-primary" onClick={() => setScanning(true)}>
              + Scan QR (Kamera)
            </button>
          </div>
        </div>
        <div className="stat-sub" style={{ marginBottom: 12 }}>
          💡 Tip: klik sekali di kolom pencarian, lalu scan barcode/QR pasien dengan alat USB scanner — sistem akan otomatis membuka halaman Skrining pasien tersebut.
        </div>

        {usbScanNotFound && (
          <div className="error-text" style={{ marginBottom: 10 }}>
            Kode "{usbScanNotFound}" tidak cocok dengan No. RM pasien manapun. Pastikan pasien sudah terdaftar di Daftar Pasien.
          </div>
        )}

        {adding && (
          <div className="card" style={{ marginBottom: 14, background: "var(--surface-2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <h3>Tambah Pasien Baru</h3>
              <button className="btn btn-ghost" onClick={() => setAdding(false)}>Tutup</button>
            </div>
            <form onSubmit={handleAddPatient}>
              <div className="field">
                <label>No. Rekam Medis</label>
                <input value={form.mrn} onChange={(e) => setForm({ ...form, mrn: e.target.value })} required />
              </div>
              <div className="field">
                <label>Nama Pasien</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="field">
                <label>Tanggal Lahir</label>
                <input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
              </div>
              <div className="field">
                <label>Jenis Kelamin</label>
                <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                  <option>Laki-laki</option>
                  <option>Perempuan</option>
                </select>
              </div>
              <div className="field">
                <label>Kondisi NCD</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {NCD_OPTIONS.map((c) => (
                    <label key={c} style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
                      <input
                        type="checkbox"
                        checked={form.conditions.includes(c)}
                        onChange={() => toggleCondition(c)}
                      />
                      {c}
                    </label>
                  ))}
                </div>
              </div>
              {saveError && <div className="error-text">{saveError}</div>}
              <button className="btn btn-primary" style={{ width: "100%", marginTop: 8 }} disabled={saving}>
                {saving ? "Menyimpan..." : "Simpan Pasien"}
              </button>
            </form>
          </div>
        )}

        {scanning && (
          <div className="card" style={{ marginBottom: 14, background: "var(--surface-2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <h3>Scan QR Pasien (Kamera)</h3>
              <button className="btn btn-ghost" onClick={() => setScanning(false)}>Tutup</button>
            </div>
            <QRScanner onDetected={handleDetected} />
          </div>
        )}

        {deleteError && <div className="error-text" style={{ marginBottom: 10 }}>{deleteError}</div>}
        {loading ? (
          <div className="stat-sub">Memuat data pasien...</div>
        ) : loadError ? (
          <div className="error-text">{loadError}</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nama</th>
                <th>No. RM</th>
                <th>Risk Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className={p.riskStatus === "RED_FLAG" ? "row-redflag" : ""}>
                  <td>{p.name}</td>
                  <td className="mono">{p.mrn}</td>
                  <td>{p.riskStatus ? <RiskBadge status={p.riskStatus} /> : <span className="stat-sub">Belum discreen</span>}</td>
                  <td style={{ display: "flex", gap: 6 }}>
                    <Link className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }} to={`/screening?patientId=${p.id}`}>
                      Screening
                    </Link>
                    <Link className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }} to={`/patient-history?patientId=${p.id}`}>
                      Riwayat
                    </Link>
                    <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => setQrPatient(p)}>
                      QR
                    </button>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: "4px 10px", fontSize: 12, color: "#c0392b" }}
                      onClick={() => handleDeletePatient(p)}
                      disabled={deletingId === p.id}
                    >
                      {deletingId === p.id ? "Menghapus..." : "🗑️ Hapus"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {qrPatient && <PatientQRModal patient={qrPatient} onClose={() => setQrPatient(null)} />}
    </Layout>
  );
}
