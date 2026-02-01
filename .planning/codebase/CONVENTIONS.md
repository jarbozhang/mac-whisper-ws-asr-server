# Coding Conventions

**Analysis Date:** 2026-02-02

## Naming Patterns

**Files:**
- Lowercase with hyphens for multi-word files: `server.js`, `config.js`
- Functional purpose-based naming: `whisper.js`, `inject.js`, `wav.js`, `utils.js`
- Extensions: `.js` for JavaScript/Node.js files (ES modules)

**Functions:**
- camelCase for all function names: `clampInt()`, `safeUnlink()`, `nowMs()`, `pcmToWavBuffer()`, `runWhisper()`, `injectText()`, `pbcopy()`, `osascript()`
- Verb-based names describing action: `runWhisper()`, `injectText()`, `safeUnlink()`, `clampInt()`
- Prefix pattern for safety: `safeUnlink()` indicates safe wrapper around operation

**Variables:**
- camelCase for all variable names: `whisperQueue`, `sampleRate`, `bitDepth`, `reqId`, `startedAt`, `wavPath`, `outTxt`
- Abbreviations used: `reqId` (request ID), `msg` (message), `buf` (buffer), `ms` (milliseconds), `sec` (seconds), `res` (response), `ws` (WebSocket), `wss` (WebSocket Server)
- Descriptive names for configuration: `defaultMode`, `maxAudioSec`, `authToken`, `whisperBin`, `whisperModel`
- Object property shorthand in config exports

**Types:**
- Plain JavaScript objects used for typed structures (no TypeScript): `session`, `config`, `msg`
- Object properties are camelCase: `{ reqId, mode, startedAt, format, sampleRate, channels }`
- Configuration object pattern: exported `config` object with all settings

## Code Style

**Formatting:**
- No linter or formatter detected; code follows implicit style conventions
- 2-space indentation observed consistently
- Single quotes for strings throughout codebase
- Line length approximately 80-120 characters
- Blank lines between logical sections (imports, functions, handlers)

**Linting:**
- Not detected. No `.eslintrc`, `eslint.config.js`, or linting configuration present

**Module System:**
- ES modules: `import`/`export` syntax exclusively
- `package.json` declares `"type": "module"`
- Node.js built-in modules prefixed with `node:`: `import http from 'node:http'`, `import fs from 'node:fs/promises'`
- Third-party imports follow builtins: `import { WebSocketServer } from 'ws'`
- Local imports use relative paths with explicit `.js` extension: `import { config } from './config.js'`

## Import Organization

**Order:**
1. Node.js built-in modules (with `node:` prefix): `http`, `os`, `path`, `fs/promises`, `child_process`
2. Third-party packages: `ws`, `uuid`, `dotenv`
3. Local application modules: `./config.js`, `./wav.js`, `./whisper.js`, `./inject.js`, `./utils.js`

**Path Aliases:**
- None detected. All paths use relative imports (`./filename.js`)

**Import Styles:**
- Named imports for specific exports: `import { WebSocketServer } from 'ws'`
- Default imports for configs: `import http from 'node:http'`
- Renamed imports for clarity: `import { v4 as uuidv4 } from 'uuid'`
- Side-effect imports: `import 'dotenv/config'` in `config.js`

## Error Handling

**Patterns:**
- Try-catch blocks at message handlers level: In `server.js` WebSocket message handler, top-level try-catch captures errors and sends JSON error response
- Promise error handling: `.catch()` chain pattern used for async operations: `whisperQueue = whisperQueue.then(run).catch((err) => { ... })`
- Promise rejection in async functions: Explicit error states with context: `reject(new Error('whisper.cpp exited with code ${code}: ${stderr}'))`
- Silent catch blocks for non-critical operations: `safeUnlink()` silently ignores file deletion errors with `catch (_) {}`
- Error messaging via WebSocket: All errors sent as JSON messages: `{ type: 'error', reqId, message: String(err?.message ?? err) }`
- Validation errors inline: Check conditions and send error before processing, e.g., auth token validation, session validation

**Error Message Format:**
- Consistent structure: `{ type: 'error', reqId: [id], message: [text] }`
- Message field uses string representation: `String(err?.message ?? err)` handles Error objects and strings
- Fallback on missing error object: Nullish coalescing ensures reqId is present or null: `msg.reqId ?? null`

## Logging

**Framework:** `console` object (built-in)

**Patterns:**
- `console.error()` for critical errors at startup: `console.error('AUTH_TOKEN is required')`
- `console.log()` for operational events: Connection logs (`'WS connected: [address]'`) and startup logs (`'HTTP+WS listening on ...'`)
- No structured logging; plain text messages
- No log levels other than error/log distinction
- Timestamp and context included inline: `'WS connected: ' + remote`

**Usage:**
- Used sparingly; only for startup validation and connection events
- No debug logging detected

## Comments

**When to Comment:**
- Technical intent explanation: `// Simple global mutex to run whisper serially` explains design pattern
- Non-obvious implementation choices: `// Use output-txt to avoid parsing stdout` explains why args are structured that way
- Keyboard shortcut notation: `// Cmd+V` and `// Enter` document which keys are being pressed
- Binary frame context: `// binary frame: raw pcm` documents message type
- Progress tracking logic: `// optional progress every ~256KB` explains heuristic

**JSDoc/TSDoc:**
- Not used. No function documentation, parameter descriptions, or return type documentation

**Comment Style:**
- Single-line comments only: `//` format
- No block comments detected
- Inline comments for code clarification

## Function Design

**Size:**
- Small utility functions: `clampInt()`, `safeUnlink()`, `nowMs()` are 2-6 lines
- Medium handlers: `pbcopy()`, `osascript()` are 6-10 lines (promise wrappers)
- Larger functions: Message handler in `server.js` lines 39-152 handles all protocol logic
- Helper functions extracted: `pcmToWavBuffer()` abstracts WAV header creation, `runWhisper()` isolates subprocess handling

**Parameters:**
- Destructured object parameters: `pcmToWavBuffer(pcmBuffer, { sampleRate, channels, bitDepth })`
- Positional parameters for simple utilities: `clampInt(n, min, max)`
- Optional parameters with defaults in destructuring: `runWhisper({ whisperBin, modelPath, wavPath, extraArgs = [] })`
- Array destructuring not used

**Return Values:**
- Explicit returns for all functions
- Promise returns for async operations
- Object returns: `{ text, ms, outTxt }` from `runWhisper()`
- Void returns (no explicit return) for fire-and-forget operations like `injectText()`
- No null returns; undefined returned implicitly when function doesn't return

## Module Design

**Exports:**
- Named exports for all functions: `export function clampInt()`, `export async function safeUnlink()`
- Named export for config object: `export const config = { ... }`
- Single responsibility per module: utilities in `utils.js`, WAV operations in `wav.js`, whisper subprocess in `whisper.js`

**Barrel Files:**
- Not used. No index.js or barrel files for re-exporting

**Module Structure:**
- Flat structure: All modules at same level in `src/` directory
- `server.js` is main entry point (specified in `package.json` "main" field)
- Each module imports what it needs directly

## Object Literals and Configuration

**Pattern:**
- Plain object literals for configuration: `config` object in `config.js`
- Inline object creation for session state: `session = { reqId, mode, startedAt, format, ... }`
- Object parameter spreading: Functions receive configuration as objects rather than multiple parameters
- Nullish coalescing for defaults: `msg.format || 'pcm_s16le'` pattern used in config application

**WebSocket Messages:**
- Consistent JSON message protocol: `{ type, reqId, ...payload }`
- Message type identification: `'start'`, `'end'`, `'cancel'`, `'ack'`, `'error'`, `'result'`, `'progress'`
- Request ID tracking: Each message includes `reqId` for correlation

---

*Convention analysis: 2026-02-02*
