import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../lib/firebase";
import { callApi } from "../lib/api";
import Layout from "../components/Layout";

const JENIS_LABEL = {
  KPC: "KPC - Kondisi Potensial Cedera",
  KNC: "KNC - Kejadian Nyaris Cedera",
  KTC: "KTC - Kejadian Tidak Cedera",
  KTD: "KTD - Kejadian Tidak Diharapkan",
  SENTINEL: "Kejadian Sentinel",
};

const STATUS_LABEL = {
  pending: "Menunggu Review",
  reviewed: "Sudah Direview",
  closed: "Ditutup",
};

export default function IncidentList() {
  const [rows, setRows] = useState([]);
  const [patientNames, setPatientNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  async function load() {
    setLoading(true);
    const [snap, patientsSnap] = await Promise.all([
      getDocs(query(collection(db, "safety_incidents"), orderBy("reportedAt", "desc"))),
      getDocs(collection(db, "patients")),
    ]);
    const names = {};
    patientsSnap.docs.forEach((d) => { names[d.id] = d.data().name || d.id; });
    setPatientNames(names);
    setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const markReviewed = async (id) => {
    setBusyId(id);
    try {
      await callApi("incident", { action: "updateStatus", incidentId: id, reviewStatus: "reviewed" });
      await load();
    } finally {
      setBusyId(null);
    }
  };
  return (
    <Layout title="Daftar Insiden" meta="Rekap laporan keselamatan pasien NCD">
      <div className="card">
        {loading ? (
          <div className="stat-sub">Memuat...</div>
        ) : rows.length === 0 ? (
          <div className="stat-sub">Belum ada laporan insiden.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Jenis</th>
                <th>Kategori</th>
                <th>Pasien</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.reportedAt?.toDate ? r.reportedAt.toDate().toLocaleDateString("id-ID") : "-"}</td>
                  <td>{JENIS_LABEL[r.jenis] || r.jenis || "-"}</td>
                  <td>{r.kategori || "-"}</td>
                  <td>{r.patientId ? (patientNames[r.patientId] || r.patientId) : "-"}</td>
                  <td>{STATUS_LABEL[r.reviewStatus] || r.reviewStatus || "-"}</td>
                  <td>
                    {r.reviewStatus !== "reviewed" && (
                      <button
                        className="btn btn-ghost"
                        disabled={busyId === r.id}
                        onClick={() => markReviewed(r.id)}
                      >
                        {busyId === r.id ? "Memproses..." : "Tandai Direview"}
                      </button>
                    )}
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
