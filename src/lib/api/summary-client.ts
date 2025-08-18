import { fetchWithTimeout, getRuntimeConfig, readEnv } from "./n8n-common";

export type SummaryResult = { text: string; raw: unknown };

/**
 * Sends input text to the n8n summary endpoint and returns summarized text.
 * Defaults to FormData with field name `text` (override via options.fields or env if needed).
 */
export async function summarizeText(
  input: string,
  options?: { apiUrl?: string; apiKey?: string; timeoutMs?: number; fields?: Record<string, string | number | boolean> }
): Promise<SummaryResult> {
  const cfg = getRuntimeConfig("N8N_SUMMARY_URL", "/api/n8n/summary");
  const apiUrl = options?.apiUrl || cfg.apiUrl;
  const apiKey = options?.apiKey || (readEnv("N8N_API_KEY") || undefined);
  const timeoutMs = options?.timeoutMs ?? cfg.timeoutMs;
  if (!apiUrl) throw new Error("N8N_SUMMARY_URL is not set");

  const form = new FormData();
  // default field name is `text` for summary use-case
  const fieldName = "text";
  form.append(fieldName, input);
  if (options?.fields) {
    for (const [k, v] of Object.entries(options.fields)) form.append(k, String(v));
  }

  const res = await fetchWithTimeout(
    apiUrl,
    {
      method: "POST",
      body: form,
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
    },
    timeoutMs
  );

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
export type { RuntimeConfig } from "./n8n-common";
