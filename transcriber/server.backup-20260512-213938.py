from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel
from pydantic import BaseModel
from typing import Optional
import tempfile
import os
import re
import requests
import time

app = FastAPI(title="ACTSIX Local Meeting Transcriber")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_SIZE = os.getenv("ACTSIX_WHISPER_MODEL", "base")
MINUTES_PROVIDER = os.getenv("ACTSIX_MINUTES_PROVIDER", "ollama").lower()

OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")

model = WhisperModel(MODEL_SIZE, device="cpu", compute_type="int8")


class ProcessTranscriptRequest(BaseModel):
    transcript: str
    meeting_title: Optional[str] = None


@app.get("/health")
def health():
    return {
        "ok": True,
        "transcription_model": MODEL_SIZE,
        "minutes_provider": MINUTES_PROVIDER,
        "ollama_model": OLLAMA_MODEL,
        "gemini_model": GEMINI_MODEL,
        "groq_model": GROQ_MODEL,
    }


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


def build_minutes_prompt(transcript: str, meeting_title: Optional[str]):
    return f"""
You are helping create clean church staff meeting minutes from a noisy transcript.

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
- Action points should be specific and start with a verb where possible.

Meeting title: {meeting_title or "Staff Meeting"}

Transcript:
{transcript}
"""


def extract_action_points(generated: str):
    action_points = []
    in_action_section = False

    for line in generated.splitlines():
        stripped = line.strip()
        lower = stripped.lower()

        if "action point" in lower or "actions" in lower or "follow-up" in lower:
            in_action_section = True
            continue

        if in_action_section and stripped.startswith("#"):
            in_action_section = False

        if in_action_section and (stripped.startswith("- ") or stripped.startswith("* ")):
            action_points.append(stripped[2:].strip())

    if action_points:
        return action_points

    fallback_keywords = [
        "follow",
        "contact",
        "prepare",
        "plan",
        "meet",
        "ask",
        "send",
        "speak",
        "decide",
        "arrange",
        "confirm",
        "create",
        "update",
    ]

    for line in generated.splitlines():
        stripped = line.strip()
        if stripped.startswith("- ") or stripped.startswith("* "):
            item = stripped[2:].strip()
            if any(word in item.lower() for word in fallback_keywords):
                action_points.append(item)

    return action_points[:15]


def process_with_ollama(prompt: str):
    response = requests.post(
        "http://127.0.0.1:11434/api/generate",
        json={
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False,
        },
        timeout=240,
    )

    response.raise_for_status()
    data = response.json()
    return data.get("response", "").strip()


def process_with_gemini(prompt: str):
    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set.")

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"

    response = requests.post(
        url,
        params={"key": api_key},
        json={
            "contents": [
                {
                    "parts": [
                        {
                            "text": prompt,
                        }
                    ]
                }
            ]
        },
        timeout=240,
    )

    response.raise_for_status()
    data = response.json()

    candidates = data.get("candidates", [])
    if not candidates:
        return ""

    content = candidates[0].get("content", {})
    parts = content.get("parts", [])

    return "\n".join(part.get("text", "") for part in parts).strip()


def process_with_groq(prompt: str):
    api_key = os.getenv("GROQ_API_KEY")

    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not set.")

    response = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": GROQ_MODEL,
            "messages": [
                {
                    "role": "system",
                    "content": "You create clean, practical church staff meeting minutes from noisy transcripts.",
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
            "temperature": 0.2,
        },
        timeout=240,
    )

    response.raise_for_status()
    data = response.json()

    return data["choices"][0]["message"]["content"].strip()


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
        "confirm",
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



def chunk_text(text: str, max_chars: int = 12000):
    paragraphs = [p.strip() for p in text.split("\n") if p.strip()]
    chunks = []
    current = ""

    for paragraph in paragraphs:
        if len(current) + len(paragraph) + 2 <= max_chars:
            current += ("\n\n" if current else "") + paragraph
        else:
            if current:
                chunks.append(current)
            current = paragraph

    if current:
        chunks.append(current)

    if not chunks and text.strip():
        chunks = [text.strip()[i:i + max_chars] for i in range(0, len(text.strip()), max_chars)]

    return chunks


def build_chunk_summary_prompt(chunk: str, meeting_title: Optional[str], chunk_number: int, total_chunks: int):
    return f"""
You are helping process part of a noisy church staff meeting transcript.

This is chunk {chunk_number} of {total_chunks}.

Create a concise structured summary of this chunk.

Rules:
- Do not invent details.
- Remove filler words and repetition.
- Capture topics discussed.
- Capture clear decisions.
- Capture possible action points.
- Use markdown.

Meeting title: {meeting_title or "Staff Meeting"}

Transcript chunk:
{chunk}
"""


def build_final_minutes_prompt(chunk_summaries: list, meeting_title: Optional[str]):
    joined_summaries = "\n\n---\n\n".join(chunk_summaries)

    return f"""
You are creating final staff meeting minutes from several chunk summaries.

Create clean, useful, structured meeting minutes.

Rules:
- Do not invent details.
- Merge duplicate points.
- Group by topic.
- Use clear headings.
- Include decisions if clear.
- End with a clear Action Points section.
- Action points must be practical and start with a verb where possible.
- Use markdown.

Meeting title: {meeting_title or "Staff Meeting"}

Chunk summaries:
{joined_summaries}
"""


def process_prompt_with_provider(prompt: str, provider: str):
    if provider == "gemini":
        return process_with_gemini(prompt)

    if provider == "groq":
        return process_with_groq(prompt)

    if provider == "ollama":
        return process_with_ollama(prompt)

    raise RuntimeError(f"Unsupported provider: {provider}")


def process_prompt_with_retry(prompt: str, provider: str, attempts: int = 4):
    last_error = None

    for attempt in range(attempts):
        try:
            return process_prompt_with_provider(prompt, provider)
        except requests.exceptions.HTTPError as error:
            last_error = error
            status_code = error.response.status_code if error.response is not None else None

            if status_code == 429:
                wait_seconds = int(os.getenv("AI_RETRY_WAIT_SECONDS", "20")) * (attempt + 1)
                print(f"Provider '{provider}' rate limited. Waiting {wait_seconds}s before retry {attempt + 1}/{attempts}.")
                time.sleep(wait_seconds)
                continue

            raise
        except Exception as error:
            last_error = error
            raise

    raise last_error


def process_large_transcript_with_provider(transcript: str, meeting_title: Optional[str], provider: str):
    max_chars = 12000 if provider == "groq" else 18000

    chunks = chunk_text(transcript, max_chars=max_chars)

    if len(chunks) == 1:
        prompt = build_minutes_prompt(transcript, meeting_title)
        generated = process_prompt_with_retry(prompt, provider)

        return {
            "minutes": generated,
            "action_points": extract_action_points(generated),
            "source": provider,
        }

    chunk_summaries = []

    for index, chunk in enumerate(chunks):
        prompt = build_chunk_summary_prompt(
            chunk=chunk,
            meeting_title=meeting_title,
            chunk_number=index + 1,
            total_chunks=len(chunks),
        )

        summary = process_prompt_with_retry(prompt, provider)

        if summary.strip():
            chunk_summaries.append(summary.strip())

        delay_seconds = int(os.getenv("AI_CHUNK_DELAY_SECONDS", "10"))
        if delay_seconds > 0 and index < len(chunks) - 1:
            print(f"Waiting {delay_seconds}s before processing next chunk...")
            time.sleep(delay_seconds)

    final_prompt = build_final_minutes_prompt(chunk_summaries, meeting_title)
    final_minutes = process_prompt_with_retry(final_prompt, provider)

    return {
        "minutes": final_minutes,
        "action_points": extract_action_points(final_minutes),
        "source": f"{provider}_chunked",
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

    provider = os.getenv("ACTSIX_MINUTES_PROVIDER", MINUTES_PROVIDER).lower()

    try:
        if provider in ["gemini", "groq", "ollama"]:
            return process_large_transcript_with_provider(
                transcript=transcript,
                meeting_title=payload.meeting_title,
                provider=provider,
            )

    except Exception as error:
        print(f"Provider '{provider}' failed:", error)

    return fallback_process_transcript(transcript)
