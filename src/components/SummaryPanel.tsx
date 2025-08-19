import React, { useEffect, useState } from "react";
import { summarizeText } from "../lib/api/summary-client";
import { useToast } from "../hooks/use-toast";

type Props = { value?: string; onChange?: (v: string) => void };

export default function SummaryPanel({ value, onChange }: Props) {
  const [target, setTarget] = useState("");
  const [previous, setPrevious] = useState("");
  const [result, setResult] = useState("");
  const [status, setStatus] = useState("");
  const [running, setRunning] = useState(false);
  const { toast, showToast } = useToast();

  // Sync internal state with controlled value if provided
  useEffect(() => {
    if (typeof value === "string") setTarget(value);
  }, [value]);

  async function onSummarize() {
    if (!target.trim()) return;
    setRunning(true);
    setStatus("Summarizing...");
    try {
      const out = await summarizeText(target, { fields: { context: previous } });
      const msgContent = (() => {
        const raw = out.raw as unknown;
        if (raw && typeof raw === "object" && "message" in (raw as Record<string, unknown>)) {
          const m = (raw as { message?: unknown }).message;
          if (m && typeof m === "object" && "content" in (m as Record<string, unknown>)) {
            const c = (m as { content?: unknown }).content;
            if (typeof c === "string") return c as string;
          }
        }
        return typeof out.raw === "string" ? (out.raw as string) : out.text;
      })();
      const normalized = msgContent
        // convert escaped newlines ("\\n" / "\\r\\n") into actual newlines
        .replace(/\\r\\n/g, "\n")
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\n")
        // normalize any actual CRLF to LF
        .replace(/\r\n/g, "\n");
      setResult(normalized);
      // Do not show "Done" next to the Summarize button; keep status empty on success
      setStatus("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(msg);
      showToast(`Error: ${msg}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="stack">
      <div className="row">
        <div className="brand">Summary</div>
      </div>
      <label className="hint" htmlFor="summaryTarget" style={{ display: "grid" }}>
        Text to summarize
        <textarea
          id="summaryTarget"
          value={typeof value === "string" ? value : target}
          onChange={(e) => {
            if (onChange) onChange(e.target.value);
            else setTarget(e.target.value);
          }}
          rows={6}
          style={{ width: "100%" }}
        />
      </label>
      <label className="hint" htmlFor="summaryPrevious" style={{ display: "grid" }}>
        Previous content (optional)
        <textarea
          id="summaryPrevious"
          value={previous}
          onChange={(e) => setPrevious(e.target.value)}
          rows={4}
          style={{ width: "100%" }}
        />
      </label>
      <div className="row">
        <button className="btn" onClick={onSummarize} disabled={running || !target.trim()}>
          {running ? "🧠 Summarizing..." : "🧠 Summarize"}
        </button>
        <div className="status" aria-live="polite">{status}</div>
        <div style={{ marginLeft: "auto" }}>
          <button
            className="btn btn-secondary"
            onClick={() => { setPrevious(result); showToast("Copied summary to previous"); }}
            disabled={!result.trim() || running}
          >
            📎 Copy result to previous
          </button>
        </div>
      </div>
      <label className="hint" htmlFor="summaryResult" style={{ display: "grid" }}>
        Summary result
        <textarea
          id="summaryResult"
          value={result}
          onChange={(e) => setResult(e.target.value)}
          rows={8}
          style={{ width: "100%" }}
        />
      </label>
      
      <div className="toaster" aria-live="polite">
        {toast && <div className="toast">{toast}</div>}
      </div>
    </div>
  );
}
