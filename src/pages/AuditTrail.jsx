import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query, limit, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import Layout from "../components/Layout";

const ENTITY_TYPES = [
  "", "screenings", "risk_assessments", "medication_reconciliation",
  "clinical_reviews", "safety_plans", "followups", "education",
  "safety_incidents", "config",
];

function formatTime(ts) {
  if (!ts) return "-";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

export default function AuditTrail() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("");

  async function load() {
    setLoading(true);
    let q = query(collection(db, "audit_logs"), orderBy("timestamp", "desc"), limit(100));
    if (entityFilter) {
      q = query(collection(db, "audit_logs"), where("entityType", "==", entityFilter), orderBy("timestamp", "desc"), limit(100));
    }
    const snap = await getDocs(q);
    let data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (actorFilter) {
      data = data.filter((r) => (r.actorId || "").toLowerCase().includes(actorFilter.toLowerCase()));
    }
    setRows(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityFilter]);

  return (
    <Layout title="Audit Trail" meta="Read-only — seluruh aktivitas penting tercatat otomatis dari Cloud Functions">
      <div className="card">
        <div className="grid cols-3" style={{ marginBottom: 14 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Entitas</label>
            <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)}>
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>{t || "Semua"}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Aktor (ID/email mengandung)</label>
            <input value={actorFilter} onChange={(e) => setActorFilter(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
          </div>
          <div className="field" style={{ marginBottom: 0, display: "flex", alignItems: "flex-end" }}>
            <button className="btn btn-ghost" onClick={load} style={{ width: "100%" }}>
              Terapkan Filter
            </button>
          </div>
        </div>

        {loading ? (
          <div className="stat-sub">Memuat...</div>
        ) : rows.length === 0 ? (
          <div className="stat-sub">Tidak ada entri sesuai filter.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Aktor</th>
                <th>Aksi</th>
                <th>Entitas</th>
                <th>Alasan</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{formatTime(r.timestamp)}</td>
                  <td className="mono">{r.actorId}</td>
                  <td>{r.action}</td>
                  <td className="mono">{r.entityType}/{r.entityId}</td>
                  <td>{r.reason || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="hint">
          Koleksi <span className="mono">audit_logs</span> bersifat append-only — Firestore Security Rules melarang
          write dari client sama sekali; hanya Cloud Functions (via Admin SDK) yang menulis ke sini. Data ini juga
          tidak bisa dihapus oleh user manapun lewat aplikasi.
        </div>
      </div>
    </Layout>
  );
}
