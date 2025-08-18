// Common utilities for n8n endpoint clients

export type RuntimeConfig = {
  apiUrl: string;
  hasApiKey: boolean;
  timeoutMs: number;
  fieldName: string;
  useProxy: boolean;
};

export function readEnv(name: string): string | undefined {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return env?.[`VITE_${name}`] ?? env?.[name];
}

export function getRuntimeConfig(primaryVar: string): RuntimeConfig {
  const useProxy = (readEnv("USE_PROXY") || "").toLowerCase() === "true";
  const directUrl = readEnv(primaryVar) || readEnv("N8N_API_URL"); // legacy fallback
  const apiUrl = useProxy ? "/api/n8n" : (directUrl || "");
  const apiKey = readEnv("N8N_API_KEY");
  const timeoutMs = Number(readEnv("REQUEST_TIMEOUT_MS") || 60000);
  const fieldName = readEnv("UPLOAD_FIELD_NAME") || "audio";
  return { apiUrl, hasApiKey: Boolean(apiKey), timeoutMs, fieldName, useProxy };
}

export async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return res;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("The request timed out");
    }
    if (err instanceof TypeError) {
      throw new Error("Network/CORS Error: Check the browser console and Network tab");
    }
    throw err as Error;
  } finally {
    window.clearTimeout(timeout);
  }
}

// Connectivity diagnostic: attempts a minimal POST to check network/CORS
export type DiagnoseResult =
  | { ok: true; status: number; statusText: string; headers: Record<string, string | null>; cfg: RuntimeConfig }
  | { ok: false; error: string; kind?: "timeout" | "network" | "other"; cfg: RuntimeConfig };

export async function diagnoseConnection(primaryVar = "N8N_TRANSCRIBE_URL"): Promise<DiagnoseResult> {
  const cfg = getRuntimeConfig(primaryVar);
  if (!cfg.apiUrl) {
    return { ok: false, error: "API URL is not set", cfg } as const;
  }
  const form = new FormData();
  form.append(cfg.fieldName, new Blob([""]), "ping.txt");
  try {
    const res = await fetch(cfg.apiUrl, {
      method: "POST",
      body: form,
      headers: cfg.hasApiKey ? { Authorization: `Bearer ${readEnv("N8N_API_KEY")}` } : undefined,
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status} ${res.statusText}`, cfg } as const;
    }
    const headers = {
      "access-control-allow-origin": res.headers.get("access-control-allow-origin"),
      "content-type": res.headers.get("content-type"),
    };
    return { ok: true, status: res.status, statusText: res.statusText, headers, cfg } as const;
  } catch (e) {
    const err = e as Error;
    const kind = err.name === "AbortError" ? "timeout" : err instanceof TypeError ? "network" : "other";
    return { ok: false, error: err.message, kind, cfg } as const;
  }
}

