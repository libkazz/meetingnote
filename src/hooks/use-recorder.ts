import { useEffect, useRef, useState } from "react";

export type RecorderControls = {
  recording: boolean;
  status: string;
  setStatus: (s: string) => void;
  elapsed: number;
  recMime: string;
  analyser: AnalyserNode | null;
  start: (opts?: { deviceId?: string }) => Promise<void>;
  stop: () => Promise<Blob>;
};

export function useRecorder(): RecorderControls {
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [recMime, setRecMime] = useState("");
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const mediaRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    return () => {
      try { if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop(); } catch (_e) { /* ignore */ }
      mediaRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) window.clearInterval(timerRef.current);
      audioCtxRef.current?.close().catch(() => undefined);
      setAnalyser(null);
    };
  }, []);

  async function start(opts?: { deviceId?: string }) {
    setStatus("Accessing microphone...");
    chunksRef.current = [];
    let stream: MediaStream;
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          ...(opts?.deviceId ? { deviceId: { exact: opts.deviceId } } : {}),
        },
      };
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(`Microphone error: ${msg}`);
      throw e as Error;
    }
    mediaRef.current = stream;

    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4;codecs=aac",
    ];
    const supported = candidates.find(
      (t) => typeof MediaRecorder !== "undefined" && (MediaRecorder as unknown as { isTypeSupported?: (t: string) => boolean }).isTypeSupported?.(t)
    );
    let rec: MediaRecorder;
    try {
      rec = supported ? new MediaRecorder(stream, { mimeType: supported }) : new MediaRecorder(stream);
      setRecMime(rec.mimeType || supported || "");
    } catch (e) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rec = new (MediaRecorder as any)(stream);
        setRecMime(rec.mimeType || "");
      } catch (err) {
        const msg = e instanceof Error ? e.message : String(e);
        setStatus(`Recorder error: ${msg}`);
        throw err as Error;
      }
    }
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onerror = (ev: unknown) => {
      const err = (ev as { error?: Error } | undefined)?.error;
      setStatus(err?.message || "Recorder error");
    };
    recRef.current = rec;

    // Setup analyser graph
    try {
      const AC = (((window as unknown) as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext || AudioContext) as typeof AudioContext;
      const ctx = new AC();
      if (ctx.state === "suspended") await ctx.resume().catch(() => undefined);
      const source = ctx.createMediaStreamSource(stream);
      const a = ctx.createAnalyser();
      a.fftSize = 1024;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      source.connect(a);
      a.connect(gain);
      try { gain.connect((ctx as unknown as { destination?: AudioNode }).destination as AudioNode); } catch (_e) { /* ignore */ }
      audioCtxRef.current = ctx;
      setAnalyser(a);
    } catch {
      // Non-fatal
    }

    rec.start();
    setRecording(true);
    setStatus("Recording...");
    setElapsed(0);
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);
  }

  async function stop(): Promise<Blob> {
    return new Promise<Blob>((resolve) => {
      const rec = recRef.current;
      if (!rec || rec.state === "inactive") {
        resolve(new Blob([]));
        return;
      }
      rec.onstop = () => {
        const type = recMime || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        setRecording(false);
        if (timerRef.current) window.clearInterval(timerRef.current);
        if (audioCtxRef.current) audioCtxRef.current.close().catch(() => undefined);
        setAnalyser(null);
        resolve(blob);
      };
      rec.stop();
      mediaRef.current?.getTracks().forEach((t) => t.stop());
    });
  }

  return { recording, status, setStatus, elapsed, recMime, analyser, start, stop };
}
