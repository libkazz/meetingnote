import React, { useEffect, useRef, useState } from "react";
import { transcribeAudio, diagnoseConnection, getRuntimeConfig } from "../lib/api/n8n-client";
import type { DiagnoseResult } from "../lib/api/n8n-client";
import DeviceSelector from "./DeviceSelector";
import WaveformCanvas from "./WaveformCanvas";
import { useAudioDevices } from "../hooks/use-audio-devices";

export default function AudioRecorder() {
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [result, setResult] = useState<string>("");
  const mediaRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<number | null>(null);
  const [recMime, setRecMime] = useState<string>("");
  const { devices, deviceId, setDeviceId, ensureDevicesLoaded } = useAudioDevices();

  // Waveform
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

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

  // Waveform drawing handled by WaveformCanvas

  async function start() {
    setResult("");
    setStatus("Accessing microphone...");
    let stream: MediaStream;
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        },
      };
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(`Microphone error: ${msg}`);
      showToast(`Microphone error: ${msg}`);
      return;
    }
    mediaRef.current = stream;
    // Devices are managed by useAudioDevices hook
    chunksRef.current = [];
    // Prefer a supported MIME type for better compatibility (Safari/Firefox/Chrome)
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4;codecs=aac",
    ];
    const supported = candidates.find((t) =>
      typeof MediaRecorder !== "undefined" &&
      (MediaRecorder as unknown as { isTypeSupported?: (t: string) => boolean }).isTypeSupported?.(t)
    );
    let rec: MediaRecorder;
    try {
      rec = supported ? new MediaRecorder(stream, { mimeType: supported }) : new MediaRecorder(stream);
      setRecMime(rec.mimeType || supported || "");
    } catch (e) {
      // As a last resort, try constructing without options
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rec = new (MediaRecorder as any)(stream);
        setRecMime(rec.mimeType || "");
      } catch {
        const msg = e instanceof Error ? e.message : String(e);
        setStatus(`Recorder error: ${msg}`);
        showToast(`Recorder error: ${msg}`);
        return;
      }
    }
    rec.ondataavailable = e => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onerror = (ev) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = (ev as any)?.error as Error | undefined;
      const msg = err?.message || "Recorder error";
      setStatus(msg);
      showToast(msg);
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
      // Ensure the graph is pulled by connecting to a muted gain -> destination
      const gain = ctx.createGain();
      gain.gain.value = 0;
      source.connect(analyser);
      analyser.connect(gain);
      try { gain.connect((ctx as unknown as { destination?: AudioNode }).destination as AudioNode); } catch (_e) { /* ignore */ }
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      // WaveformCanvas reacts to analyser changes
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
    analyserRef.current = null;
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
      <div className="row" style={{ alignItems: "stretch" }}>
        <DeviceSelector
          devices={devices}
          value={deviceId}
          onChange={setDeviceId}
          disabled={recording}
          ensureDevicesLoaded={ensureDevicesLoaded}
        />
      </div>
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
      <WaveformCanvas analyser={analyserRef.current} height={80} />
      <div className="status" aria-live="polite">{status} {recMime && `(format: ${recMime})`}</div>
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
