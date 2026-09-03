import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../lib/firebase";
import { callApi } from "../lib/api";
import Layout from "../components/Layout";

const STATUS_LABEL = {
  planned: ["low", "🔔 Due"],
  overdue: ["moderate", "🟠 Overdue"],
  completed: ["low", "✅ Selesai"],
};

export default function Followup() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [patientNames, setPatientNames] = useState({});

  async function load() {
    setLoading(true);
    const [snap, patientsSnap] = await Promise.all([
      getDocs(query(collection(db, "followups"), orderBy("dueDate", "asc"))),
      getDocs(collection(db, "patients")),
    ]);
    const names = {};
    patientsSnap.docs.forEach((d) => {
      names[d.id] = d.data().name || d.id;
    });
    setPatientNames(names);
    setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const markComplete = async (id) => {
    setBusyId(id);
    try {
      await callApi("safetyPlan", { action: "complete", followupId: id });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Layout title="Follow-up" meta="Pemantauan kepatuhan follow-up pasien">
      <div className="card">
        {loading ? (
          <div className="stat-sub">Memuat...</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Pasien</th>
                <th>Tenggat Waktu</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const [cls, label] = STATUS_LABEL[r.status] || ["low", r.status];
                return (
                  <tr key={r.id}>
                    <td>{patientNames[r.patientId] || r.patientId}</td>
                    <td className="mono">{r.dueDate}</td>
                    <td>
                      <span className={`badge ${cls}`}>
                        <span className="dot"></span>
                        {label}
                      </span>
                    </td>
                    <td>
                      {r.status !== "completed" && (
                        <button
                          className="btn btn-ghost"
                          style={{ padding: "4px 10px", fontSize: 12 }}
                          onClick={() => markComplete(r.id)}
                          disabled={busyId === r.id}
                        >
                          {busyId === r.id ? "..." : "Tandai Selesai"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}
