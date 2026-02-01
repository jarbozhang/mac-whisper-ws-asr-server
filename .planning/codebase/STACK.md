# Technology Stack

**Analysis Date:** 2026-02-02

## Languages

**Primary:**
- JavaScript (ES Module) - Server-side runtime for WebSocket ASR server

## Runtime

**Environment:**
- Node.js 20+ - Required for ES Module support and modern APIs

**Package Manager:**
- npm - Dependency management via `package.json`
- Lockfile: Not present in repository (git-ignored)

## Frameworks

**Core:**
- Node.js `http` module - Built-in HTTP server for health check endpoint
- WebSocket (`ws` 8.17.1) - Bi-directional communication for audio streaming and result delivery

**System Integration:**
- Node.js `child_process` - Execute `whisper.cpp` binary and macOS system commands
- Node.js `fs/promises` - Async file I/O for WAV buffer writes and cleanup

## Key Dependencies

**Critical:**
- `ws` 8.17.1 - WebSocket server implementation at `/ws` path for audio streaming protocol
- `uuid` 10.0.0 - Generate unique request IDs for tracking ASR sessions
- `dotenv` 16.4.5 - Load environment configuration from `.env` file

**Infrastructure:**
- None - No external cloud SDKs or third-party libraries beyond above

## Configuration

**Environment:**
- Config loader: `src/config.js` uses `dotenv/config` import
- Method: Environment variables with sensible defaults
- Key configs required:
  - `HOST` - Server bind address (default: `0.0.0.0`)
  - `PORT` - Server port (default: `8765`)
  - `AUTH_TOKEN` - WebSocket authentication token (required, no default)
  - `WHISPER_BIN` - Absolute path to `whisper.cpp/main` binary (required, no default)
  - `WHISPER_MODEL` - Absolute path to whisper model file (required, no default)
  - `WHISPER_ARGS` - Optional args passed to whisper.cpp (e.g., `--language zh --temperature 0`)
  - `DEFAULT_MODE` - ASR result mode: `return_only`, `paste`, or `paste_enter` (default: `return_only`)
  - `MAX_AUDIO_SEC` - Maximum audio length in seconds (default: `30`)
  - `SAMPLE_RATE` - Audio sample rate in Hz (default: `16000`)
  - `CHANNELS` - Audio channel count (default: `1`)
  - `BIT_DEPTH` - Audio bit depth (default: `16`)
  - `KEEP_DEBUG` - Keep WAV and TXT files after processing (default: `false`)

**Build:**
- No build configuration - Pure ESM JavaScript, runs directly with `node`
- Entry point: `src/server.js` (specified in `package.json` as `main`)

## Platform Requirements

**Development:**
- macOS - Required for `pbcopy` and `osascript` system integrations used in paste/paste_enter modes
- Node.js 20+
- `whisper.cpp` CLI tool built locally (external C++ binary, not npm package)

**Production:**
- macOS deployment (hard requirement due to system-level clipboard and keystroke injection)
- Node.js 20+ runtime
- Local `whisper.cpp` binary compiled for target Mac architecture
- Whisper model file (GGML format, e.g., `ggml-medium.bin`)

---

*Stack analysis: 2026-02-02*
