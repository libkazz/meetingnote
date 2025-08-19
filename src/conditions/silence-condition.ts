// Silence detection (adaptive VAD) utilities
// Encapsulates the logic to classify frames as voice/silence while adapting to ambient noise.

export type SilenceConfig = {
  useAdaptiveVad?: boolean;
  noiseFloorAlpha?: number; // EMA factor for ambient (0..1); higher -> slower update
  voiceMarginRms?: number;  // Margin above noise floor to consider as voice
  noiseFloorInit?: number;  // Initial noise floor RMS
  silenceThresholdRms?: number; // Absolute fallback threshold when adaptive VAD disabled
  voiceDebounceMs?: number; // Require voice to persist before breaking silence
};

export type SilenceState = {
  noiseFloor: number;
  voiceHoldMs: number;
  silenceMs: number;
};

export function createSilenceState(cfg?: SilenceConfig): SilenceState {
  const init = Math.max(0, Math.min(1, cfg?.noiseFloorInit ?? 0.01));
  return { noiseFloor: init, voiceHoldMs: 0, silenceMs: 0 };
}

export function computeRmsFromAnalyser(analyser: AnalyserNode): number {
  const arr = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(arr);
  let sumSq = 0;
  for (let i = 0; i < arr.length; i++) {
    const v = (arr[i] - 128) / 128; // [-1, 1]
    sumSq += v * v;
  }
  return Math.sqrt(sumSq / arr.length);
}

export function stepSilence(
  analyser: AnalyserNode,
  prev: SilenceState,
  cfg: SilenceConfig,
  dtMs: number
): { isSilent: boolean; rms: number; state: SilenceState } {
  const rms = computeRmsFromAnalyser(analyser);
  const useAdaptive = cfg.useAdaptiveVad !== false;
  let isSilent = false;
  let noiseFloor = prev.noiseFloor;
  let voiceHoldMs = prev.voiceHoldMs;
  let silenceMs = prev.silenceMs;
  // Internal state for classifying voice vs silence
  let isVoice = false;

  if (useAdaptive) {
    const alpha = cfg.noiseFloorAlpha ?? 0.95; // when no voice
    const margin = cfg.voiceMarginRms ?? 0.015;
    isVoice = rms > (noiseFloor + margin);
    // Update noise floor: slower when voice present, faster when not
    const nextFloor = isVoice
      ? noiseFloor * 0.999 + rms * 0.001
      : noiseFloor * alpha + rms * (1 - alpha);
    noiseFloor = Math.max(0, Math.min(1, nextFloor));
    isSilent = !isVoice;
    if (isVoice) voiceHoldMs += dtMs; else voiceHoldMs = 0;
    // update tracking variables only as needed
  } else {
    const th = cfg.silenceThresholdRms ?? 0.02;
    isSilent = rms < th;
    if (isSilent) voiceHoldMs = 0; else voiceHoldMs += dtMs;
    // threshold used implicitly
  }

  if (isSilent) {
    silenceMs += dtMs;
  } else {
    const debounce = cfg.voiceDebounceMs ?? 0;
    if (voiceHoldMs >= debounce) silenceMs = 0;
  }

  return { isSilent, rms, state: { noiseFloor, voiceHoldMs, silenceMs } };
}

// Default silence detection parameters (exported for app-wide use)
export const silenceConfig = {
  // Original, moderate settings
  useAdaptiveVad: true,
  noiseFloorAlpha: 0.9,
  voiceMarginRms: 0.03,
  noiseFloorInit: 0.01,
  silenceThresholdRms: 0.02,
  voiceDebounceMs: 400,
  checkIntervalMs: 200,
} as const;
