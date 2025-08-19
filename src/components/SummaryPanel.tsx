import React, { useEffect, useState } from "react";
import { summarizeText } from "../lib/api/summary-client";
import { useToast } from "../hooks/use-toast";

type Props = { value?: string; onChange?: (v: string) => void; meetingId?: string };

export default function SummaryPanel({ value, onChange, meetingId }: Props) {
  const [target, setTarget] = useState("");
  const [previous, setPrevious] = useState("");
  const [result, setResult] = useState("");
  const [status, setStatus] = useState("");
  const [running, setRunning] = useState(false);
  const { toast, showToast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const saveTimerRef = React.useRef<number | null>(null);

  // Sync internal state with controlled value if provided
  useEffect(() => {
    if (typeof value === "string") setTarget(value);
  }, [value]);

  // Load persisted summary result when meetingId changes
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (!meetingId) return;
        const { loadLatestResult } = await import("../lib/storage/persist");
        const latest = await loadLatestResult(meetingId);
        if (!cancelled) setResult(latest);
      } catch {
        // ignore
      }
    }
    load();
    return () => { cancelled = true; };
  }, [meetingId]);

  // Auto-save summary result (debounced 600ms)
  useEffect(() => {
    if (!meetingId) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(async () => {
      try {
        const { saveResultRevision } = await import("../lib/storage/persist");
        await saveResultRevision(meetingId, result);
      } catch {
        // ignore
      }
    }, 600);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [result, meetingId]);

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
      {/* Summary title removed to save vertical space */}
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
          rows={6}
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
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
          <span>Summary result</span>
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); setExpanded(true); }}
            className="hint"
            aria-label="Expand summary result"
          >
            Expand
          </a>
        </div>
        <textarea
          id="summaryResult"
          value={result}
          onChange={(e) => setResult(e.target.value)}
          rows={12}
          style={{ width: "100%" }}
        />
      </label>
      {expanded && (
        <div
          data-testid="summary-overlay"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 1000,
            display: "grid",
            gridTemplateRows: "auto 1fr",
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="row" style={{ padding: 12, background: "var(--panel)", borderBottom: "1px solid rgba(148,163,184,0.15)" }}>
            <span className="brand">Meeting note</span>
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); setExpanded(false); }}
              className="hint"
              style={{ marginLeft: "auto" }}
              aria-label="Shrink summary result"
            >
              Shrink
            </a>
          </div>
          <div style={{ padding: 12, background: "var(--panel-muted)" }}>
            <textarea
              id="summaryResultExpanded"
              value={result}
              onChange={(e) => setResult(e.target.value)}
              style={{ width: "100%", height: "calc(100vh - 80px)" }}
            />
          </div>
        </div>
      )}
      
      <div className="toaster" aria-live="polite">
        {toast && <div className="toast">{toast}</div>}
      </div>
    </div>
  );
}
