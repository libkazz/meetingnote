import React from "react";

type Props = {
  text: string;
  onCopy: () => void;
  onDownload: () => void;
};

export default function TranscriptActions({ text, onCopy, onDownload }: Props) {
  if (!text) return null;
  return (
    <>
      <div className="toolbar">
        <button className="btn btn-secondary" onClick={onCopy}>📋 Copy</button>
        <button className="btn btn-secondary" onClick={onDownload}>💾 Download</button>
      </div>
      <pre style={{ whiteSpace: "pre-wrap" }}>{text}</pre>
    </>
  );
}

