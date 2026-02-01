# External Integrations

**Analysis Date:** 2026-02-02

## APIs & External Services

**Whisper ASR Engine:**
- whisper.cpp - Local speech-to-text binary executed via CLI
  - SDK/Client: Direct process spawning (`node:child_process`)
  - Integration: `src/whisper.js` - `runWhisper()` spawns `whisper.cpp/main` process
  - Auth: None - Local binary
  - Config env vars: `WHISPER_BIN`, `WHISPER_MODEL`, `WHISPER_ARGS`
  - Parameters: Audio file path, model path, output format flags
  - Output: Text transcription written to `.txt` file

## Data Storage

**Databases:**
- None - No persistent database integration

**File Storage:**
- Local filesystem only
  - Temporary WAV files: Stored in OS temp directory (`os.tmpdir()`)
  - Naming: `asr-{reqId}.wav` and corresponding `.txt` output
  - Cleanup: Automatic deletion after transcription (unless `KEEP_DEBUG=true`)
  - Implementation: `src/server.js` (lines 92-94 for write, lines 110-112 for cleanup)

**Caching:**
- None - No caching layer

## Authentication & Identity

**Auth Provider:**
- Custom token-based
  - Implementation: Simple shared secret token in `AUTH_TOKEN` env var
  - Enforcement: `src/server.js` line 45 - Token validation on `start` message
  - Failure: WebSocket closure with `unauthorized` error message
  - Token format: Plain string (no JWT or cryptographic validation)

## Monitoring & Observability

**Error Tracking:**
- None - No error tracking service integration

**Logs:**
- Console logging only
  - `src/server.js` line 158: Connection logs via `console.log()`
  - `src/server.js` line 162: Server startup message
  - Error details: Sent to client as JSON error messages, not persisted

**Health Endpoint:**
- `GET /health` - Simple HTTP health check
  - Returns JSON with `ok`, `engine`, `uptimeSec`, `version` fields
  - Location: `src/server.js` lines 20-24

## CI/CD & Deployment

**Hosting:**
- No integration - Standalone Node.js server
- Deployment: Manual or custom tooling (not specified in repo)
- Execution: `npm run dev` or `npm start` via `node src/server.js`

**CI Pipeline:**
- None - No CI/CD configuration detected

## Environment Configuration

**Required env vars:**
- `WHISPER_BIN` - Path to compiled whisper.cpp binary
- `WHISPER_MODEL` - Path to GGML model file
- `AUTH_TOKEN` - Shared authentication token

**Optional env vars with defaults:**
- `HOST` (default: `0.0.0.0`)
- `PORT` (default: `8765`)
- `WHISPER_ARGS` (default: empty, passed as CLI args to whisper.cpp)
- `DEFAULT_MODE` (default: `return_only`)
- `MAX_AUDIO_SEC` (default: `30`)
- `SAMPLE_RATE` (default: `16000`)
- `CHANNELS` (default: `1`)
- `BIT_DEPTH` (default: `16`)
- `KEEP_DEBUG` (default: `false`)

**Secrets location:**
- `.env` file (example provided as `.env.example`)
- Auth token stored in `AUTH_TOKEN` variable
- `.gitignore` prevents `.env` from being committed

## Webhooks & Callbacks

**Incoming:**
- WebSocket messages only
  - Control frames: JSON `start`, `end`, `cancel` messages
  - Audio frames: Binary PCM s16le audio chunks
  - Protocol documented in `SPEC.md` and implemented in `src/server.js`

**Outgoing:**
- None - No outbound webhooks or callbacks
- Results returned directly to WebSocket client via JSON messages: `ack`, `result`, `error`, `progress`

## System-Level Integrations

**macOS System Clipboard:**
- Tool: `pbcopy` command
- Integration: `src/inject.js` line 3-11 - `pbcopy()` function
- Purpose: Copy transcribed text to system clipboard
- Used in: `paste` and `paste_enter` modes

**macOS Keystroke Injection:**
- Tool: `osascript` (AppleScript runner)
- Integration: `src/inject.js` line 13-21 - `osascript()` function
- Operations:
  - Cmd+V paste: `keystroke "v" using command down`
  - Enter key: `key code 36`
- Purpose: Inject transcribed text into foreground application
- Used in: `paste` and `paste_enter` modes

**macOS Accessibility Permission:**
- Required for clipboard and keystroke operations (noted in README.md line 20)
- Automatically enforced by macOS when `osascript` is called

---

*Integration audit: 2026-02-02*
