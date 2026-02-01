# mac-whisper-ws-asr-server

Node.js (macOS) WebSocket server that receives streamed audio from an ESP32-S3, runs local `whisper.cpp` for ASR, then returns the recognized text over WebSocket.

Optionally, it can inject the recognized text into the foreground app (e.g. your Terminal running Claude Code) via clipboard + Cmd+V (+ optional Enter).

## Features
- WebSocket endpoint: `ws://<mac-ip>:8765/ws`
- Protocol: JSON control frames (`start`, `end`) + binary audio frames (raw PCM s16le)
- ASR engine: `whisper.cpp` CLI
- Modes:
  - `return_only`
  - `paste`
  - `paste_enter`

## Requirements
- Node.js 20+
- `whisper.cpp` built locally (provides `main` binary)
- A whisper model file (e.g. `ggml-medium.bin`)
- macOS Accessibility permission if using paste/paste_enter

## Install
```bash
npm i
cp .env.example .env
# edit paths
npm run dev
```

## Test with curl (HTTP health)
```bash
curl http://<mac-ip>:8765/health
```

## WebSocket protocol (summary)
Client sends:
- `start` (JSON text frame) with token, reqId, audio format params
- audio chunks as binary frames (raw PCM s16le)
- `end` (JSON text frame)

Server responds:
- `ack`
- `result` or `error`

See `SPEC.md` for the full spec.
