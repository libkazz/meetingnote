import React, { useEffect, useRef, useState } from "react";
import { transcribeAudio, diagnoseConnection, getRuntimeConfig }
  from "../lib/api/n8n-client";
import type { DiagnoseResult } from "../lib/api/n8n-client";

export default function AudioRecorder() {
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [result, setResult] = useState<string>("");
  const mediaRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<number | null>(null);

  // Waveform
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const waveDataRef = useRef<Uint8Array | null>(null);
  const rafRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Toast
  const [toast, setToast] = useState<string>("");
  const toastTimerRef = useRef<number | null>(null);
  const [diag, setDiag] = useState<DiagnoseResult | null>(null);

  function showToast(message: string) {
    setToast(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(""), 3000);
  }

  useEffect(() => {
    return () => {
      if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
      mediaRef.current?.getTracks().forEach(t => t.stop());
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      audioCtxRef.current?.close().catch(() => undefined);
    };
  }, []);

  function drawWave() {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    const data = waveDataRef.current;
    if (!canvas || !analyser || !data) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width, height } = canvas;
    analyser.getByteTimeDomainData(data);
    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(91,140,255,0.9)";
    ctx.beginPath();
    const slice = width / data.length;
    let x = 0;
    for (let i = 0; i < data.length; i++) {
      const v = data[i] / 128.0; // 0..255 -> around 1.0 baseline
      const y = (v * height) / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += slice;
    }
    ctx.stroke();
    rafRef.current = requestAnimationFrame(drawWave);
  }

  async function start() {
    setResult("");
    setStatus("Accessing microphone...");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRef.current = stream;
    chunksRef.current = [];
    const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
    rec.ondataavailable = e => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    // Setup audio context for waveform
    try {
      const AC = (
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ||
        AudioContext
      );
      const ctx = new AC();
      // Some browsers start suspended until a user gesture; ensure running
      if (ctx.state === "suspended") {
        await ctx.resume().catch(() => undefined);
      }
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      const bufferLength = analyser.fftSize;
      const dataArray = new Uint8Array(bufferLength);
      source.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      waveDataRef.current = dataArray;
      // Fit canvas to element width (consider devicePixelRatio)
      const c = canvasRef.current;
      const resize = () => {
        if (!c) return;
        const dpr = window.devicePixelRatio || 1;
        const w = Math.max(1, Math.floor(c.clientWidth * dpr));
        const h = Math.max(1, Math.floor(c.clientHeight * dpr));
        c.width = w;
        c.height = h;
      };
      resize();
      window.addEventListener("resize", resize);
      // Store remover in rafRef using negative sentinel to avoid extra ref
      (rafRef as unknown as { resize?: () => void }).resize = () =>
        window.removeEventListener("resize", resize);
      drawWave();
    } catch {
      // Non-fatal: waveform not available
    }

    rec.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      setStatus("Sending to n8n...");
      try {
        const out = await transcribeAudio(blob);
        setResult(out.text);
        setStatus("Done");
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to send";
        setStatus(msg);
        showToast(`Error: ${msg}`);
      }
    };
    recRef.current = rec;
    rec.start();
    setRecording(true);
    setStatus("Recording...");
    setElapsed(0);
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);
  }

  function stop() {
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
    mediaRef.current?.getTracks().forEach(t => t.stop());
    setRecording(false);
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    audioCtxRef.current?.close().catch(() => undefined);
    const remover = (rafRef as unknown as { resize?: () => void }).resize;
    if (remover) remover();
  }

  function pad(n: number): string { return n < 10 ? `0${n}` : String(n); }
  function formatTime(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${pad(m)}:${pad(s)}`;
  }

  async function copyText() {
    try {
      if (!result) return;
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(result);
      } else {
        const ta = document.createElement("textarea");
        ta.value = result;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      showToast("Copied to clipboard");
    } catch {
      showToast("Failed to copy");
    }
  }

  function downloadText() {
    try {
      if (!result) return;
      const blob = new Blob([result], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `transcript-${Date.now()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("Downloaded text");
    } catch {
      showToast("Failed to download");
    }
  }

  async function runDiagnose() {
    setStatus("Running connection diagnostics...");
    const info = await diagnoseConnection();
    setDiag(info);
    if (!info.ok) showToast(`Diagnosis: ${info.error}`);
    else showToast(`Diagnosis: HTTP ${info.status}`);
    setStatus("");
  }

  return (
    <div className="stack">
      <div className="row">
        <button
          className={recording ? "btn btn-danger" : "btn"}
          onClick={recording ? stop : start}
        >
          {recording ? "⏹ Stop and Send" : "🎙️ Start Recording"}
        </button>
        {recording && (
          <span className="badge" aria-live="polite">
            <span className="dot" aria-hidden />Recording {formatTime(elapsed)}
          </span>
        )}
      </div>
      <canvas ref={canvasRef} className="wave" height={80} />
      <div className="status" aria-live="polite">{status}</div>
      <details>
        <summary className="hint">Connection Diagnostics</summary>
        <div className="toolbar" style={{ margin: "8px 0" }}>
          <button className="btn btn-ghost" onClick={runDiagnose}>🔎 Run Diagnostics</button>
        </div>
        <pre style={{ whiteSpace: "pre-wrap" }}>
{JSON.stringify({ env: getRuntimeConfig(), result: diag }, null, 2)}
        </pre>
      </details>
      {result && (
        <>
          <div className="toolbar">
            <button className="btn btn-secondary" onClick={copyText}>📋 Copy</button>
            <button className="btn btn-secondary" onClick={downloadText}>💾 Download</button>
          </div>
          <pre style={{ whiteSpace: "pre-wrap" }}>{result}</pre>
        </>
      )}
      <div className="toaster" aria-live="polite">
        {toast && <div className="toast">{toast}</div>}
      </div>
    </div>
  );
}