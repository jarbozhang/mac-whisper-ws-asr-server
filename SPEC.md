# Spec (mac-whisper-ws-asr-server)

> Canonical spec lives in Obsidian.
> This file is a short, practical summary that matches the current implementation.

Spec source (Obsidian):
`/Volumes/100.86.103.28/obsidian/20 Areas/Hardware/Claude Code/ESP32 + WebSocket 语音上传 + whisper.cpp ASR（Mac Node）- Spec.md`

## HTTP

### GET /health
Returns:
```json
{ "ok": true, "engine": "whisper.cpp", "uptimeSec": 123, "version": "0.1.0", "mdnsHostname": "xxx.local" }
```

### POST /hook
Purpose: receive Claude Code hooks JSON (via stdin forwarding) and broadcast a compacted event to all connected WS clients.

- Auth: header `x-auth-token` must equal `AUTH_TOKEN`.
- Body: JSON from Claude Code hook stdin.
- Response: `{ "ok": true }`

Broadcast format:
```json
{
  "type": "hook",
  "id": "uuid",
  "ts": 1730000000000,
  "hook_event_name": "Stop",
  "session_id": "...",
  "cwd": "...",
  "permission_mode": "default",
  "tool_name": "Bash",
  "tool_input": { "command": "..." }
}
```

## WebSocket

Endpoint:
- `ws://<host>:8765/ws`

### Control frames (JSON text)
- `start`: begin an ASR session
- `end`: finish and run ASR
- `cancel`: cancel current session

`start` example:
```json
{
  "type": "start",
  "token": "<AUTH_TOKEN>",
  "reqId": "uuid",
  "mode": "return_only",
  "format": "pcm_s16le",
  "sampleRate": 16000,
  "channels": 1,
  "bitDepth": 16
}
```

### Audio frames (binary)
- Raw PCM bytes. Current default expectation: **16kHz, 16-bit signed little-endian, mono**.

### Server responses (JSON text)
- `ack`: `{type:"ack", reqId, status:"ready"}`
- `progress`: `{type:"progress", reqId, bytes}` (optional)
- `result`: `{type:"result", reqId, text, ms, engine:"whisper.cpp"}`
- `error`: `{type:"error", reqId, message}`
