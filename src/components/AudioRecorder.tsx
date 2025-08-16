import { useAudioDevices } from "../hooks/use-audio-devices";
import { useRecorder } from "../hooks/use-recorder";
import { useToast } from "../hooks/use-toast";
import DeviceSelector from "./DeviceSelector";
import WaveformCanvas from "./WaveformCanvas";
import DiagnosticsPanel from "./DiagnosticsPanel";

export default function AudioRecorder() {
  const [result, setResult] = useState<string>("");
  const { devices, deviceId, setDeviceId, ensureDevicesLoaded } = useAudioDevices();
  const { recording, status, setStatus, elapsed, recMime, analyser, start, stop } = useRecorder();
  const { toast, showToast } = useToast();

  useEffect(() => { /* cleanup handled in useRecorder */ }, []);

  async function onStart() {
    setResult("");
    try {
      await start({ deviceId });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast(msg);
    }
  }

  async function onStop() {
    const blob = await stop();
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

  // Diagnostics moved to DiagnosticsPanel component

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
          onClick={recording ? onStop : onStart}
        >
          {recording ? "⏹ Stop and Send" : "🎙️ Start Recording"}
        </button>
        {recording && (
          <span className="badge" aria-live="polite">
            <span className="dot" aria-hidden />Recording {formatTime(elapsed)}
          </span>
        )}
      </div>
      <WaveformCanvas analyser={analyser} height={80} />
      <div className="status" aria-live="polite">{status} {recMime && `(format: ${recMime})`}</div>
      <DiagnosticsPanel />
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
import React, { useEffect, useState } from "react";
import { transcribeAudio } from "../lib/api/n8n-client";
