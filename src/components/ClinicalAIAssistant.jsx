import { useEffect, useRef, useState } from "react";
import { callApi } from "../lib/api";

const SpeechRecognitionAPI =
  typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

/**
 * ClinicalAIAssistant — chat + suara, terintegrasi di halaman Clinical
 * Review (per permintaan Bapak Teguh). Asisten HANYA menjelaskan data yang
 * sudah dihitung sistem — lihat batasan lengkap di
 * functions/src/aiAssistant.js (system prompt).
 *
 * Input suara: Web Speech API (SpeechRecognition) — didukung Chrome/Edge,
 * belum semua browser. Kalau tidak didukung, tombol mic disembunyikan dan
 * chat teks tetap berfungsi penuh.
 * Output suara: SpeechSynthesis — didukung hampir semua browser modern.
 */
const QUICK_PROMPTS = [
  "Jelaskan kenapa skor risikonya seperti ini",
  "Ringkas riwayat obat pasien ini",
  "Apa arti klinis red flag yang terdeteksi, secara umum?",
  "Apa yang perlu saya perhatikan sebelum clinical review?",
];

export default function ClinicalAIAssistant({ assessmentId, patientId }) {
  const [messages, setMessages] = useState([]); // { role: "user"|"assistant", content }
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceOutputOn, setVoiceOutputOn] = useState(false);
  const recognitionRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    // Reset percakapan setiap pindah pasien
    setMessages([]);
    setInput("");
    setError("");
  }, [assessmentId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const speak = (text) => {
    if (!voiceOutputOn || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "id-ID";
    window.speechSynthesis.speak(utter);
  };

  const sendQuestion = async (question) => {
    if (!question.trim()) return;
    setError("");
    setBusy(true);
    const nextMessages = [...messages, { role: "user", content: question }];
    setMessages(nextMessages);
    setInput("");

    try {
      const conversationHistory = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await callApi("aiAssistant", { assessmentId, question, conversationHistory });
      const answer = res.data.answer;
      setMessages((prev) => [...prev, { role: "assistant", content: answer }]);
      speak(answer);
    } catch (e) {
      if (e.code === "functions/failed-precondition") {
        setError("Asisten AI belum diaktifkan oleh Admin (perlu review tata kelola privasi data dulu di menu Administration).");
      } else if (e.code === "functions/resource-exhausted") {
        setError(e.message || "Batas pemakaian harian tercapai.");
      } else {
        setError(e.message || "Asisten AI gagal merespons.");
      }
    } finally {
      setBusy(false);
    }
  };

  const startListening = () => {
    if (!SpeechRecognitionAPI) return;
    const recognition = new SpeechRecognitionAPI();
    recognition.lang = "id-ID";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      sendQuestion(transcript);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h3>Tanya Asisten Klinis</h3>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-soft)" }}>
          <input type="checkbox" checked={voiceOutputOn} onChange={(e) => setVoiceOutputOn(e.target.checked)} />
          Bacakan jawaban
        </label>
      </div>

      <div className="alert warn" style={{ marginTop: 0, marginBottom: 12 }}>
        <span>ℹ️</span>
        <div>Bisa menjelaskan data pasien ini dan pengetahuan medis umum sebagai referensi — tapi tidak akan mendiagnosis atau merekomendasikan pengobatan untuk pasien ini. Keputusan klinis tetap di tangan Bapak/Ibu dokter.</div>
      </div>

      <div
        ref={scrollRef}
        style={{
          maxHeight: 260,
          overflowY: "auto",
          border: "1px solid var(--line)",
          borderRadius: 8,
          padding: 10,
          marginBottom: 10,
          background: "var(--surface-2)",
        }}
      >
        {messages.length === 0 ? (
          <div>
            <div className="stat-sub" style={{ marginBottom: 8 }}>
              Contoh pertanyaan — klik untuk langsung bertanya, atau ketik sendiri di bawah:
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {QUICK_PROMPTS.map((q) => (
                <button
                  key={q}
                  className="btn btn-ghost"
                  style={{ fontSize: 12, padding: "5px 10px" }}
                  onClick={() => sendQuestion(q)}
                  disabled={busy}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              style={{
                marginBottom: 8,
                display: "flex",
                justifyContent: m.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  maxWidth: "80%",
                  padding: "8px 12px",
                  borderRadius: 10,
                  fontSize: 13,
                  background: m.role === "user" ? "var(--accent)" : "var(--surface)",
                  color: m.role === "user" ? "#fff" : "var(--ink)",
                  border: m.role === "user" ? "none" : "1px solid var(--line)",
                  whiteSpace: "pre-wrap",
                }}
              >
                {m.content}
              </div>
            </div>
          ))
        )}
        {busy && <div className="stat-sub">Asisten sedang menyusun jawaban...</div>}
      </div>

      {error && <div className="error-text">{error}</div>}

      <div style={{ display: "flex", gap: 8 }}>
        <input
          style={{ flex: 1 }}
          placeholder="Ketik pertanyaan tentang data pasien ini..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendQuestion(input)}
          disabled={busy}
        />
        {SpeechRecognitionAPI && (
          <button
            className="btn btn-ghost"
            onClick={listening ? stopListening : startListening}
            disabled={busy}
            title="Bicara"
            style={{ color: listening ? "var(--redflag)" : undefined }}
          >
            {listening ? "⏹ Berhenti" : "🎤 Bicara"}
          </button>
        )}
        <button className="btn btn-primary" onClick={() => sendQuestion(input)} disabled={busy}>
          Kirim
        </button>
      </div>
      {!SpeechRecognitionAPI && (
        <div className="hint">Input suara tidak didukung browser ini — gunakan Chrome/Edge untuk fitur bicara.</div>
      )}
    </div>
  );
}
