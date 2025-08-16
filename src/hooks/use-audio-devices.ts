export type UseAudioDevices = {
  devices: MediaDeviceInfo[];
  deviceId: string;
  setDeviceId: (id: string) => void;
  ensureDevicesLoaded: () => Promise<void>;
};

import { useEffect, useRef, useState } from "react";

export function useAudioDevices(): UseAudioDevices {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const primedRef = useRef(false);

  async function refreshDevices() {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices(list.filter((d) => d.kind === "audioinput"));
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem("meetingnote.inputDeviceId") || "";
      if (saved) setDeviceId(saved);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("meetingnote.inputDeviceId", deviceId || "");
    } catch {
      // ignore
    }
  }, [deviceId]);

  useEffect(() => {
    refreshDevices();
    const handler = () => refreshDevices();
    try {
      navigator.mediaDevices.addEventListener("devicechange", handler);
    } catch {
      // older browsers
    }
    return () => {
      try {
        navigator.mediaDevices.removeEventListener("devicechange", handler);
      } catch {
        // ignore
      }
    };
  }, []);

  async function prime() {
    // Ask for permission once to reveal device labels
    const tmp = await navigator.mediaDevices.getUserMedia({ audio: true });
    tmp.getTracks().forEach((t) => t.stop());
    await refreshDevices();
    primedRef.current = true;
  }

  async function ensureDevicesLoaded() {
    if (primedRef.current) return;
    try {
      await prime();
    } catch {
      // ignore; user may deny permission
    }
  }

  return { devices, deviceId, setDeviceId, ensureDevicesLoaded };
}

