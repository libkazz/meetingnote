import React, { useState } from "react";
import AudioRecorder from "./components/AudioRecorder";
import SummaryPanel from "./components/SummaryPanel";

export default function App() {
  const [summaryText, setSummaryText] = useState("");
  return (
    <div className="container">
      <header className="header">
        <div className="brand">Meeting Note</div>
      </header>
      <section className="card stack">
        <p className="hint">Record in the browser, send to n8n for transcription.</p>
        <AudioRecorder onTranscriptChange={setSummaryText} />
      </section>
      <SummaryPanel value={summaryText} onChange={setSummaryText} />
    </div>
  );
}
