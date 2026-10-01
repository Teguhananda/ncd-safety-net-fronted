import { useEffect, useRef, useState, useCallback } from "react";

/**
 * alarmSound.js — BARU (Sept 2026). Salinan mesin alarm dari Dashboard.jsx
 * (beep Web Audio + suara text-to-speech bawaan browser, gratis) supaya
 * bisa dipakai komponen lain (PrehospitalAlarm) tanpa mengubah Dashboard.
 *
 * Browser memblokir suara sebelum layar disentuh/diklik sekali —
 * audioUnlocked = true setelah sentuhan pertama.
 */
export function useAlarmSound() {
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const audioCtxRef = useRef(null);

  useEffect(() => {
    if (audioUnlocked) return;
    function unlock() {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC && !audioCtxRef.current) audioCtxRef.current = new AC();
        audioCtxRef.current?.resume();
        const u = new SpeechSynthesisUtterance(" ");
        u.volume = 0;
        window.speechSynthesis?.speak(u);
      } catch {
        // abaikan
      }
      setAudioUnlocked(true);
      document.removeEventListener("click", unlock);
      document.removeEventListener("touchstart", unlock);
    }
    document.addEventListener("click", unlock);
    document.addEventListener("touchstart", unlock);
    return () => {
      document.removeEventListener("click", unlock);
      document.removeEventListener("touchstart", unlock);
    };
  }, [audioUnlocked]);

  const playBeep = useCallback((urgent) => {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audioCtxRef.current) audioCtxRef.current = new AC();
      const ctx = audioCtxRef.current;
      ctx.resume?.();
      const beepCount = urgent ? 4 : 2;
      for (let i = 0; i < beepCount; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        // sirene 2 nada bergantian (beda dari beep Dasbor biasa)
        osc.frequency.value = i % 2 === 0 ? 960 : 720;
        const startAt = ctx.currentTime + i * 0.3;
        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(0.3, startAt + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.26);
        osc.connect(gain).connect(ctx.destination);
        osc.start(startAt);
        osc.stop(startAt + 0.28);
      }
    } catch {
      // abaikan
    }
  }, []);

  const speak = useCallback((text, urgent) => {
    try {
      if (!window.speechSynthesis) return;
      const utter = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const idVoice = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("id"));
      if (idVoice) utter.voice = idVoice;
      utter.lang = idVoice ? idVoice.lang : "id-ID";
      utter.rate = urgent ? 0.95 : 1;
      utter.pitch = urgent ? 0.9 : 1;
      utter.volume = 1;
      if (urgent) window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    } catch {
      // abaikan
    }
  }, []);

  return { audioUnlocked, playBeep, speak };
}
