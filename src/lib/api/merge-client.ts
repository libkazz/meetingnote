import { fetchWithTimeout, getRuntimeConfig, readEnv } from "./n8n-common";

export type MergeAudioResult = { audio_link_url: string; raw: unknown };

/**
 * Triggers merge-audio workflow on n8n. Sends meeting_id via PUT.
 */
export async function mergeAudio(
  meetingId: string,
  options?: { apiUrl?: string; apiKey?: string; timeoutMs?: number }
): Promise<MergeAudioResult> {
  const cfg = getRuntimeConfig("N8N_MERGE_AUDIO_URL", "/api/n8n/merge-audio");
  const apiUrl = options?.apiUrl || cfg.apiUrl;
  const apiKey = options?.apiKey || (readEnv("N8N_API_KEY") || undefined);
  const timeoutMs = options?.timeoutMs ?? cfg.timeoutMs;
  if (!apiUrl) throw new Error("N8N_MERGE_AUDIO_URL is not set");

  const res = await fetchWithTimeout(
    apiUrl,
    {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({ meeting_id: meetingId }),
    },
    timeoutMs
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`n8n merge-audio failed: ${res.status} ${res.statusText} ${text}`.trim());
  }

  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = await res.text();
    return { audio_link_url: text, raw: text };
  }
  const data: unknown = await res.json();
  let url = "";
  if (data && typeof data === "object" && "audio_link_url" in (data as Record<string, unknown>)) {
    url = String((data as { audio_link_url?: unknown }).audio_link_url ?? "");
  }
  return { audio_link_url: url, raw: data };
}

export { getRuntimeConfig } from "./n8n-common";
export type { RuntimeConfig } from "./n8n-common";

