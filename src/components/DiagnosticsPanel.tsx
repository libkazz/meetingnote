import React, { useState } from "react";
import { diagnoseConnection, getRuntimeConfig } from "../lib/api/n8n-common";
import type { DiagnoseResult } from "../lib/api/n8n-common";

type Props = { bare?: boolean };

export default function DiagnosticsPanel({ bare }: Props) {
  const [status, setStatus] = useState("");
  const [diag, setDiag] = useState<DiagnoseResult | null>(null);
  async function run() {
    setStatus("Running connection diagnostics...");
    const info = await diagnoseConnection();
    setDiag(info);
    setStatus("");
  }
  const content = (
    <>
      <div className="toolbar" style={{ margin: "8px 0" }}>
        <button className="btn btn-ghost" onClick={run}>🔎 Run Diagnostics</button>
        <div className="status" aria-live="polite">{status}</div>
      </div>
      <pre style={{ whiteSpace: "pre-wrap" }}>
{JSON.stringify({ env: getRuntimeConfig(), result: diag }, null, 2)}
      </pre>
    </>
  );
  if (bare) return content;
  return (
    <details>
      <summary className="hint">Connection Diagnostics</summary>
      {content}
    </details>
  );
}
