# Codebase Structure

**Analysis Date:** 2026-02-02

## Directory Layout

```
mac-whisper-ws-asr-server/
├── src/                    # All application source code
│   ├── server.js           # Main WebSocket server and HTTP health endpoint
│   ├── config.js           # Environment configuration loader
│   ├── whisper.js          # whisper.cpp subprocess orchestration
│   ├── wav.js              # PCM to WAV format conversion
│   ├── inject.js           # macOS text injection via clipboard + AppleScript
│   ├── utils.js            # Shared utility functions
│   └── README_DEV.md       # Development documentation
├── .planning/              # GSD planning directory (auto-created)
├── package.json            # Node.js dependencies and scripts
├── .env.example            # Environment variable template
├── .env                    # Actual environment variables (not committed)
├── .gitignore              # Git exclusion patterns
├── README.md               # User-facing documentation
├── SPEC.md                 # Protocol specification reference
└── LICENSE                 # MIT license

```

## Directory Purposes

**src/:**
- Purpose: All executable application code
- Contains: Server logic, configuration, utility modules, external integrations
- Key files: `server.js` (entry point), `config.js` (configuration), utility modules

## Key File Locations

**Entry Points:**
- `src/server.js`: Main application entry point, HTTP server initialization, WebSocket handler orchestration

**Configuration:**
- `src/config.js`: Centralized environment variable loading and configuration object export
- `.env.example`: Template for required environment variables
- `package.json`: Dependencies (ws, uuid, dotenv) and npm scripts

**Core Logic:**
- `src/server.js`: WebSocket protocol handler, session management, message routing, ASR pipeline orchestration
- `src/whisper.js`: whisper.cpp subprocess spawning and result parsing
- `src/wav.js`: PCM to WAV buffer conversion (audio format handling)

**Integrations:**
- `src/inject.js`: macOS clipboard and keyboard simulation (AppleScript/pbcopy)
- `src/whisper.js`: External whisper.cpp binary invocation

**Utilities:**
- `src/utils.js`: Helper functions (safeUnlink, clampInt, nowMs)

**Documentation:**
- `README.md`: User guide, features, installation, WebSocket protocol overview
- `SPEC.md`: Reference to full protocol specification in external system
- `src/README_DEV.md`: Development-specific notes

## Naming Conventions

**Files:**
- Modules: lowercase with hyphens for clarity (e.g., `server.js`, `wav.js`)
- Index/entry: `server.js` as main entry point (not index.js)
- Utilities: Named by function (e.g., `config.js`, `utils.js`)

**Functions:**
- Camel case: `runWhisper()`, `injectText()`, `pcmToWavBuffer()`, `safeUnlink()`
- Async functions explicitly named: `runWhisper`, `injectText`, `safeUnlink` (all async)
- Helper functions lowercase: `pbcopy()`, `osascript()`, `clampInt()`, `nowMs()`

**Variables:**
- Camel case for most: `session`, `whisperQueue`, `wavPath`, `outTxt`
- Config properties: Lowercase with underscores: `whisper_bin`, `whisper_model` (mapped to camelCase in code via destructuring)
- Environment variables: Uppercase with underscores: `AUTH_TOKEN`, `WHISPER_BIN`, `MAX_AUDIO_SEC`

**Types/Objects:**
- Session object: Plain object with lowercase property names: `reqId`, `mode`, `chunks`, `bytes`, `parts`
- Message objects: Plain JSON with type field: `{ type: 'start', token: ... }`

## Where to Add New Code

**New Feature:**
- Primary code: `src/server.js` (if modifying WebSocket protocol or session handling) or new module in `src/`
- Tests: Not currently used; would create `tests/` directory
- Configuration: Add to `src/config.js` environment variables section and exports

**New Module/Component:**
- Implementation: Create new file in `src/` directory (e.g., `src/newfeature.js`)
- Export: Use ES module named exports (`export function nameOfFunction()`)
- Import: Import in `src/server.js` where needed
- Configuration: If requires env vars, add to `src/config.js`

**Text Injection Variants:**
- Modify: `src/inject.js` to add new modes or injection methods
- Update: `src/config.js` DEFAULT_MODE option
- Reference: Update `src/server.js` line 105 if mode handling changes

**Audio Format Support:**
- Add format handler: Create function in `src/wav.js` for new format (currently PCM s16le)
- Configuration: Add to `src/config.js` for format-specific parameters
- Session: Update session object in `src/server.js` lines 54-65 if new fields needed
- Validation: Add format validation in message handler (lines 44-69)

**External Process Integration:**
- Pattern: Follow `src/whisper.js` approach - spawn subprocess, handle stdio, wait for exit
- Location: Create new module or extend `src/whisper.js`
- Queue: If needs serialization, extend `whisperQueue` mechanism or create new queue
- Error handling: Catch subprocess errors, parse stderr, return structured results

**Utilities:**
- Shared helpers: Add to `src/utils.js`
- Format-specific: Create dedicated module (e.g., `src/formats.js`)
- External integrations: Create dedicated module (e.g., `src/clipboard.js` for macOS helpers)

## Special Directories

**node_modules/:**
- Purpose: NPM dependencies (ws, uuid, dotenv)
- Generated: Yes (generated by `npm install`)
- Committed: No (in .gitignore)

**.env:**
- Purpose: Runtime configuration secrets and paths
- Generated: No (created manually from .env.example)
- Committed: No (in .gitignore)
- Required before runtime: Yes (AUTH_TOKEN, WHISPER_BIN, WHISPER_MODEL must be set)

**.planning/codebase/:**
- Purpose: GSD mapping documents (ARCHITECTURE.md, STRUCTURE.md, etc.)
- Generated: Yes (by GSD mapping commands)
- Committed: Yes (planning artifacts are tracked)

## Configuration-Driven Behavior

**Environment Variables (src/config.js):**
- `HOST`: Server listening address (default: '0.0.0.0')
- `PORT`: Server listening port (default: 8765)
- `AUTH_TOKEN`: WebSocket authentication token (required, no default)
- `WHISPER_BIN`: Path to whisper.cpp binary (required, no default)
- `WHISPER_MODEL`: Path to whisper model file (required, no default)
- `WHISPER_ARGS`: Extra arguments to pass to whisper.cpp (optional, space-separated)
- `DEFAULT_MODE`: Default text injection mode (default: 'return_only')
- `MAX_AUDIO_SEC`: Maximum audio duration allowed (default: 30)
- `SAMPLE_RATE`: Audio sample rate in Hz (default: 16000)
- `CHANNELS`: Number of audio channels (default: 1, mono)
- `BIT_DEPTH`: Bits per sample (default: 16)
- `KEEP_DEBUG`: Preserve WAV and output files after processing (default: false)

---

*Structure analysis: 2026-02-02*
