# mac-whisper-ws-asr-server

Node.js (macOS) WebSocket server that receives streamed audio from an ESP32-S3, runs local `whisper.cpp` for ASR, then returns recognized text over WebSocket.

Optionally, it can inject recognized text into the foreground app (e.g. your Terminal running Claude Code) via clipboard + Cmd+V (+ optional Enter).

This server can also receive **Claude Code hooks** events via HTTP and broadcast them to all connected WebSocket clients (e.g. ESP32 devices) for notifications like **beeps**.

## Endpoints

- WebSocket: `ws://<host>:8765/ws`
- Health: `GET http://<host>:8765/health`
- Hooks bridge: `POST http://<host>:8765/hook`

## Features

- WebSocket ASR endpoint: `ws://<host>:8765/ws`
- Protocol: JSON control frames (`start`, `end`, `cancel`) + binary audio frames (raw PCM)
- ASR engine: `whisper.cpp` CLI
- Modes:
  - `return_only`
  - `paste`
  - `paste_enter`
- Hooks bridge:
  - Accepts Claude Code hook JSON
  - Broadcasts `{type:"hook", ...}` messages to all WS clients

## Requirements

- Node.js 20+
- `whisper.cpp` built locally (provides the `main` binary)
- A whisper model file (e.g. `ggml-medium.bin`)
- macOS Accessibility permission if using `paste` / `paste_enter`

## Install

```bash
npm i
cp .env.example .env
# edit paths + token
npm run dev
```

## Configuration (.env)

Key settings:
- `HOST`, `PORT`
- `AUTH_TOKEN` (required)
- `WHISPER_BIN`, `WHISPER_MODEL`, `WHISPER_ARGS`
- `DEFAULT_MODE`

Optional:
- `MDNS_HOSTNAME` (e.g. `jiabos-macbook-pro-2.local`) for display/debug; returned by `/health`

## Quick tests

### Health
```bash
curl http://localhost:8765/health
```

### WebSocket (ASR)
A small test client is included:
```bash
node test-client.js
```

### Hooks bridge (broadcast)
This simulates a Claude Code `Stop` event and broadcasts it to all connected WS clients.

```bash
echo '{"hook_event_name":"Stop","session_id":"s1","cwd":"/tmp","permission_mode":"default"}' \
| curl -sS -X POST \
  -H 'content-type: application/json' \
  -H 'x-auth-token: change_me' \
  --data-binary @- \
  http://127.0.0.1:8765/hook
```

## WebSocket protocol (summary)

Client sends:
- `start` (JSON text frame) with `token`, `reqId`, audio format params
- audio chunks as **binary frames** (raw PCM)
- `end` (JSON text frame)

Server responds:
- `ack`
- `result` or `error`

See `SPEC.md` for details.
