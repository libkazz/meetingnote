import React, { useState } from "react";
import { diagnoseConnection, getRuntimeConfig } from "../lib/api/n8n-common";
import type { DiagnoseResult } from "../lib/api/n8n-common";

export default function DiagnosticsPanel() {
  const [status, setStatus] = useState("");
  const [diag, setDiag] = useState<DiagnoseResult | null>(null);
  async function run() {
    setStatus("Running connection diagnostics...");
    const info = await diagnoseConnection();
    setDiag(info);
    setStatus("");
  }
  return (
    <details>
      <summary className="hint">Connection Diagnostics</summary>
      <div className="toolbar" style={{ margin: "8px 0" }}>
        <button className="btn btn-ghost" onClick={run}>🔎 Run Diagnostics</button>
        <div className="status" aria-live="polite">{status}</div>
      </div>
      <pre style={{ whiteSpace: "pre-wrap" }}>
{JSON.stringify({ env: getRuntimeConfig(), result: diag }, null, 2)}
      </pre>
    </details>
  );
}
