import React, { useState } from "react";
import { summarizeText } from "../lib/api/summary-client";
import { useToast } from "../hooks/use-toast";

export default function SummaryPanel() {
  const [target, setTarget] = useState("");
  const [previous, setPrevious] = useState("");
  const [result, setResult] = useState("");
  const [status, setStatus] = useState("");
  const [running, setRunning] = useState(false);
  const { toast, showToast } = useToast();

  async function onSummarize() {
    if (!target.trim()) return;
    setRunning(true);
    setStatus("Summarizing...");
    try {
      const out = await summarizeText(target, { fields: { context: previous } });
      setResult(out.text);
      setStatus("Done");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(msg);
      showToast(`Error: ${msg}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="card stack">
      <div className="row">
        <div className="brand">Summary</div>
      </div>
      <label className="hint" htmlFor="summaryTarget" style={{ display: "grid" }}>
        Text to summarize
        <textarea
          id="summaryTarget"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
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
          🧠 Summarize
        </button>
        <div className="status" aria-live="polite">{status}</div>
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
    </section>
  );
}

