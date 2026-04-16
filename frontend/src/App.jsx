import { useState, useRef, useCallback } from "react";

const API = "http://localhost:8003";

const COLORS = {
  bg: "#0a0c0f",
  surface: "#111418",
  border: "#1e2530",
  accent: "#00e5ff",
  accentDim: "#00b8cc",
  danger: "#ff4d6d",
  warn: "#ffb830",
  safe: "#00e096",
  text: "#e8edf5",
  muted: "#5a6478",
  subtle: "#2a3040",
};

const styles = {
  app: {
    minHeight: "100vh",
    background: COLORS.bg,
    color: COLORS.text,
    fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "0 16px 60px",
  },
  header: {
    width: "100%",
    maxWidth: 720,
    paddingTop: 48,
    paddingBottom: 32,
    borderBottom: `1px solid ${COLORS.border}`,
    marginBottom: 40,
  },
  badge: {
    display: "inline-block",
    fontSize: 10,
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    color: COLORS.accent,
    border: `1px solid ${COLORS.accent}`,
    padding: "3px 10px",
    marginBottom: 16,
    opacity: 0.8,
  },
  title: {
    fontSize: 38,
    fontWeight: 700,
    letterSpacing: "-0.02em",
    margin: 0,
    fontFamily: "'IBM Plex Sans', sans-serif",
    color: COLORS.text,
  },
  titleAccent: { color: COLORS.accent },
  subtitle: {
    marginTop: 10,
    fontSize: 14,
    color: COLORS.muted,
    lineHeight: 1.6,
    fontFamily: "'IBM Plex Sans', sans-serif",
  },
  main: { width: "100%", maxWidth: 720 },
  card: {
    background: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    padding: 28,
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 10,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: COLORS.muted,
    marginBottom: 16,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    background: COLORS.border,
  },
  dropzone: (dragging, hasFile) => ({
    border: `2px dashed ${dragging ? COLORS.accent : hasFile ? COLORS.safe : COLORS.border}`,
    padding: "36px 24px",
    textAlign: "center",
    cursor: "pointer",
    transition: "all 0.2s",
    background: dragging ? "rgba(0,229,255,0.03)" : "transparent",
  }),
  dropIcon: {
    fontSize: 28,
    marginBottom: 12,
    display: "block",
    opacity: 0.6,
  },
  dropText: {
    fontSize: 13,
    color: COLORS.muted,
    fontFamily: "'IBM Plex Sans', sans-serif",
  },
  fileName: {
    marginTop: 12,
    fontSize: 13,
    color: COLORS.safe,
    fontFamily: "'IBM Plex Sans', sans-serif",
  },
  orDivider: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    margin: "20px 0",
    color: COLORS.muted,
    fontSize: 11,
    letterSpacing: "0.1em",
  },
  recRow: {
    display: "flex",
    gap: 10,
    alignItems: "center",
  },
  recBtn: (recording) => ({
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 20px",
    background: recording ? "rgba(255,77,109,0.1)" : "rgba(0,229,255,0.06)",
    border: `1px solid ${recording ? COLORS.danger : COLORS.accent}`,
    color: recording ? COLORS.danger : COLORS.accent,
    cursor: "pointer",
    fontSize: 12,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    fontFamily: "'IBM Plex Mono', monospace",
    transition: "all 0.2s",
    flex: 1,
  }),
  recDot: (recording) => ({
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: recording ? COLORS.danger : COLORS.accent,
    animation: recording ? "pulse 1s infinite" : "none",
  }),
  recTime: {
    fontSize: 13,
    color: COLORS.muted,
    minWidth: 40,
  },
  analyzeBtn: (disabled) => ({
    width: "100%",
    padding: "14px",
    background: disabled ? COLORS.subtle : COLORS.accent,
    color: disabled ? COLORS.muted : COLORS.bg,
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    fontFamily: "'IBM Plex Mono', monospace",
    transition: "all 0.2s",
    marginTop: 20,
  }),
  loadingBar: {
    height: 2,
    background: COLORS.border,
    overflow: "hidden",
    marginTop: 12,
  },
  loadingFill: {
    height: "100%",
    background: COLORS.accent,
    animation: "scan 1.4s ease-in-out infinite",
    width: "40%",
  },
  resultCard: (verdict) => ({
    background: COLORS.surface,
    border: `1px solid ${
      verdict === "likely synthetic" ? COLORS.danger :
      verdict === "uncertain" ? COLORS.warn : COLORS.safe
    }`,
    padding: 28,
    marginBottom: 20,
  }),
  verdictRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    flexWrap: "wrap",
    gap: 12,
  },
  verdictLabel: (verdict) => ({
    fontSize: 22,
    fontWeight: 700,
    fontFamily: "'IBM Plex Sans', sans-serif",
    color:
      verdict === "likely synthetic" ? COLORS.danger :
      verdict === "uncertain" ? COLORS.warn : COLORS.safe,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  }),
  riskScore: (score) => ({
    fontSize: 42,
    fontWeight: 700,
    color:
      score >= 60 ? COLORS.danger :
      score >= 35 ? COLORS.warn : COLORS.safe,
    lineHeight: 1,
  }),
  riskLabel: {
    fontSize: 10,
    color: COLORS.muted,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    marginTop: 2,
    textAlign: "right",
  },
  scoreBar: {
    height: 6,
    background: COLORS.subtle,
    marginBottom: 20,
    position: "relative",
  },
  scoreBarFill: (score) => ({
    height: "100%",
    width: `${score}%`,
    background:
      score >= 60 ? COLORS.danger :
      score >= 35 ? COLORS.warn : COLORS.safe,
    transition: "width 1s ease",
  }),
  summary: {
    fontSize: 14,
    color: "#a0aabf",
    lineHeight: 1.7,
    fontFamily: "'IBM Plex Sans', sans-serif",
    borderLeft: `3px solid ${COLORS.border}`,
    paddingLeft: 16,
    marginBottom: 24,
  },
  signalGrid: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  signalRow: (flagged) => ({
    display: "flex",
    gap: 14,
    padding: "14px 16px",
    background: flagged ? "rgba(255,77,109,0.04)" : "rgba(0,224,150,0.03)",
    border: `1px solid ${flagged ? "rgba(255,77,109,0.2)" : "rgba(0,224,150,0.15)"}`,
  }),
  signalIndicator: (flagged) => ({
    width: 3,
    background: flagged ? COLORS.danger : COLORS.safe,
    flexShrink: 0,
    minHeight: 40,
  }),
  signalContent: { flex: 1 },
  signalName: {
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.06em",
    marginBottom: 4,
    display: "flex",
    justifyContent: "space-between",
  },
  signalValue: (flagged) => ({
    fontSize: 11,
    color: flagged ? COLORS.danger : COLORS.safe,
    fontFamily: "'IBM Plex Mono', monospace",
  }),
  signalExplanation: {
    fontSize: 12,
    color: COLORS.muted,
    lineHeight: 1.6,
    fontFamily: "'IBM Plex Sans', sans-serif",
  },
  resetBtn: {
    padding: "10px 24px",
    background: "transparent",
    border: `1px solid ${COLORS.border}`,
    color: COLORS.muted,
    cursor: "pointer",
    fontSize: 11,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    fontFamily: "'IBM Plex Mono', monospace",
    marginTop: 8,
    transition: "all 0.2s",
  },
  disclaimer: {
    marginTop: 32,
    padding: "16px 20px",
    background: "rgba(255,184,48,0.04)",
    border: `1px solid rgba(255,184,48,0.15)`,
    fontSize: 12,
    color: COLORS.muted,
    lineHeight: 1.7,
    fontFamily: "'IBM Plex Sans', sans-serif",
  },
};

function useRecorder() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState(null);
  const [wavFile, setWavFile] = useState(null);
  const mediaRef = useRef(null);
  const timerRef = useRef(null);
  const chunksRef = useRef([]);

  const encodeWavMono16 = (samples, sampleRate) => {
    const numChannels = 1;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = samples.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeString = (offset, str) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };

    // RIFF header
    writeString(0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, "WAVE");

    // fmt chunk
    writeString(12, "fmt ");
    view.setUint32(16, 16, true); // PCM
    view.setUint16(20, 1, true); // audio format = PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);

    // data chunk
    writeString(36, "data");
    view.setUint32(40, dataSize, true);

    // PCM samples
    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
    return buffer;
  };

  const blobToWavFile = async (inputBlob, targetSampleRate = 22050) => {
    const arrayBuf = await inputBlob.arrayBuffer();
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) throw new Error("AudioContext not supported in this browser");

    const ctx = new AudioCtx();
    try {
      const decoded = await ctx.decodeAudioData(arrayBuf.slice(0));

      // downmix to mono
      const toMono = () => {
        if (decoded.numberOfChannels === 1) return decoded.getChannelData(0);
        const len = decoded.length;
        const out = new Float32Array(len);
        for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
          const data = decoded.getChannelData(ch);
          for (let i = 0; i < len; i++) out[i] += data[i];
        }
        for (let i = 0; i < len; i++) out[i] /= decoded.numberOfChannels;
        return out;
      };

      const mono = toMono();

      // resample if needed
      let finalSamples = mono;
      let finalRate = decoded.sampleRate;
      if (decoded.sampleRate !== targetSampleRate) {
        const frameCount = Math.ceil((decoded.duration || (decoded.length / decoded.sampleRate)) * targetSampleRate);
        const offline = new OfflineAudioContext(1, frameCount, targetSampleRate);
        const buf = offline.createBuffer(1, mono.length, decoded.sampleRate);
        buf.copyToChannel(mono, 0);
        const source = offline.createBufferSource();
        source.buffer = buf;
        source.connect(offline.destination);
        source.start(0);
        const rendered = await offline.startRendering();
        finalSamples = rendered.getChannelData(0);
        finalRate = targetSampleRate;
      }

      const wavArrayBuffer = encodeWavMono16(finalSamples, finalRate);
      return new File([wavArrayBuffer], "recording.wav", { type: "audio/wav" });
    } finally {
      // avoid leaving an audio device active
      try { await ctx.close(); } catch { /* noop */ }
    }
  };

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const preferredMime =
      MediaRecorder.isTypeSupported?.("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : undefined;
    const mr = preferredMime ? new MediaRecorder(stream, { mimeType: preferredMime }) : new MediaRecorder(stream);
    chunksRef.current = [];
    mr.ondataavailable = (e) => chunksRef.current.push(e.data);
    mr.onstop = async () => {
      const b = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
      setBlob(b);
      try {
        const wav = await blobToWavFile(b, 22050);
        setWavFile(wav);
      } catch {
        // Fallback: keep blob only; backend may still accept if it can decode
        setWavFile(null);
      } finally {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
    mr.start();
    mediaRef.current = mr;
    setRecording(true);
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  }, []);

  const stop = useCallback(() => {
    mediaRef.current?.stop();
    clearInterval(timerRef.current);
    setRecording(false);
  }, []);

  return {
    recording,
    seconds,
    blob,
    wavFile,
    start,
    stop,
    reset: () => {
      setBlob(null);
      setWavFile(null);
      setSeconds(0);
    },
  };
}

export default function App() {
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const rec = useRecorder();

  const audioFile = file || rec.wavFile || (rec.blob ? new File([rec.blob], "recording.webm", { type: rec.blob.type || "audio/webm" }) : null);

  const analyze = async () => {
    if (!audioFile) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", audioFile);
      const res = await fetch(`${API}/analyze`, { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Analysis failed");
      }
      setResult(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFile(null); setResult(null); setError(null);
    rec.reset();
  };

  const onDrop = (e) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&family=IBM+Plex+Sans:wght@400;500;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0c0f; }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
        @keyframes scan { 0% { transform: translateX(-100%); } 100% { transform: translateX(350%); } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .result-in { animation: fadeIn 0.4s ease forwards; }
      `}</style>
      <div style={styles.app}>
        <div style={styles.header}>
          <div style={styles.badge}>acoustic forensics tool</div>
          <h1 style={styles.title}>
            Voice<span style={styles.titleAccent}>Check</span>
          </h1>
          <p style={styles.subtitle}>
            Detect AI voice cloning artifacts using signal processing — MFCC analysis,
            spectral flatness, pitch variance, and zero-crossing patterns.
          </p>
        </div>

        <div style={styles.main}>
          {!result ? (
            <div style={styles.card}>
              <div style={styles.sectionLabel}>
                <span>input audio</span>
                <div style={styles.sectionLine} />
              </div>

              {/* Drop zone */}
              <div
                style={styles.dropzone(dragging, !!file)}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
              >
                <span style={styles.dropIcon}>⬡</span>
                <div style={styles.dropText}>
                  Drop an audio file here or click to browse
                  <br />
                  <span style={{ fontSize: 11, opacity: 0.6 }}>WAV · MP3 · M4A · WebM · OGG</span>
                </div>
                {file && <div style={styles.fileName}>✓ {file.name}</div>}
                <input
                  ref={inputRef}
                  type="file"
                  accept="audio/*"
                  style={{ display: "none" }}
                  onChange={(e) => e.target.files[0] && setFile(e.target.files[0])}
                />
              </div>

              <div style={styles.orDivider}>
                <div style={styles.sectionLine} />
                <span>or record live</span>
                <div style={styles.sectionLine} />
              </div>

              <div style={styles.recRow}>
                <button
                  style={styles.recBtn(rec.recording)}
                  onClick={rec.recording ? rec.stop : rec.start}
                >
                  <div style={styles.recDot(rec.recording)} />
                  {rec.recording ? "Stop recording" : "Start recording"}
                </button>
                {rec.seconds > 0 && (
                  <span style={styles.recTime}>{rec.seconds}s</span>
                )}
                {rec.blob && !rec.recording && (
                  <span style={{ fontSize: 12, color: COLORS.safe }}>
                    ✓ recorded {rec.seconds}s
                  </span>
                )}
              </div>

              <button
                style={styles.analyzeBtn(!audioFile || loading)}
                disabled={!audioFile || loading}
                onClick={analyze}
              >
                {loading ? "analyzing..." : "run analysis →"}
              </button>

              {loading && (
                <div style={styles.loadingBar}>
                  <div style={styles.loadingFill} />
                </div>
              )}
              {error && (
                <div style={{ marginTop: 12, fontSize: 12, color: COLORS.danger }}>
                  Error: {error}
                </div>
              )}
            </div>
          ) : (
            <div className="result-in">
              <div style={styles.resultCard(result.verdict)}>
                <div style={styles.sectionLabel}>
                  <span>analysis result</span>
                  <div style={styles.sectionLine} />
                </div>

                <div style={styles.verdictRow}>
                  <div style={styles.verdictLabel(result.verdict)}>
                    {result.verdict}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={styles.riskScore(result.risk_score)}>
                      {result.risk_score}
                    </div>
                    <div style={styles.riskLabel}>risk score / 100</div>
                  </div>
                </div>

                <div style={styles.scoreBar}>
                  <div style={styles.scoreBarFill(result.risk_score)} />
                </div>

                <p style={styles.summary}>{result.summary}</p>

                <div style={styles.sectionLabel}>
                  <span>signal breakdown</span>
                  <div style={styles.sectionLine} />
                </div>

                <div style={styles.signalGrid}>
                  {result.signals.map((s) => (
                    <div key={s.name} style={styles.signalRow(s.flagged)}>
                      <div style={styles.signalIndicator(s.flagged)} />
                      <div style={styles.signalContent}>
                        <div style={styles.signalName}>
                          <span>{s.name}</span>
                          <span style={styles.signalValue(s.flagged)}>
                            {s.flagged ? "⚑ flagged" : "✓ normal"} · {s.value}
                          </span>
                        </div>
                        <div style={styles.signalExplanation}>{s.explanation}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button style={styles.resetBtn} onClick={reset}>
                ← analyze another clip
              </button>
            </div>
          )}

          <div style={styles.disclaimer}>
            <strong style={{ color: COLORS.warn }}>Research tool.</strong>{" "}
            VoiceCheck uses heuristic signal-processing features — not a ground-truth classifier.
            Scores should be treated as supporting evidence, not definitive verdicts.
            Short clips (&lt;3s) and noisy environments reduce reliability.
          </div>
        </div>
      </div>
    </>
  );
}