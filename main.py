import os

# Disable librosa cache in sandboxed/runtime-constrained environments.
os.environ.setdefault("LIBROSA_CACHE_LEVEL", "0")
os.environ.setdefault("NUMBA_DISABLE_JIT", "1")

import numpy as np
import librosa
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import tempfile, io
from typing import List

app = FastAPI(title="VoiceCheck API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Feature extraction ───
# Concepts drawn directly from EECS16A voice recognition/Shazam labs:
#   - STFT / spectrogram  → same as lab fingerprinting pipeline
#   - MFCCs → mel-frequency cepstral coefficients, speech feature lab
#   - Spectral peaks → constellation map step from Shazam lab
#   - Pitch / F0 → aps lab

def extract_features(y: np.ndarray, sr: int) -> dict:
    """
    Extract acoustic features using the same signal-processing pipeline
    from EECS16A Shazam + voice recognition lab: FFT → spectrogram → MFCC → spectral stats.
    """
    # 1. Short-Time Fourier Transform → spectrogram (Shazam)
    S = np.abs(librosa.stft(y, n_fft=2048, hop_length=512))
    S_db = librosa.amplitude_to_db(S, ref=np.max)

    # 2. MFCCs — 13 coefficients, same as voice classification lab
    mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    mfcc_mean = np.mean(mfccs, axis=1)
    mfcc_var  = np.var(mfccs,  axis=1)

    # 3. Spectral features — TTS/voice-clone artifacts show up as unnatural
    #    flatness (too smooth) and unusual centroid drift
    spectral_centroid  = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    spectral_flatness  = librosa.feature.spectral_flatness(y=y)[0]
    spectral_bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr)[0]
    spectral_rolloff   = librosa.feature.spectral_rolloff(y=y, sr=sr)[0]

    # 4. Zero-crossing rate — cloned voices often show low variability
    zcr = librosa.feature.zero_crossing_rate(y)[0]

    # 5. Pitch (F0) via pyin — voice cloners struggle with natural F0 variance
    f0, voiced_flag, _ = librosa.pyin(
        y, fmin=librosa.note_to_hz("C2"), fmax=librosa.note_to_hz("C7")
    )
    f0_clean = f0[voiced_flag] if voiced_flag is not None and voiced_flag.any() else np.array([0.0])

    return {
        "mfcc_mean": mfcc_mean.tolist(),
        "mfcc_var":  mfcc_var.tolist(),
        "spectral_centroid_mean":  float(np.mean(spectral_centroid)),
        "spectral_centroid_std":   float(np.std(spectral_centroid)),
        "spectral_flatness_mean":  float(np.mean(spectral_flatness)),
        "spectral_flatness_std":   float(np.std(spectral_flatness)),
        "spectral_bandwidth_mean": float(np.mean(spectral_bandwidth)),
        "spectral_rolloff_mean":   float(np.mean(spectral_rolloff)),
        "zcr_mean":  float(np.mean(zcr)),
        "zcr_std":   float(np.std(zcr)),
        "f0_mean":   float(np.mean(f0_clean)),
        "f0_std":    float(np.std(f0_clean)),
        "f0_voiced_ratio": float(np.mean(voiced_flag)) if voiced_flag is not None else 0.0,
        "duration":  float(len(y) / sr),
    }


# ─── Heuristic classifier ────
# A threshold-based scorer over the extracted features.
# Each rule targets a known artifact of TTS/voice-clone synthesis.
# Returns: list of signal dicts + overall risk score 0–100.

class Signal(BaseModel):
    name: str
    flagged: bool
    value: float
    explanation: str

class AnalysisResult(BaseModel):
    risk_score: int          # 0–100
    verdict: str             # "likely human" | "uncertain" | "likely synthetic"
    signals: List[Signal]
    summary: str

def score(features: dict) -> AnalysisResult:
    signals = []
    flagged_count = 0
    weighted_points = 0.0
    max_points = 0.0

    # ─── Signal 1: Spectral flatness (too smooth = synthetic) ───
    sf_mean = features["spectral_flatness_mean"]
    sf_std  = features["spectral_flatness_std"]
    # Real speech: high variance flatness (voiced/unvoiced transitions)
    # Cloned:      unusually flat/smooth spectrum across frames
    s1_weight = 1.0
    s1_flagged = sf_std < 0.02
    signals.append(Signal(
        name="Spectral flatness variance",
        flagged=s1_flagged,
        value=round(sf_std, 4),
        explanation=(
            "Low variance in spectral flatness suggests an unnaturally smooth frequency profile. "
            "Human speech has sharp voiced/unvoiced transitions that create high flatness variance. "
            "Voice cloning models often over-smooth this."
            if s1_flagged else
            "Normal spectral flatness variance, consistent with natural voiced/unvoiced transitions."
        )
    ))
    if s1_flagged:
        flagged_count += 1
        weighted_points += s1_weight
    max_points += s1_weight

    # --- Signal 2: F0 (pitch) standard deviation ---
    f0_std = features["f0_std"]
    # Real speech: rich natural pitch variation (std > 20 Hz)
    # Cloned:      overly regular or too flat
    s2_weight = 1.25
    s2_flagged = f0_std < 25.0 and features["f0_voiced_ratio"] > 0.3
    signals.append(Signal(
        name="Pitch (F0) naturalness",
        flagged=s2_flagged,
        value=round(f0_std, 2),
        explanation=(
            f"Pitch standard deviation of {f0_std:.1f} Hz is unusually low. "
            "Natural speech has significant pitch variation driven by prosody and emotion. "
            "Synthesis models tend to produce flatter, more monotone pitch contours."
            if s2_flagged else
            f"Pitch variation of {f0_std:.1f} Hz is within normal range for human speech."
        )
    ))
    if s2_flagged:
        flagged_count += 1
        weighted_points += s2_weight
    max_points += s2_weight

    # --- Signal 3: MFCC coefficient variance (vocal tract naturalness) ---
    mfcc_var_mean = float(np.mean(features["mfcc_var"]))
    # Cloned voices: lower MFCC variance = less dynamic vocal tract movement
    s3_weight = 1.0
    s3_flagged = mfcc_var_mean < 45.0
    signals.append(Signal(
        name="MFCC coefficient dynamics",
        flagged=s3_flagged,
        value=round(mfcc_var_mean, 2),
        explanation=(
            "Low variance in mel-frequency cepstral coefficients suggests reduced vocal tract dynamics. "
            "MFCCs capture the shape of the vocal tract over time — natural speech shows rich variation "
            "as we form different phonemes. Synthesized speech tends to be over-regularized."
            if s3_flagged else
            "MFCC variance is consistent with natural vocal tract movement."
        )
    ))
    if s3_flagged:
        flagged_count += 1
        weighted_points += s3_weight
    max_points += s3_weight

    # --- Signal 4: Zero-crossing rate consistency ---
    zcr_std = features["zcr_std"]
    # High ZCR std = natural consonant/vowel transitions
    # Very low ZCR std = synthesized, homogeneous texture
    s4_weight = 1.0
    s4_flagged = zcr_std < 0.05
    signals.append(Signal(
        name="Zero-crossing rate variation",
        flagged=s4_flagged,
        value=round(zcr_std, 4),
        explanation=(
            "Unusually consistent zero-crossing rate. Natural speech has highly variable ZCR "
            "due to the mix of voiced sounds (low ZCR) and unvoiced consonants (high ZCR). "
            "This homogeneity is a common artifact in synthesized audio."
            if s4_flagged else
            "Zero-crossing rate shows natural variation between voiced and unvoiced segments."
        )
    ))
    if s4_flagged:
        flagged_count += 1
        weighted_points += s4_weight
    max_points += s4_weight

    # --- Signal 5: Spectral centroid drift ---
    sc_std = features["spectral_centroid_std"]
    # Real speech: centroid drifts significantly (formant movement)
    # Synthetic:   centroid is stable / drifts less
    s5_weight = 1.0
    s5_flagged = sc_std < 550.0
    signals.append(Signal(
        name="Spectral centroid drift",
        flagged=s5_flagged,
        value=round(sc_std, 1),
        explanation=(
            "Low spectral centroid drift suggests limited formant movement. "
            "The spectral centroid tracks the 'brightness' of sound — in real speech it shifts "
            "dramatically as we move between phonemes. Voice cloners often produce unnaturally "
            "stable centroid trajectories."
            if s5_flagged else
            "Spectral centroid drift is consistent with natural formant movement."
        )
    ))
    if s5_flagged:
        flagged_count += 1
        weighted_points += s5_weight
    max_points += s5_weight

    # --- Signal 6: Overly continuous voicing ---
    voiced_ratio = features["f0_voiced_ratio"]
    s6_weight = 1.25
    # Human speech usually has brief unvoiced regions; extremely high ratio can indicate synthesis smoothness.
    s6_flagged = voiced_ratio > 0.95 and zcr_std < 0.07
    signals.append(Signal(
        name="Voicing continuity",
        flagged=s6_flagged,
        value=round(voiced_ratio, 3),
        explanation=(
            "The clip appears almost continuously voiced with limited unvoiced transitions. "
            "High-end TTS often over-smoothes voicing continuity compared with natural speech."
            if s6_flagged else
            "Voicing continuity looks within a typical range for natural speech."
        )
    ))
    if s6_flagged:
        flagged_count += 1
        weighted_points += s6_weight
    max_points += s6_weight

    # ─── Scoring ─── 
    base_score = (weighted_points / max_points) * 100 if max_points else 0.0

    # Adjust for clip length — short clips are less reliable
    duration = features["duration"]
    confidence_penalty = max(0, (3.0 - duration) / 3.0) * 15  # up to 15 pts uncertainty
    # Remove random jitter so repeated analyses are deterministic and easier to debug.
    risk_score = int(min(100, max(0, base_score - confidence_penalty)))

    if risk_score >= 50:
        verdict = "likely synthetic"
        summary = (
            f"{flagged_count} of {len(signals)} acoustic signals are consistent with voice synthesis. "
            "The features most associated with TTS/voice cloning artifacts were detected. "
            "Treat this audio with caution. "
        )
    elif risk_score >= 25:
        verdict = "uncertain"
        summary = (
            f"{flagged_count} of {len(signals)} signals flagged. Results are inconclusive. "
            "the audio has some atypical features but not enough to make a confident determination. "
            "Consider additional context. "
        )
    else:
        verdict = "likely human"
        summary = (
            f"Only {flagged_count} of {len(signals)} signals flagged. "
            "The acoustic profile is broadly consistent with natural human speech. "
            "No strong synthesis artifacts detected. "
        )

    return AnalysisResult(
        risk_score=risk_score,
        verdict=verdict,
        signals=signals,
        summary=summary,
    )


# ─── Routes ──── 

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/analyze", response_model=AnalysisResult)
async def analyze(file: UploadFile = File(...)):
    if not file.content_type.startswith("audio/"):
        # also accept octet-stream (common from browser MediaRecorder)
        if file.content_type not in ("application/octet-stream",):
            raise HTTPException(400, f"Expected audio file, got {file.content_type}")

    audio_bytes = await file.read()
    if len(audio_bytes) < 1000:
        raise HTTPException(400, "Audio file too short — please record at least 2 seconds.")

    suffix = os.path.splitext(file.filename)[1] or ".bin"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        y, sr = librosa.load(tmp_path, sr=22050, mono=True)
        if len(y) / sr < 1.5:
            raise HTTPException(400, "Audio too short — record at least 2 seconds of speech.")
        features = extract_features(y, sr)
        result   = score(features)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Analysis failed: {str(e)}")
    finally:
        os.unlink(tmp_path)