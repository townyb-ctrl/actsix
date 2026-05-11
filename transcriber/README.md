# ACTSIX Local Meeting Transcriber

This is a local open-source transcription server for ACTSIX Meetings.

Setup:

1. Open a second Terminal tab.
2. From the ACTSIX folder, run:

cd transcriber
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn server:app --reload --port 5055

3. Keep your normal ACTSIX dev server running in another terminal:

npm run dev

Optional model size:

Default model is base.

For better quality, run:

ACTSIX_WHISPER_MODEL=small uvicorn server:app --reload --port 5055

Model options:
- tiny
- base
- small
- medium
- large-v3
