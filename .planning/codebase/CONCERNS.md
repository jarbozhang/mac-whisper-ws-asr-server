# Codebase Concerns

**Analysis Date:** 2026-02-02

## Tech Debt

**Missing Authentication State Validation:**
- Issue: Auth token is checked on `start` message but no ongoing validation. A socket authenticated for session A could theoretically be reused if session reference is modified.
- Files: `src/server.js` (lines 44-49)
- Impact: Potential session hijacking if client reconnects without re-authenticating
- Fix approach: Store authenticated state on WebSocket object (`ws.authenticated`) and validate on every message. Require fresh auth for each new session.

**Unhandled Promise Rejection in Message Queue:**
- Issue: The `whisperQueue` chain uses `.catch()` to send error to WebSocket, but this only works for the first client. If multiple clients connect, the error handler refers to a single `ws` variable that may have changed.
- Files: `src/server.js` (lines 115-117)
- Impact: Error messages sent to wrong client or lost if connection closes between queued request and error handler execution
- Fix approach: Capture `ws` reference in closure within the `run` function or use a request-specific error handler instead of global queue.

**Missing Session Timeout:**
- Issue: If a client sends `start` but never sends `end`, the session object persists indefinitely in memory.
- Files: `src/server.js` (lines 54-65)
- Impact: Memory leak - accumulated orphaned sessions will grow without bound
- Fix approach: Add timestamp to session and implement periodic cleanup or timeout on `start` message (e.g., 5 minute timeout)

**No Validation of Audio Parameter Bounds:**
- Issue: Client-provided `sampleRate`, `channels`, `bitDepth` are used directly without validation against reasonable limits.
- Files: `src/server.js` (lines 59-61)
- Impact: Malicious or buggy clients could request invalid audio formats (e.g., 1000000Hz, 100 channels) causing undefined behavior
- Fix approach: Validate against whitelist of supported values: sampleRate in [8000, 16000, 44100, 48000], channels in [1, 2], bitDepth in [16]

## Security Considerations

**Auth Token Hardcoded in Examples:**
- Risk: `.env.example` shows `AUTH_TOKEN=change_me`. Users may copy this file directly to `.env` without changing the token.
- Files: `.env.example` (line 3)
- Current mitigation: README mentions "edit paths" but doesn't explicitly warn about token
- Recommendations: Add prominent warning in README about AUTH_TOKEN security. Consider failing startup if AUTH_TOKEN is still default value.

**Process Injection via osascript:**
- Risk: `injectText()` uses osascript to simulate keyboard input without validating the recognized text. If ASR result contains unexpected characters or is extremely long, unexpected behavior could occur.
- Files: `src/inject.js` (lines 13-34)
- Current mitigation: Max audio duration limits transcript length indirectly, but no direct validation of text content
- Recommendations: Add max length validation on `text` parameter before pbcopy/osascript. Sanitize special characters that could break AppleScript strings (quotes, newlines).

**Command Injection Risk in whisper.cpp Args:**
- Risk: `WHISPER_ARGS` environment variable is split on whitespace and passed directly to `spawn()`. While `spawn()` is safer than shell execution, user-provided args could still cause issues.
- Files: `src/config.js` (lines 10-12), `src/whisper.js` (line 10)
- Current mitigation: Using `spawn()` instead of shell execution mitigates most injection risks
- Recommendations: Validate WHISPER_ARGS against allowed flags whitelist (e.g., --language, --temperature only). Consider JSON config instead of string parsing.

**macOS Accessibility Permissions Spoof:**
- Risk: No validation that osascript can actually access target app. Silent failures could occur if app doesn't have Accessibility permission.
- Files: `src/inject.js` (lines 13-20)
- Current mitigation: Error is returned to client if osascript fails
- Recommendations: Test pbcopy and osascript availability at startup; document macOS security requirements clearly.

## Known Bugs

**WebSocket Silent Close on Auth Failure:**
- Symptoms: Client receives error message but connection closes immediately. No explicit close reason code.
- Files: `src/server.js` (lines 45-48)
- Trigger: Send `start` message without token or with wrong token
- Workaround: Client should expect connection close after auth error and attempt reconnection

**Improper Error Message on Binary Before Start:**
- Symptoms: When binary audio frame arrives before `start`, error is sent with `reqId: null` even if session exists from previous request
- Files: `src/server.js` (line 135)
- Trigger: Send binary frame, then `start`, then binary frame - the second binary frame has no session initially
- Workaround: Ensure `start` is sent before audio chunks in all cases

**Unreliable Progress Reporting:**
- Symptoms: Progress updates use modulo calculation that may miss boundaries or report inconsistently based on chunk alignment
- Files: `src/server.js` (lines 144-147)
- Trigger: Send audio chunks in specific sizes that align with 256KB boundaries
- Workaround: Implement explicit chunk tracking instead of byte count modulo

## Performance Bottlenecks

**Serial Whisper Processing:**
- Problem: `whisperQueue` forces all ASR requests to run sequentially. If one audio file takes 30 seconds, all queued requests wait.
- Files: `src/server.js` (lines 31-32, 115-117)
- Cause: Global promise queue prevents concurrent whisper.cpp invocations
- Improvement path: Implement worker pool or child process pool. Check whisper.cpp documentation for thread safety and use `--threads` flag to allow concurrent runs.

**Unbounded Buffer Accumulation:**
- Problem: `session.parts` array accumulates all audio chunks in memory. 30 second max audio at 16kHz mono = ~960KB, but no limit on chunk count.
- Files: `src/server.js` (lines 140, 77)
- Cause: Each chunk is pushed to array without deduplication or streaming to disk
- Improvement path: Write chunks directly to temporary file instead of buffering. Implement streaming WAV file construction.

**Temp File Cleanup on Failure:**
- Problem: If whisper.cpp fails or process crashes, `.wav` and `.txt` temp files are not cleaned up. With high request volume, disk fills up.
- Files: `src/server.js` (lines 109-112), `src/whisper.js` (line 26)
- Cause: Files are only deleted if `KEEP_DEBUG=false` and whisper succeeds. No error cleanup.
- Improvement path: Use `finally` block or implement OS-level temp file cleanup. Consider tmpdir auto-cleanup utility.

## Fragile Areas

**WAV Header Construction:**
- Files: `src/wav.js`
- Why fragile: Manual byte-level buffer manipulation. Off-by-one errors in offset calculations cause invalid WAV files that whisper.cpp silently ignores or misinterprets.
- Safe modification: Test with multiple sample rates/channels. Use WAV format validation library instead of manual construction.
- Test coverage: No unit tests for `pcmToWavBuffer()`. Manually verified with only default case (16kHz mono 16-bit).

**Session State Management:**
- Files: `src/server.js` (lines 37, 54-65, 72-75, 119, 124, 155)
- Why fragile: Single `session` variable shared across message handlers. No validation that `session` exists before access. Can be set to null mid-operation.
- Safe modification: Use Map or WeakMap indexed by reqId instead of single variable. Add null checks before every access. Consider session ID validation.
- Test coverage: No tests for multi-request concurrency or rapid connect/disconnect cycles.

**Error Context Loss:**
- Files: `src/server.js` (lines 149-151), `src/whisper.js` (lines 18-23)
- Why fragile: Error messages converted to strings without stack traces. Makes debugging difficult when errors propagate through promise chain.
- Safe modification: Log full error objects server-side, send sanitized messages to client. Implement structured logging with request IDs.
- Test coverage: No tests for error propagation or recovery scenarios.

## Scaling Limits

**Single-Process CPU Bottleneck:**
- Current capacity: Can handle 1 sequential ASR request at a time
- Limit: If whisper.cpp takes 10 seconds per request and arrives every 1 second, 9+ requests queue up
- Scaling path: Implement worker process pool using Node.js `worker_threads` or `cluster` module. Distribute whisper.cpp work across CPU cores.

**Memory Usage Unbounded on Long Sessions:**
- Current capacity: Per-session buffer limited by `maxAudioSec` (default 30s = ~960KB)
- Limit: 100+ concurrent clients with stalled sessions = 100MB+ RAM
- Scaling path: Implement session TTL and explicit cleanup. Monitor memory usage per session. Add circuit breaker for rejected new sessions if memory pressure high.

**Disk I/O on Temp Files:**
- Current capacity: 1 WAV file written per request (default 30s audio = ~960KB)
- Limit: 10 requests/second × 960KB = 9.6MB/s disk I/O
- Scaling path: Use ramdisk for temp files. Implement streaming directly to whisper.cpp stdin if whisper supports pipe input.

## Missing Critical Features

**No Request Timeout:**
- Problem: Client can start transcription and abandon request. `whisperQueue` still processes it.
- Blocks: Impossible to cancel stuck requests without restarting server

**No Graceful Shutdown:**
- Problem: If server crashes while whisper.cpp is running, temp files leak
- Blocks: Long-running production deployments accumulate orphaned files

**No Request Rate Limiting:**
- Problem: Client can spam `start` messages, filling queue
- Blocks: DoS vulnerability from single malicious client

**No Health Check for whisper.cpp Binary:**
- Problem: Server starts successfully even if `WHISPER_BIN` or `WHISPER_MODEL` are invalid
- Blocks: Errors only discovered when first request arrives

## Test Coverage Gaps

**No Unit Tests:**
- What's not tested: WAV file generation (`pcmToWavBuffer`), audio parameter validation, config parsing
- Files: All src files
- Risk: Silent corruption of WAV files, invalid configurations not caught
- Priority: High

**No Integration Tests:**
- What's not tested: Full request lifecycle (start → audio chunks → end), concurrent requests, timeout scenarios, error recovery
- Files: `src/server.js`
- Risk: Race conditions, session state corruption undetected
- Priority: High

**No E2E Tests:**
- What's not tested: Actual whisper.cpp invocation, clipboard injection, osascript interaction
- Files: `src/whisper.js`, `src/inject.js`
- Risk: Incompatibilities with new macOS versions, whisper.cpp versions not caught
- Priority: Medium

**No Stress Tests:**
- What's not tested: Behavior under high concurrency, sustained load, large audio files near limit
- Files: `src/server.js`
- Risk: Memory leaks, deadlocks, performance degradation discovered only in production
- Priority: Medium

---

*Concerns audit: 2026-02-02*
