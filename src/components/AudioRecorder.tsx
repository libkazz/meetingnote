import React, { useEffect, useRef, useState } from "react";
import { useAudioDevices } from "../hooks/use-audio-devices";
import { useRecorder } from "../hooks/use-recorder";
import { useToast } from "../hooks/use-toast";
import { transcribeAudio } from "../lib/api/transcribe-client";
import { chunsizeCondition } from "../conditions/chunksize-condition";
import { createSilenceState, stepSilence, silenceConfig } from "../conditions/silence-condition";
import DeviceSelector from "./DeviceSelector";
import WaveformCanvas from "./WaveformCanvas";
import DiagnosticsPanel from "./DiagnosticsPanel";
import TranscriptActions from "./TranscriptActions";
import { mergeAudio } from "../lib/api/merge-client";

export default function AudioRecorder() {
  const [result, setResult] = useState<string>("");
  const [active, setActive] = useState<boolean>(false);
  const [stopping, setStopping] = useState<boolean>(false);
  const { devices, deviceId, setDeviceId, ensureDevicesLoaded } = useAudioDevices();
  const { recording, status, setStatus, elapsed, recMime, analyser, start, stop, cutSegment, ensureAnalyser } = useRecorder();
  const { toast, showToast } = useToast();

  const sinceLastSendSecRef = useRef<number>(0);
  const silenceMsRef = useRef<number>(0);
  const silenceStateRef = useRef<ReturnType<typeof createSilenceState> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const checkTimerRef = useRef<number | null>(null);
  const secondsTimerRef = useRef<number | null>(null);
  const sendingRef = useRef<boolean>(false);
  // Meeting ID is generated per page load (reset on full reload)
  const meetingIdRef = useRef<string>(`${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const chunkIndexRef = useRef<number>(0);
  const [mergedUrl, setMergedUrl] = useState<string>("");

  useEffect(() => { /* cleanup handled in useRecorder */ }, []);
  useEffect(() => { analyserRef.current = analyser; }, [analyser]);
  // Local timers cleanup on unmount
  useEffect(() => {
    return () => {
      if (checkTimerRef.current) window.clearInterval(checkTimerRef.current);
      if (secondsTimerRef.current) window.clearInterval(secondsTimerRef.current);
    };
  }, []);

  async function onStart() {
    setResult("");
    setMergedUrl("");
    setActive(true);
    sinceLastSendSecRef.current = 0;
    silenceMsRef.current = 0;
    silenceStateRef.current = createSilenceState({
      useAdaptiveVad: silenceConfig.useAdaptiveVad,
      noiseFloorAlpha: silenceConfig.noiseFloorAlpha,
      voiceMarginRms: silenceConfig.voiceMarginRms,
      noiseFloorInit: silenceConfig.noiseFloorInit,
      silenceThresholdRms: silenceConfig.silenceThresholdRms,
      voiceDebounceMs: silenceConfig.voiceDebounceMs,
    });
    chunkIndexRef.current = 0;
    try {
      await start({ deviceId, chunkMs: chunsizeCondition.chunkMs });
      await ensureAnalyser();
      // Start timers for condition checks
      if (secondsTimerRef.current) window.clearInterval(secondsTimerRef.current);
      secondsTimerRef.current = window.setInterval(() => {
        sinceLastSendSecRef.current += 1;
      }, 1000);

      if (checkTimerRef.current) window.clearInterval(checkTimerRef.current);
      checkTimerRef.current = window.setInterval(() => {
        // Silence detection via external module
        const a = analyserRef.current;
        if (a && silenceStateRef.current) {
          const { state } = stepSilence(a, silenceStateRef.current, {
            useAdaptiveVad: silenceConfig.useAdaptiveVad,
            noiseFloorAlpha: silenceConfig.noiseFloorAlpha,
            voiceMarginRms: silenceConfig.voiceMarginRms,
            noiseFloorInit: silenceConfig.noiseFloorInit,
            silenceThresholdRms: silenceConfig.silenceThresholdRms,
            voiceDebounceMs: silenceConfig.voiceDebounceMs,
          }, silenceConfig.checkIntervalMs);
          silenceStateRef.current = state;
          silenceMsRef.current = state.silenceMs;
        }

        const since = sinceLastSendSecRef.current;
        const silentMs = silenceMsRef.current;
        if (!sendingRef.current) {
          const should = chunsizeCondition.shouldSend(since, silentMs);
          if (should) void sendCurrentSegment();
        }
      }, silenceConfig.checkIntervalMs);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast(msg);
      setActive(false);
    }
  }

  async function onStop() {
    // Stop timers
    if (checkTimerRef.current) { window.clearInterval(checkTimerRef.current); checkTimerRef.current = null; }
    if (secondsTimerRef.current) { window.clearInterval(secondsTimerRef.current); secondsTimerRef.current = null; }
    // Immediately reflect sending state in UI
    setStopping(true);
    setStatus("Sending final segment...");
    const blob = await stop();
    try {
      await sendBlob(blob, "final");
      // After sending final segment, trigger merge-audio
      setStatus("Merging audio...");
      const merge = await mergeAudio(meetingIdRef.current);
      if (merge.audio_link_url) {
        setMergedUrl(merge.audio_link_url);
        setStatus("Done");
      } else {
        setStatus("Merged, but no link returned");
      }
      setActive(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to send";
      setStatus(msg);
      showToast(`Error: ${msg}`);
      setActive(false);
    }
    finally {
      setStopping(false);
    }
  }

  async function sendCurrentSegment() {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setStatus("Sending to n8n...");
    try {
      const blob = await (cutSegment ? cutSegment() : Promise.resolve(new Blob()));
      if (blob && blob.size > 0) {
        const since = sinceLastSendSecRef.current;
        const silentMs = silenceMsRef.current;
        const reason = chunsizeCondition.reason?.(since, silentMs) || (since >= chunsizeCondition.maxSeconds ? "max-seconds" : "min-seconds-and-silence");
        await sendBlob(blob, reason);
      }
      sinceLastSendSecRef.current = 0;
      silenceMsRef.current = 0;
      setStatus("Recording...");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to send";
      setStatus(msg);
      showToast(`Error: ${msg}`);
    } finally {
      sendingRef.current = false;
    }
  }

  async function sendBlob(blob: Blob, reason: string) {
    const out = await transcribeAudio(blob, {
      fields: {
        recording_id: meetingIdRef.current,
        recording_index: ++chunkIndexRef.current,
        reason,
        elapsedSeconds: sinceLastSendSecRef.current,
        mime: recMime || "audio/webm",
      },
    });
    setResult((prev) => (prev ? `${prev}\n${out.text}` : out.text));
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
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="hint">Meeting ID: {meetingIdRef.current}</div>
      </div>
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
        {(() => {
          const isActive = active || recording || status.startsWith("Recording");
          const isBackgroundSending = recording && status.startsWith("Sending");
          const disableStopForFinal = stopping || (!recording && status.startsWith("Sending"));
          const showBadge = !stopping && (recording || (active && status.startsWith("Sending")));
          const badgeLabel = isBackgroundSending ? "Sending" : "Recording";
          return (
            <>
              <button
                className={isActive ? "btn btn-danger" : "btn"}
                onClick={isActive ? onStop : onStart}
                disabled={disableStopForFinal}
              >
                {isActive
                  ? (disableStopForFinal ? "⏳ Sending..." : "⏹ Stop and Send")
                  : "🎙️ Start Recording"}
              </button>
              {showBadge && (
                <span className="badge" aria-live="polite">
                  <span className="dot" aria-hidden />{badgeLabel} {formatTime(elapsed)}
                </span>
              )}
            </>
          );
        })()}
      </div>
      <WaveformCanvas analyser={analyser} height={80} />
      <div className="status" aria-live="polite">{status} {recMime && `(format: ${recMime})`}</div>
      <DiagnosticsPanel />
      <TranscriptActions text={result} onCopy={copyText} onDownload={downloadText} />
      {mergedUrl && (
        <div className="toolbar">
          <a className="btn btn-secondary" href={mergedUrl} download target="_blank" rel="noreferrer noopener">
            🔗 Download merged audio
          </a>
        </div>
      )}
      <div className="toaster" aria-live="polite">
        {toast && <div className="toast">{toast}</div>}
      </div>
    </div>
  );
}
