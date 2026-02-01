# Testing Patterns

**Analysis Date:** 2026-02-02

## Test Framework

**Status:** No testing framework detected

**Runner:**
- Not detected. No test runner configuration found (Jest, Vitest, Mocha, etc.)
- No test files present in repository (no `*.test.js`, `*.spec.js` files)

**Assertion Library:**
- Not detected

**Run Commands:**
- No test scripts defined in `package.json`
- `"scripts"` only contains: `"start": "node src/server.js"` and `"dev": "node src/server.js"`

**Testing Gap:** This codebase has zero test coverage. Testing framework and test suite are absent.

## Test File Organization

**Current State:**
- No tests exist
- No test directory structure (no `tests/`, `__tests__/`, `spec/` directories)

**Recommended Future Patterns (if testing is added):**
- Location: Co-locate with source files using `.test.js` suffix in `src/` directory
  - Example: `src/config.test.js`, `src/utils.test.js`, `src/whisper.test.js`
- Or: Separate `tests/` directory mirroring `src/` structure
  - Example: `tests/unit/utils.test.js`, `tests/integration/server.test.js`

## Test Structure

**No tests to analyze**

When testing is implemented, the structure would typically be:

```javascript
// Example pattern for async function testing
describe('runWhisper', () => {
  it('should return text and milliseconds', async () => {
    // arrange
    // act
    // assert
  });

  it('should reject on non-zero exit code', async () => {
    // arrange
    // act
    // assert
  });
});
```

## Mocking

**Current State:** No mocking framework detected

**Framework Needed:**
- Not configured. Would need: Jest mocks, Sinon, or similar for Node.js

**Modules That Would Require Mocking:**
- `child_process` spawning (in `whisper.js` and `inject.js`): Mock `spawn()` to avoid actual process execution
- File system operations (in `server.js`, `whisper.js`): Mock `fs` methods (`writeFile`, `readFile`, `unlink`)
- `pbcopy` and `osascript` (in `inject.js`): Mock OS command execution
- WebSocket connections (in `server.js`): Mock WebSocket Server and client connections
- External process execution (whisper.cpp binary)

**What to Mock:**
- System calls: `spawn()`, `fs.unlink()`, `fs.writeFile()`, `fs.readFile()`
- OS-specific commands: `pbcopy`, `osascript` (macOS only)
- WebSocket events: Connection, message, close handlers
- Process lifecycle: `close` events, error conditions

**What NOT to Mock:**
- Pure utility functions: `clampInt()`, `nowMs()` can be tested without mocks
- Configuration loading: `config` object (if env vars are controlled in test environment)
- Buffer operations: `pcmToWavBuffer()` logic (WAV header generation is testable with real buffers)

## Fixtures and Factories

**Current State:** None detected

**Test Data Would Be Needed:**
- Sample PCM audio buffer for WAV conversion tests
- Mock WebSocket messages: `{ type: 'start', token, mode, format, sampleRate, channels, bitDepth }`
- Mock session objects: `{ reqId, mode, startedAt, format, sampleRate, channels, bitDepth, chunks, bytes, parts }`
- Example WAV file output from whisper.cpp
- Sample transcribed text results

**Recommended Location (if added):**
- `tests/fixtures/audio.js` - PCM samples and WAV buffers
- `tests/fixtures/messages.js` - WebSocket protocol message templates
- `tests/fixtures/config.js` - Test environment configuration

## Coverage

**Current Status:** No testing infrastructure

**Requirements:** Not enforced (no tests exist)

**View Coverage:**
- Not applicable without test suite

**Coverage Targets (if implemented):**
- Should focus on critical paths: Authentication validation, session lifecycle, error handling
- Protocol correctness: Message type handling, reqId tracking
- Data transformations: PCM to WAV conversion
- Edge cases: Audio length validation, invalid message types, connection drops

## Test Types

**Unit Tests (if implemented):**
- Scope: Individual functions in isolation
- Approach: Mock external dependencies (fs, spawn, etc.)
- Candidates:
  - `clampInt()` - Pure function, no dependencies
  - `pcmToWavBuffer()` - Pure transformation, testable with sample buffers
  - `safeUnlink()` - Would mock fs.unlink()

**Integration Tests (if implemented):**
- Scope: Multiple modules working together
- Approach: Mock system calls but test real module interactions
- Candidates:
  - Full message flow: `start` → binary data chunks → `end` → whisper execution
  - WebSocket protocol: Connection handling, message routing, error responses
  - Config loading from environment variables
  - Session lifecycle with state transitions

**E2E Tests:**
- Not used currently
- Not applicable for this headless ASR server without UI
- Could be implemented using WebSocket client to send actual audio and verify response

## Common Patterns

**Testing Async Operations:**

If tests are implemented for `runWhisper()`:
```javascript
// Pattern: Test async function with mock spawn
it('should execute whisper.cpp and return transcription', async () => {
  const mockChild = {
    on: jest.fn((event, handler) => {
      if (event === 'close') setTimeout(() => handler(0), 10);
    }),
    stderr: { on: jest.fn() }
  };

  jest.spyOn(childProcess, 'spawn').mockReturnValue(mockChild);

  const result = await runWhisper({
    whisperBin: '/path/to/whisper',
    modelPath: '/path/to/model.bin',
    wavPath: '/tmp/test.wav'
  });

  expect(result).toHaveProperty('text');
  expect(result).toHaveProperty('ms');
});
```

**Error Testing:**

Pattern for testing error scenarios:
```javascript
// Test promise rejection from subprocess failure
it('should reject when whisper exits with error code', async () => {
  const mockChild = {
    on: jest.fn((event, handler) => {
      if (event === 'close') setTimeout(() => handler(1), 10);
    }),
    stderr: { on: jest.fn() }
  };

  jest.spyOn(childProcess, 'spawn').mockReturnValue(mockChild);

  await expect(runWhisper(...)).rejects.toThrow('whisper.cpp exited with code 1');
});
```

**WebSocket Message Testing:**

Pattern for testing protocol handlers:
```javascript
// Test WebSocket message routing
it('should send error for unauthorized token', async () => {
  const mockWs = {
    send: jest.fn(),
    close: jest.fn()
  };

  // Simulate message handler with mock ws
  const messageData = JSON.stringify({
    type: 'start',
    token: 'invalid',
    reqId: 'test-123'
  });

  // Call handler...
  // expect(mockWs.send).toHaveBeenCalledWith(expect.stringContaining('unauthorized'));
});
```

## Critical Testing Gaps

**High Priority:**
1. Authentication validation (`AUTH_TOKEN` check)
   - Files: `src/server.js` line 45-49
   - Currently untested protocol validation

2. Session state machine
   - Files: `src/server.js` lines 44-127
   - Message sequencing rules (`start` → binary chunks → `end`)
   - No validation that `end` follows `start`

3. Audio length validation
   - Files: `src/server.js` lines 80-84
   - `maxAudioSec` enforcement

4. Error propagation
   - Files: `src/server.js` lines 40-151
   - Error messages properly sent back to client
   - Session cleanup on error

**Medium Priority:**
1. WAV buffer generation
   - Files: `src/wav.js`
   - Correct header format for whisper.cpp compatibility

2. PCM to WAV conversion parameters
   - Sample rate, channels, bit depth handling
   - Test with various configurations

3. Subprocess error handling
   - Files: `src/whisper.js`
   - stderr capture and message formatting
   - Exit code handling

**Low Priority:**
1. Configuration defaults
   - Files: `src/config.js`
   - Environment variable parsing

2. Utility functions
   - `clampInt()` edge cases (NaN, Infinity)
   - `nowMs()` time function (trivial)

---

*Testing analysis: 2026-02-02*
