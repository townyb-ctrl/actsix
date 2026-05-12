# ACTSIX Local Meeting Transcriber

This server supports:

- Local audio transcription with faster-whisper
- Transcript-to-minutes processing with:
  - Ollama
  - Gemini
  - Groq
  - fallback local processor

## Start the server

From ACTSIX:

cd transcriber
source .venv/bin/activate
python3 -m pip install -r requirements.txt
python3 -m uvicorn server:app --reload --port 5055

## Health check

curl http://127.0.0.1:5055/health

## Default mode

By default, transcript processing uses Ollama:

ACTSIX_MINUTES_PROVIDER=ollama

Start Ollama separately:

ollama run llama3.1

## Use Gemini

Set your key:

export GEMINI_API_KEY="your_key_here"
export ACTSIX_MINUTES_PROVIDER=gemini
export GEMINI_MODEL=gemini-2.0-flash

Then start the server:

python3 -m uvicorn server:app --reload --port 5055

## Use Groq

Set your key:

export GROQ_API_KEY="your_key_here"
export ACTSIX_MINUTES_PROVIDER=groq
export GROQ_MODEL=llama-3.1-8b-instant

Then start the server:

python3 -m uvicorn server:app --reload --port 5055

## Local transcription model

Default:

ACTSIX_WHISPER_MODEL=base

Optional:

export ACTSIX_WHISPER_MODEL=small
