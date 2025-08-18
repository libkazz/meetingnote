import React from "react";
import AudioRecorder from "./components/AudioRecorder";

export default function App() {
  return (
    <div className="container">
      <header className="header">
        <div className="brand">Meeting Note</div>
      </header>
      <section className="card stack">
        <p className="hint">
          Record in the browser, send to n8n for transcription. Please set
        <code>VITE_N8N_TRANSCRIBE_URL</code> (and <code>VITE_N8N_API_KEY</code>
        if needed) in your <code>.env</code> file.
        </p>
        <AudioRecorder />
      </section>
    </div>
  );
}
