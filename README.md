# AI Voice Detection Demo 🎙️

This is the first draft of my AI Voice Detection Demo.


## What it does

This demo analyzes an audio clip and flags acoustic signals statistically associated with TTS (text-to-speech) and voice cloing synthesis. You can either upload a file or record live, and you will get a risk score from 0 to 100 with a plain-language breakdown of every signal.


## Technical approach & Credibility

The feature extraction pipeline draws directly on signal processing concepts from UC Berkeley EECS16A coursework.

The classifer is deliberately threshold-based, as it makes the system interpretable and honest about uncertainty. Each threshold is grounded in published acoustic phonetics literature on TTS artifacts.

---

## Stack

```
backend/     FastAPI + Librosa + numpy
frontend/    React + Vite
```

## Running Locally

### Backend

```bash
pip3 install fastapi uvicorn numpy librosa pydantic python-multipart
python3 -m uvicorn main:app --reload --port 8000
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Requires Python 3.10+. librosa pulls in numpy automatically.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5175

--- 

### Usage

1. **Upload** a WAV/MP3/M4A/WebM clip, or **record** directly in the browser
2. Click **Run Analysis**
3. Read the signal breakdown: each flagged signal includes an explanation of the acoustic reasoning
4. Use the result as one input, and be aware of the potential inaccuracies

### Demo

