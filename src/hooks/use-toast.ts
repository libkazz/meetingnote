import { useRef, useState } from "react";

export function useToast() {
  const [toast, setToast] = useState("");
  const timerRef = useRef<number | null>(null);
  function show(message: string, ms = 3000) {
    setToast(message);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setToast(""), ms);
  }
  return { toast, showToast: show } as const;
}

