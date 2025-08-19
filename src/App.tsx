import React, { useState } from "react";
import AudioRecorder from "./components/AudioRecorder";
import SummaryPanel from "./components/SummaryPanel";
import DiagnosticsPanel from "./components/DiagnosticsPanel";

export default function App() {
  const [summaryText, setSummaryText] = useState("");
  const [advMerging, setAdvMerging] = useState(false);
  const mergeApiRef = React.useRef<{ mergeNow: () => Promise<void>; meetingId: string } | null>(null);
  const [meetingId, setMeetingId] = useState<string>("");
  return (
    <div className="container">
      <header className="header">
        <div className="brand">Meeting Note</div>
      </header>
      <p className="hint">Record in the browser, send for transcription.</p>
      <section className="card stack">
        <AudioRecorder
          onTranscriptChange={setSummaryText}
          onReady={(api) => { mergeApiRef.current = api; setMeetingId(api.meetingId); }}
        />
        <SummaryPanel value={summaryText} onChange={setSummaryText} />
      </section>
      <hr />
      <details>
        <summary className="hint">Advanced</summary>
        <div className="stack" style={{ marginTop: 12 }}>
          <div className="row">
            <div className="hint">Meeting ID: {meetingId || '—'}</div>
          </div>
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
          <DiagnosticsPanel bare />
        </div>
      </details>
    </div>
  );
}
