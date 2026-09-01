import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query, limit } from "firebase/firestore";
import { db } from "../lib/firebase";
import Layout from "../components/Layout";
import RiskBadge from "../components/RiskBadge";
import QRScanner from "../components/QRScanner";
import { Link, useNavigate } from "react-router-dom";

export default function Patients() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const navigate = useNavigate();

  const handleDetected = (rawValue) => {
    setScanning(false);
    // Asumsi QR pasien berisi patientId (ID dokumen Firestore) langsung,
    // atau bisa berupa No. RM — sesuaikan dengan format QR yang RS pakai
    // saat mencetak label pasien.
    const match = rows.find((r) => r.id === rawValue || r.mrn === rawValue);
    if (match) {
      navigate(`/screening?patientId=${match.id}`);
    } else {
      navigate(`/screening?patientId=${encodeURIComponent(rawValue)}`);
    }
  };

  useEffect(() => {
    async function load() {
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
      setLoading(false);
    }
    load();
  }, []);

  const filtered = rows.filter(
    (r) =>
      !search ||
      (r.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (r.mrn || "").includes(search)
  );

  return (
    <Layout title="Daftar Pasien" meta="Seluruh pasien yang sudah discan/discreen">
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <input
            placeholder="Cari nama / No. RM"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: "8px 12px", border: "1px solid var(--line)", borderRadius: 8, fontSize: 13, width: 260 }}
          />
          <button className="btn btn-primary" onClick={() => setScanning(true)}>
            + Scan QR
          </button>
        </div>

        {scanning && (
          <div className="card" style={{ marginBottom: 14, background: "var(--surface-2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <h3>Scan QR Pasien</h3>
              <button className="btn btn-ghost" onClick={() => setScanning(false)}>Tutup</button>
            </div>
            <QRScanner onDetected={handleDetected} />
          </div>
        )}
        {loading ? (
          <div className="stat-sub">Memuat data pasien...</div>
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
                  <td>
                    <Link className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }} to={`/screening?patientId=${p.id}`}>
                      Screening
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}
