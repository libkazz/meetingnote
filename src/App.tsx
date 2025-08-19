import React, { useState } from "react";
import AudioRecorder from "./components/AudioRecorder";
import SummaryPanel from "./components/SummaryPanel";
import DiagnosticsPanel from "./components/DiagnosticsPanel";

export default function App() {
  const [summaryText, setSummaryText] = useState("");
  const [advMerging, setAdvMerging] = useState(false);
  const mergeApiRef = React.useRef<{ mergeNow: () => Promise<void> } | null>(null);
  return (
    <div className="container">
      <header className="header">
        <div className="brand">Meeting Note</div>
      </header>
      <section className="card stack">
        <p className="hint">Record in the browser, send to n8n for transcription.</p>
        <AudioRecorder
          onTranscriptChange={setSummaryText}
          onReady={(api) => { mergeApiRef.current = api; }}
        />
        <SummaryPanel value={summaryText} onChange={setSummaryText} />
      </section>
      <hr />
      <details>
        <summary className="hint">Advanced</summary>
        <div className="stack" style={{ marginTop: 12 }}>
          <div className="toolbar">
            <button
              className="btn btn-secondary"
              onClick={async () => {
                if (!mergeApiRef.current) return;
                try { setAdvMerging(true); await mergeApiRef.current.mergeNow(); }
                finally { setAdvMerging(false); }
              }}
              disabled={advMerging}
            >
              {advMerging ? "🔗 Merging..." : "🔗 Merge Audio Now"}
            </button>
          </div>
          <DiagnosticsPanel />
        </div>
      </details>
    </div>
  );
}
