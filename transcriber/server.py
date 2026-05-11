from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel
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
