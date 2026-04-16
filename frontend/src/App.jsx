import { useMemo, useRef, useState } from "react";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const verdictClass = {
  "likely synthetic": "danger",
  uncertain: "warn",
  "likely human": "safe",
};

function scoreClass(score) {
  if (score >= 60) return "danger";
  if (score >= 35) return "warn";
  return "safe";
}

export default function App() {
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [seconds, setSeconds] = useState(0);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const inputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const timerRef = useRef(null);
  const chunksRef = useRef([]);

  const chosenAudio = useMemo(() => {
    if (file) return file;
    if (!recordedBlob) return null;
    return new File([recordedBlob], "recording.webm", { type: recordedBlob.type || "audio/webm" });
  }, [file, recordedBlob]);

  const onPickFile = (picked) => {
    if (!picked) return;
    setFile(picked);
    setRecordedBlob(null);
    setResult(null);
    setError("");
  };

  const onDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    onPickFile(event.dataTransfer.files?.[0]);
  };

  const startRecording = async () => {
    setError("");
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => chunksRef.current.push(event.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setRecordedBlob(blob);
        setFile(null);
        stream.getTracks().forEach((track) => track.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((prev) => prev + 1), 1000);
    } catch (err) {
      setError(err?.message || "Microphone access failed.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
  };

  const analyze = async () => {
    if (!chosenAudio || loading) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const body = new FormData();
      body.append("file", chosenAudio);
      const response = await fetch(`${API_BASE}/analyze`, { method: "POST", body });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.detail || "Analysis failed");
      setResult(payload);
    } catch (err) {
      setError(err?.message || "Analysis request failed.");
    } finally {
      setLoading(false);
    }
  };

  const resetAll = () => {
    setFile(null);
    setRecordedBlob(null);
    setSeconds(0);
    setResult(null);
    setError("");
    setLoading(false);
  };

  return (
    <main className="page">
      <section className="card hero">
        <p className="eyebrow">voice detection demo</p>
        <h1>VoiceCheck</h1>
        <p className="sub">
          Upload or record speech and run a backend analysis for likely human vs synthetic voice traits.
        </p>
      </section>

      {!result ? (
        <section className="card">
          <div
            className={`dropzone ${dragging ? "dragging" : ""} ${file ? "has-file" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
          >
            <p className="drop-main">{file ? `Selected: ${file.name}` : "Drop an audio file or click to browse"}</p>
            <p className="drop-sub">Supports audio file formats accepted by your backend.</p>
            <input
              ref={inputRef}
              type="file"
              accept="audio/*"
              hidden
              onChange={(event) => onPickFile(event.target.files?.[0])}
            />
          </div>

          <div className="divider">or</div>

          <div className="row">
            <button className={`button ${recording ? "danger" : ""}`} onClick={recording ? stopRecording : startRecording}>
              {recording ? "Stop recording" : "Start recording"}
            </button>
            <span className="muted">{seconds > 0 ? `${seconds}s` : ""}</span>
          </div>

          <button className="button primary" disabled={!chosenAudio || loading} onClick={analyze}>
            {loading ? "Analyzing..." : "Run analysis"}
          </button>

          {error ? <p className="error">{error}</p> : null}
        </section>
      ) : (
        <section className={`card result ${verdictClass[result.verdict] || "warn"}`}>
          <div className="result-head">
            <div>
              <p className="eyebrow">verdict</p>
              <h2>{result.verdict}</h2>
            </div>
            <div className={`score ${scoreClass(result.risk_score)}`}>{result.risk_score}</div>
          </div>

          <p className="summary">{result.summary}</p>

          <div className="signals">
            {result.signals?.map((signal) => (
              <article key={signal.name} className={`signal ${signal.flagged ? "flagged" : "normal"}`}>
                <div className="signal-head">
                  <strong>{signal.name}</strong>
                  <span>
                    {signal.flagged ? "flagged" : "normal"} - {signal.value}
                  </span>
                </div>
                <p>{signal.explanation}</p>
              </article>
            ))}
          </div>

          <button className="button" onClick={resetAll}>
            Analyze another clip
          </button>
        </section>
      )}
    </main>
  );
}
