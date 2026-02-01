# Architecture

**Analysis Date:** 2026-02-02

## Pattern Overview

**Overall:** Event-driven WebSocket server with external process orchestration

**Key Characteristics:**
- Request-response protocol over WebSocket with binary audio streaming
- Serial processing queue for whisper.cpp (one ASR operation at a time)
- Stateful per-connection session management
- macOS-specific text injection via clipboard and AppleScript
- Configuration-driven behavior for audio formats and model parameters

## Layers

**HTTP Server Layer:**
- Purpose: Provide health check endpoint and WebSocket upgrade mechanism
- Location: `src/server.js` (lines 19-27)
- Contains: HTTP request handler for `/health` endpoint
- Depends on: Node.js `http` module
- Used by: Entry point, clients requesting server status

**WebSocket Protocol Layer:**
- Purpose: Manage client connections and multiplex message handling
- Location: `src/server.js` (lines 29-159)
- Contains: Connection handler, message routing, session lifecycle
- Depends on: `ws` package, configuration
- Used by: Clients sending audio and control commands

**Audio Processing Layer:**
- Purpose: Transform and validate audio data before ASR
- Location: `src/wav.js` (pcm-to-WAV conversion), `src/server.js` (buffering)
- Contains: PCM buffer concatenation, WAV header generation, format validation
- Depends on: Audio format configuration (sample rate, channels, bit depth)
- Used by: Server message handler, whisper.cpp runner

**ASR Execution Layer:**
- Purpose: Orchestrate whisper.cpp subprocess with serial queuing
- Location: `src/whisper.js` (runner), `src/server.js` (queue at lines 32, 115)
- Contains: Child process spawning, stderr parsing, output file reading
- Depends on: `whisper.cpp` binary, model file, temporary file system
- Used by: Server end-message handler, injection layer

**Text Injection Layer:**
- Purpose: Inject recognized text into macOS foreground application
- Location: `src/inject.js`
- Contains: Clipboard copy via `pbcopy`, keyboard simulation via `osascript`
- Depends on: macOS `pbcopy` and `osascript` commands, Accessibility permissions
- Used by: ASR execution layer (after successful recognition)

**Configuration Layer:**
- Purpose: Centralize environment-based settings
- Location: `src/config.js`
- Contains: Port, host, auth token, ASR parameters, audio format specs, mode defaults
- Depends on: Environment variables, `dotenv` package
- Used by: All other layers

## Data Flow

**Audio Recognition Flow:**

1. Client connects to WebSocket, establishes session context
2. Client sends `start` message (JSON) with authentication token, audio parameters, request ID
3. Server validates token, creates session object with metadata (format, sample rate, channels)
4. Client sends multiple binary frames containing raw PCM audio chunks
5. Server buffers chunks into session.parts array, tracks metrics (bytes, chunk count)
6. Client sends `end` message to finalize audio stream
7. Server concatenates buffered chunks into single PCM buffer
8. Server validates audio duration against maxAudioSec limit
9. Server converts PCM to WAV format with proper header
10. Server writes WAV file to temporary directory
11. Server enqueues ASR task in whisperQueue (Promise chain for serial execution)
12. whisper.cpp subprocess runs with model, output-txt flag, and extra arguments
13. whisper.cpp produces .txt output file
14. Server reads text from output file, calculates execution time
15. Server injects text via clipboard + keyboard if mode != 'return_only'
16. Server sends `result` message (JSON) back to client with text, execution time, engine name
17. Server cleans up WAV and output files (unless KEEP_DEBUG=true)

**Error Handling Flow:**

- Authentication failure: Send `error` response with "unauthorized", close connection
- Format validation: Send `error` response with specific message (e.g., "audio too long")
- Session state violations: Send `error` response with "no active session" or "binary before start"
- whisper.cpp failure: Catch subprocess exit code, send `error` with stderr output
- File system errors: Catch exceptions, send `error` with message, continue

**State Management:**

- Per-connection session object: Holds current audio stream state, metadata, buffered chunks
- Global whisperQueue Promise chain: Ensures serial (non-concurrent) ASR execution
- Session cleared on: `end` message processing, `cancel` message, connection close

## Key Abstractions

**Session:**
- Purpose: Encapsulate a single audio recognition request lifecycle
- Examples: `src/server.js` lines 54-65
- Pattern: Plain object with properties for metadata, buffered audio, and metrics
- Fields: reqId, mode, format, sampleRate, channels, bitDepth, chunks, bytes, parts (buffer array)

**Message Protocol:**
- Purpose: Define control commands and response types
- Examples: `start`, `end`, `cancel`, `ack`, `result`, `error`, `progress`
- Pattern: JSON text frames with required fields (type, reqId) and message-specific payloads

**ASR Queue:**
- Purpose: Serialize whisper.cpp execution to prevent concurrent runs
- Examples: `src/server.js` lines 32, 115-117
- Pattern: Promise chain that sequentially executes async ASR runs

## Entry Points

**HTTP Server:**
- Location: `src/server.js` lines 161-163
- Triggers: Node.js runtime, `npm run dev` or `npm start`
- Responsibilities: Create HTTP server, attach WebSocket server, listen on port and host

**WebSocket Connection:**
- Location: `src/server.js` lines 34-159
- Triggers: Client WebSocket upgrade request to `/ws` path
- Responsibilities: Establish session, route incoming messages, manage lifecycle

**Message Handlers:**
- `start` (lines 44-69): Initialize new ASR session
- `end` (lines 71-121): Process buffered audio, queue ASR, send result
- `cancel` (lines 123-127): Discard current session
- Binary frames (lines 133-147): Buffer audio chunks, report progress

## Error Handling

**Strategy:** Defensive error catching at message handler level with JSON error responses

**Patterns:**
- Try-catch wrapping entire message handler (line 40-151)
- Token validation before session creation (line 45-49)
- State validation before processing (line 72-74, 134-137)
- Subprocess error handling with exit code checking (lines 21-22 in whisper.js)
- Safe file deletion (utils.js safeUnlink) ignores ENOENT errors
- Error messages sent back to client via `error` message type

## Cross-Cutting Concerns

**Logging:** Console.log for connection events and basic lifecycle (`console.log('WS connected:', remote)`)

**Validation:**
- Token authentication (requires exact match with AUTH_TOKEN env var)
- Audio duration validation (reject if > MAX_AUDIO_SEC)
- Session state validation (start before end, binary after start)
- Message type validation (unknown types return error)

**Authentication:** Token-based on WebSocket `start` message, single token shared across clients (stateless auth)

---

*Architecture analysis: 2026-02-02*
