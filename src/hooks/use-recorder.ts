import { useEffect, useRef, useState } from "react";

export type RecorderControls = {
  recording: boolean;
  status: string;
  setStatus: (s: string) => void;
  elapsed: number;
  recMime: string;
  analyser: AnalyserNode | null;
  start: (opts?: { deviceId?: string; chunkMs?: number; ondata?: (chunk: Blob) => void }) => Promise<void>;
  stop: () => Promise<Blob>;
  cutSegment?: () => Promise<Blob>;
  ensureAnalyser: () => Promise<boolean>;
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
  const lastStartOptsRef = useRef<{ deviceId?: string; chunkMs?: number; ondata?: (chunk: Blob) => void } | undefined>(undefined);

  useEffect(() => {
    return () => {
      try { if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop(); } catch (_e) { /* ignore */ }
      mediaRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) window.clearInterval(timerRef.current);
      audioCtxRef.current?.close().catch(() => undefined);
      setAnalyser(null);
    };
  }, []);

  async function start(opts?: { deviceId?: string; chunkMs?: number; ondata?: (chunk: Blob) => void }) {
    lastStartOptsRef.current = opts;
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
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data);
        try {
          opts?.ondata?.(e.data);
        } catch {
          // ignore user callback errors
        }
      }
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
    // Start recording. If chunkMs provided, request periodic dataavailable events
    try {
      rec.start(opts?.chunkMs as number | undefined);
    } catch {
      rec.start();
    }
    setRecording(true);
    setStatus("Recording...");
    setElapsed(0);
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);
  }

  async function ensureAnalyser(): Promise<boolean> {
    if (analyser || audioCtxRef.current) return true;
    const stream = mediaRef.current;
    if (!stream) return false;
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
      return true;
    } catch {
      return false;
    }
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

  async function cutSegment(): Promise<Blob> {
    // Stop only the MediaRecorder to produce a complete file, keep stream/analyser alive
    return new Promise<Blob>((resolve) => {
      const rec = recRef.current;
      if (!rec || rec.state === "inactive") {
        resolve(new Blob([]));
        return;
      }
      const handleStop = () => {
        const type = recMime || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        chunksRef.current = [];
        // Immediately restart a fresh recorder session on existing stream
        const stream = mediaRef.current;
        try {
          if (stream) {
            const candidates = [
              "audio/webm;codecs=opus",
              "audio/webm",
              "audio/ogg;codecs=opus",
              "audio/mp4;codecs=aac",
            ];
            const supported = candidates.find((t) =>
              typeof MediaRecorder !== "undefined" && (MediaRecorder as unknown as { isTypeSupported?: (t: string) => boolean }).isTypeSupported?.(t)
            );
            // Create new recorder
            const newRec = supported ? new MediaRecorder(stream, { mimeType: supported }) : new MediaRecorder(stream);
            setRecMime(newRec.mimeType || supported || "");
            newRec.ondataavailable = (e) => {
              if (e.data && e.data.size > 0) {
                chunksRef.current.push(e.data);
                try { lastStartOptsRef.current?.ondata?.(e.data); } catch { /* ignore */ }
              }
            };
            newRec.onerror = (ev: unknown) => {
              const err = (ev as { error?: Error } | undefined)?.error;
              setStatus(err?.message || "Recorder error");
            };
            recRef.current = newRec;
            try {
              newRec.start((lastStartOptsRef.current?.chunkMs ?? undefined) as number | undefined);
            } catch {
              newRec.start();
            }
          }
        } catch {
          // Non-fatal: if restart fails, overall recording may stop
        }
        resolve(blob);
      };
      rec.onstop = handleStop;
      rec.stop();
      // Do not stop tracks or audio context here
    });
  }

  return { recording, status, setStatus, elapsed, recMime, analyser, start, stop, cutSegment, ensureAnalyser };
}
