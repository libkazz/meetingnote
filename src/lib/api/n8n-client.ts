type TranscribeResult = { text: string; raw: unknown };

export function readEnv(name: string): string | undefined {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return env?.[`VITE_${name}`] ?? env?.[name];
}

function getConfig(overrides?: { apiUrl?: string; apiKey?: string; timeoutMs?: number }) {
  const useProxy = (readEnv("USE_PROXY") || "").toLowerCase() === "true";
  const apiUrl =
    overrides?.apiUrl || (useProxy ? "/api/n8n" : readEnv("N8N_API_URL"));
  const apiKey = overrides?.apiKey || readEnv("N8N_API_KEY");
  const timeoutMs = overrides?.timeoutMs ?? Number(readEnv("REQUEST_TIMEOUT_MS") || 60000);
  if (!apiUrl) throw new Error("N8N_API_URL is not set");
  return { apiUrl, apiKey, timeoutMs };
}

export async function transcribeAudio(
  fileOrBlob: Blob,
  options?: { apiUrl?: string; apiKey?: string; signal?: AbortSignal; timeoutMs?: number }
): Promise<TranscribeResult> {
  const { apiUrl, apiKey, timeoutMs } = getConfig(options);
  const form = new FormData();
  const fieldName = readEnv("UPLOAD_FIELD_NAME") || "audio";
  const file = fileOrBlob instanceof File
    ? fileOrBlob
    : new File([fileOrBlob], "recording.webm", { type: (fileOrBlob as Blob).type || "audio/webm" });
  form.append(fieldName, file);

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  if (options?.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener("abort", () => controller.abort());
  }

  let res: Response;
  try {
    res = await fetch(apiUrl, {
      method: "POST",
      body: form,
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    window.clearTimeout(timeout);
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

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`n8n request failed: ${res.status} ${res.statusText} ${text}`.trim());
  }
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data: unknown = await res.json();
    let parsedText = "";
    if (data && typeof data === "object") {
      const rec = data as Record<string, unknown>;
      parsedText = String(rec.text ?? rec.result ?? rec.output ?? "");
    }
    const text = parsedText || JSON.stringify(data);
    return { text, raw: data };
  }
  const text = await res.text();
  return { text, raw: text };
}

// Utility: combine multiple abort signals (minimal polyfill)
// (removed AbortSignalAny; combined via AbortController + event forwarding)

// Expose runtime config for diagnostics (does not throw)
export type RuntimeConfig = {
  apiUrl: string;
  hasApiKey: boolean;
  timeoutMs: number;
  fieldName: string;
  useProxy: boolean;
};

export function getRuntimeConfig(): RuntimeConfig {
  const useProxy = (readEnv("USE_PROXY") || "").toLowerCase() === "true";
  const apiUrl = useProxy ? "/api/n8n" : readEnv("N8N_API_URL") || "";
  const apiKey = readEnv("N8N_API_KEY");
  const timeoutMs = Number(readEnv("REQUEST_TIMEOUT_MS") || 60000);
  const fieldName = readEnv("UPLOAD_FIELD_NAME") || "audio";
  return { apiUrl, hasApiKey: Boolean(apiKey), timeoutMs, fieldName, useProxy };
}

// Connectivity diagnostic: attempts a minimal POST to check network/CORS
export type DiagnoseResult =
  | { ok: true; status: number; statusText: string; headers: Record<string, string | null>; cfg: RuntimeConfig }
  | { ok: false; error: string; kind?: "timeout" | "network" | "other"; cfg: RuntimeConfig };

export async function diagnoseConnection(): Promise<DiagnoseResult> {
  const cfg = getRuntimeConfig();
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
      return {
        ok: false,
        error: `HTTP ${res.status} ${res.statusText}`,
        cfg,
      } as const;
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
