from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel
from pydantic import BaseModel
import re
from typing import Optional
import requests
import re
from typing import Optional
import tempfile
import os

app = FastAPI(title="ACTSIX Local Meeting Transcriber")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_SIZE = os.getenv("ACTSIX_WHISPER_MODEL", "base")
model = WhisperModel(MODEL_SIZE, device="cpu", compute_type="int8")


@app.get("/health")
def health():
    return {"ok": True, "model": MODEL_SIZE}


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    suffix = os.path.splitext(file.filename or "meeting-audio.mp3")[1] or ".mp3"

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp:
        temp.write(await file.read())
        temp_path = temp.name

    try:
        segments, info = model.transcribe(
            temp_path,
            beam_size=5,
            vad_filter=True,
        )

        transcript_segments = []
        full_text_parts = []

        for segment in segments:
            item = {
                "start": round(segment.start, 2),
                "end": round(segment.end, 2),
                "text": segment.text.strip(),
            }
            transcript_segments.append(item)
            full_text_parts.append(item["text"])

        return {
            "language": info.language,
            "duration": round(info.duration or 0, 2),
            "text": "\n".join(full_text_parts).strip(),
            "segments": transcript_segments,
        }

    finally:
        try:
            os.remove(temp_path)
        except OSError:
            pass


class ProcessTranscriptRequest(BaseModel):
    transcript: str
    meeting_title: Optional[str] = None


def fallback_process_transcript(transcript: str):
    lines = [line.strip() for line in transcript.splitlines() if line.strip()]
    text = " ".join(lines)

    topics = [
        ("Ministry Feedback", ["youth", "junior", "senior", "kids church", "service", "morning", "evening", "team church"]),
        ("Schools and Outreach", ["school", "strand", "hope and light", "learners", "students", "preach", "talk"]),
        ("Holiday Bible Club", ["hpc", "holiday", "joy story", "kids", "sign up"]),
        ("GLS Next Gen", ["gls", "sponsorship", "table leader"]),
        ("Worship and Production", ["worship", "drums", "band", "speaker", "sound", "stage"]),
        ("Website", ["website", "nucleus", "site"]),
        ("Planning and Follow-up", ["planning", "meeting", "follow up", "next week", "this week"]),
    ]

    minutes_sections = []
    lower_text = text.lower()

    for heading, keywords in topics:
        matches = []
        for sentence in re.split(r"(?<=[.!?])\s+", text):
            s_lower = sentence.lower()
            if any(keyword in s_lower for keyword in keywords):
                cleaned = sentence.strip()
                if len(cleaned) > 25 and cleaned not in matches:
                    matches.append(cleaned)

        if matches:
            summary = " ".join(matches[:5])
            minutes_sections.append(f"## {heading}\n{summary}")

    action_sentences = []
    action_keywords = [
        "need to",
        "needs to",
        "we should",
        "we need",
        "follow up",
        "ask",
        "contact",
        "prepare",
        "plan",
        "meet",
        "make a plan",
        "send",
        "speak to",
        "talk to",
    ]

    for sentence in re.split(r"(?<=[.!?])\s+", text):
        s_lower = sentence.lower()
        if any(keyword in s_lower for keyword in action_keywords):
            cleaned = sentence.strip()
            if 20 < len(cleaned) < 260:
                action_sentences.append(cleaned)

    action_points = []
    seen = set()

    for item in action_sentences:
        normalized = item.lower()
        if normalized in seen:
            continue

        seen.add(normalized)
        action_points.append(item)

        if len(action_points) >= 12:
            break

    minutes = "# Generated Meeting Minutes\n\n"

    if minutes_sections:
        minutes += "\n\n".join(minutes_sections)
    else:
        minutes += "## Summary\nThe transcript was processed, but not enough clear structure was detected. Review the raw transcript and add agenda headings manually."

    minutes += "\n\n## Action Points\n"

    if action_points:
        minutes += "\n".join([f"- {item}" for item in action_points])
    else:
        minutes += "- No clear action points were detected."

    return {
        "minutes": minutes,
        "action_points": action_points,
        "source": "fallback",
    }


@app.post("/process")
def process_transcript(payload: ProcessTranscriptRequest):
    transcript = payload.transcript.strip()

    if not transcript:
        return {
            "minutes": "",
            "action_points": [],
            "source": "empty",
        }

    prompt = f"""
You are helping create clean staff meeting minutes from a noisy church staff meeting transcript.

Create useful, structured meeting notes.

Rules:
- Do not preserve filler words.
- Do not invent details.
- Group discussion by topic.
- Use clear headings.
- Include decisions if they are clear.
- Include action points at the end.
- Keep it practical and readable.
- Use markdown.

Meeting title: {payload.meeting_title or "Staff Meeting"}

Transcript:
{transcript}
"""

    try:
        response = requests.post(
            "http://127.0.0.1:11434/api/generate",
            json={
                "model": "llama3.1",
                "prompt": prompt,
                "stream": False,
            },
            timeout=180,
        )

        if response.ok:
            data = response.json()
            generated = data.get("response", "").strip()

            action_points = []
            for line in generated.splitlines():
                stripped = line.strip()
                if stripped.startswith("- ") or stripped.startswith("* "):
                    if any(word in stripped.lower() for word in ["follow", "contact", "prepare", "plan", "meet", "ask", "send", "speak", "decide", "arrange"]):
                        action_points.append(stripped[2:].strip())

            return {
                "minutes": generated,
                "action_points": action_points,
                "source": "ollama",
            }

    except Exception:
        pass

    return fallback_process_transcript(transcript)
