import { fetchWithTimeout, getRuntimeConfig, readEnv } from "./n8n-common";

type TranscribeResult = { text: string; raw: unknown };

let __fileSeq = 0; // unique file sequence per session

function inferExtension(mime: string): string {
  const t = (mime || "").toLowerCase();
  if (t.includes("ogg")) return "ogg";
  if (t.includes("webm")) return "webm";
  if (t.includes("wav")) return "wav";
  if (t.includes("mp4") || t.includes("m4a") || t.includes("aac")) return "m4a";
  return "bin";
}

export async function transcribeAudio(
  fileOrBlob: Blob,
  options?: { apiUrl?: string; apiKey?: string; signal?: AbortSignal; timeoutMs?: number; fields?: Record<string, string | number | boolean> }
): Promise<TranscribeResult> {
  const cfg = getRuntimeConfig("N8N_TRANSCRIBE_URL", "/api/n8n/transcribe");
  const apiUrl = options?.apiUrl || cfg.apiUrl;
  const apiKey = options?.apiKey || (readEnv("N8N_API_KEY") || undefined);
  const timeoutMs = options?.timeoutMs ?? cfg.timeoutMs;
  if (!apiUrl) throw new Error("N8N_TRANSCRIBE_URL is not set");

  const form = new FormData();
  const fieldName = readEnv("UPLOAD_FIELD_NAME") || cfg.fieldName || "audio";
  const file = fileOrBlob instanceof File
    ? fileOrBlob
    : (() => {
        const type = (fileOrBlob as Blob).type || "audio/webm";
        const ext = inferExtension(type);
        const name = `recording-${Date.now()}-${++__fileSeq}.${ext}`;
        return new File([fileOrBlob], name, { type });
      })();
  form.append(fieldName, file);
  form.append("filename", file.name);
  if (options?.fields) {
    for (const [k, v] of Object.entries(options.fields)) form.append(k, String(v));
  }

  let res: Response;
  try {
    res = await fetchWithTimeout(apiUrl, {
      method: "POST",
      body: form,
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
      signal: options?.signal,
    }, timeoutMs);
  } catch (err) {
    throw err as Error;
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

export { getRuntimeConfig } from "./n8n-common";
export type { RuntimeConfig, DiagnoseResult } from "./n8n-common";
export { diagnoseConnection, readEnv } from "./n8n-common";
