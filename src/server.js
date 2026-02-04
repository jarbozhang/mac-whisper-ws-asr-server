import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';

import { config } from './config.js';
import { pcmToWavBuffer } from './wav.js';
import { runWhisper } from './whisper.js';
import { injectText, pressCommandKey } from './inject.js';
import { safeUnlink } from './utils.js';

const VALID_COMMAND_ACTIONS = new Set([
  'approve',
  'reject',
  'switch_model',
  'toggle_auto_approve'
]);

// Logging utility
function log(level, category, message, data = null) {
  const ts = new Date().toISOString();
  const prefix = `[${ts}] [${level.toUpperCase()}] [${category}]`;
  if (data) {
    console.log(`${prefix} ${message}`, JSON.stringify(data));
  } else {
    console.log(`${prefix} ${message}`);
  }
}

if (!config.authToken) {
  console.error('AUTH_TOKEN is required');
}

const clients = new Set();

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return null;
  return JSON.parse(raw);
}

function pickHookPayload(input) {
  if (!input || typeof input !== 'object') return null;

  // Always include these common fields (per Claude Code hooks docs)
  const out = {
    hook_event_name: input.hook_event_name,
    session_id: input.session_id,
    cwd: input.cwd,
    permission_mode: input.permission_mode,

    // Tool-related (common)
    tool_name: input.tool_name,
    tool_input: input.tool_input,
    tool_use_id: input.tool_use_id,

    // Other useful fields (event-specific)
    prompt: input.prompt,
    source: input.source,
    model: input.model,
    reason: input.reason,
    stop_hook_active: input.stop_hook_active,

    notification_type: input.notification_type,
    title: input.title,
    message: input.message,

    error: input.error,
    is_interrupt: input.is_interrupt
  };

  // Remove undefined keys to keep the payload small.
  for (const k of Object.keys(out)) {
    if (out[k] === undefined) delete out[k];
  }
  return out;
}

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) {
      ws.send(msg);
    }
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') {
      log('info', 'HTTP', `${req.method} ${req.url} from ${req.socket.remoteAddress}`);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, engine: 'whisper.cpp', uptimeSec: Math.floor(process.uptime()), version: '0.1.0', mdnsHostname: config.mdnsHostname || null }));
      return;
    }

    if (req.method === 'POST' && req.url === '/hook') {
      log('info', 'HTTP', `${req.method} ${req.url} from ${req.socket.remoteAddress}`);
      // Simple auth: require x-auth-token to match AUTH_TOKEN
      const token = String(req.headers['x-auth-token'] ?? '');
      if (!token || token !== config.authToken) {
        res.writeHead(401, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'unauthorized' }));
        return;
      }

      const input = await readJsonBody(req);
      log('debug', 'HTTP', 'Hook payload received', input);
      const payload = pickHookPayload(input);
      const evt = {
        type: 'hook',
        id: uuidv4(),
        ts: Date.now(),
        ...payload
      };

      broadcast(evt);
      log('info', 'HTTP', `Hook broadcast to ${clients.size} client(s)`, { hook_event_name: payload?.hook_event_name });

      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  } catch (e) {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: String(e?.message ?? e) }));
  }
});

const wss = new WebSocketServer({ server, path: '/ws' });

// Simple global mutex to run whisper serially
let whisperQueue = Promise.resolve();

// Partial recognition helper
async function runPartialRecognition(session, ws, clientId) {
  if (!session || session.parts.length === 0) return;
  if (session.isPartialProcessing) return; // Skip if already processing

  const currentBytes = session.bytes;
  if (currentBytes === session.lastPartialBytes) return; // No new data

  session.isPartialProcessing = true;
  session.lastPartialBytes = currentBytes;

  try {
    const pcm = Buffer.concat(session.parts);
    const bytesPerSec = session.sampleRate * (session.bitDepth / 8) * session.channels;
    const durSec = pcm.length / bytesPerSec;

    // Skip if too short (< 0.5s)
    if (durSec < 0.5) {
      session.isPartialProcessing = false;
      return;
    }

    const wavBuf = pcmToWavBuffer(pcm, {
      sampleRate: session.sampleRate,
      channels: session.channels,
      bitDepth: session.bitDepth
    });

    const partialWavPath = path.join(os.tmpdir(), `asr-partial-${session.reqId}-${Date.now()}.wav`);
    await fs.writeFile(partialWavPath, wavBuf);

    log('info', 'WHISPER', `Partial processing started: ${session.reqId}`, { durationSec: durSec.toFixed(2) });

    const { text, ms, outTxt } = await runWhisper({
      whisperBin: config.whisperBin,
      modelPath: config.whisperModel,
      wavPath: partialWavPath,
      extraArgs: config.whisperArgs
    });

    log('info', 'WHISPER', `Partial processing complete: ${session.reqId}`, { ms, textLength: text.length });

    // Only send if session still active and ws still open
    if (session && ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({
        type: 'partial',
        reqId: session.reqId,
        text,
        ms,
        durationSec: durSec.toFixed(2)
      }));
    }

    // Cleanup partial wav file
    await safeUnlink(partialWavPath);
    await safeUnlink(outTxt);

  } catch (err) {
    log('error', 'WHISPER', `Partial processing failed: ${session?.reqId}`, { error: err.message });
  } finally {
    if (session) {
      session.isPartialProcessing = false;
    }
  }
}

wss.on('connection', (ws, req) => {
  const remote = req.socket.remoteAddress;
  const clientId = uuidv4().slice(0, 8);

  clients.add(ws);
  log('info', 'WS', `Client connected: ${clientId}`, { remote, totalClients: clients.size });

  let session = null;

  ws.on('message', async (data, isBinary) => {
    try {
      if (!isBinary) {
        const msg = JSON.parse(data.toString('utf8'));
        log('debug', 'WS', `Message from ${clientId}`, { type: msg.type, reqId: msg.reqId, action: msg.action });

        if (msg.type === 'start') {
          if (!msg.token || msg.token !== config.authToken) {
            ws.send(JSON.stringify({ type: 'error', reqId: msg.reqId ?? null, message: 'unauthorized' }));
            ws.close();
            return;
          }

          const reqId = msg.reqId || uuidv4();
          const mode = msg.mode || config.defaultMode;

          session = {
            reqId,
            mode,
            startedAt: Date.now(),
            format: msg.format || 'pcm_s16le',
            sampleRate: msg.sampleRate || config.sampleRate,
            channels: msg.channels || config.channels,
            bitDepth: msg.bitDepth || config.bitDepth,
            chunks: 0,
            bytes: 0,
            parts: [],
            // Partial recognition state
            partialTimer: null,
            lastPartialBytes: 0,
            isPartialProcessing: false
          };

          // Start partial recognition timer
          if (config.partialIntervalMs > 0) {
            session.partialTimer = setInterval(() => {
              runPartialRecognition(session, ws, clientId);
            }, config.partialIntervalMs);
          }

          log('info', 'WS', `Session started: ${clientId}`, { reqId, mode, sampleRate: session.sampleRate, partialInterval: config.partialIntervalMs });
          ws.send(JSON.stringify({ type: 'ack', reqId, status: 'ready' }));
          return;
        }

        if (msg.type === 'end') {
          if (!session || msg.reqId !== session.reqId) {
            ws.send(JSON.stringify({ type: 'error', reqId: msg.reqId ?? null, message: 'no active session' }));
            return;
          }

          // Clear partial recognition timer
          if (session.partialTimer) {
            clearInterval(session.partialTimer);
            session.partialTimer = null;
          }

          const pcm = Buffer.concat(session.parts);
          const bytesPerSec = session.sampleRate * (session.bitDepth / 8) * session.channels;
          const durSec = pcm.length / bytesPerSec;
          log('info', 'WS', `Session ended: ${clientId}`, { reqId: session.reqId, chunks: session.chunks, bytes: session.bytes, durationSec: durSec.toFixed(2) });
          if (durSec > config.maxAudioSec) {
            ws.send(JSON.stringify({ type: 'error', reqId: session.reqId, message: `audio too long: ${durSec.toFixed(2)}s` }));
            session = null;
            return;
          }

          const wavBuf = pcmToWavBuffer(pcm, {
            sampleRate: session.sampleRate,
            channels: session.channels,
            bitDepth: session.bitDepth
          });

          const base = path.join(os.tmpdir(), `asr-${session.reqId}`);
          const wavPath = base + '.wav';
          await fs.writeFile(wavPath, wavBuf);

          // Save values before clearing session
          const savedReqId = session.reqId;
          const savedMode = session.mode;

          const run = async () => {
            const t0 = Date.now();
            log('info', 'WHISPER', `Processing started: ${savedReqId}`);
            const { text, ms, outTxt } = await runWhisper({
              whisperBin: config.whisperBin,
              modelPath: config.whisperModel,
              wavPath,
              extraArgs: config.whisperArgs
            });

            log('info', 'WHISPER', `Processing complete: ${savedReqId}`, { ms, textLength: text.length, text: text.slice(0, 100) });
            await injectText(text, savedMode);
            log('info', 'INJECT', `Text injected: ${savedReqId}`, { mode: savedMode });

            ws.send(JSON.stringify({ type: 'result', reqId: savedReqId, text, ms, engine: 'whisper.cpp' }));

            if (!config.keepDebug) {
              await safeUnlink(wavPath);
              await safeUnlink(outTxt);
            }
          };

          whisperQueue = whisperQueue.then(run).catch((err) => {
            ws.send(JSON.stringify({ type: 'error', reqId: savedReqId, message: String(err?.message ?? err) }));
          });

          session = null;
          return;
        }

        if (msg.type === 'cancel') {
          if (session?.partialTimer) {
            clearInterval(session.partialTimer);
          }
          session = null;
          ws.send(JSON.stringify({ type: 'ack', reqId: msg.reqId ?? null, status: 'cancelled' }));
          return;
        }

        if (msg.type === 'command') {
          const { action, reqId } = msg;

          // 验证 action 字段存在
          if (!action || typeof action !== 'string') {
            ws.send(JSON.stringify({
              type: 'error',
              reqId: reqId ?? null,
              message: 'command missing action field'
            }));
            return;
          }

          // 验证 action 值是否合法
          if (!VALID_COMMAND_ACTIONS.has(action)) {
            ws.send(JSON.stringify({
              type: 'error',
              reqId: reqId ?? null,
              message: `unknown command action: ${action}`
            }));
            return;
          }

          // 执行键盘命令
          try {
            await pressCommandKey(action);
            log('info', 'COMMAND', `Executed: ${action}`, { clientId, reqId: reqId ?? null });

            ws.send(JSON.stringify({
              type: 'command_ack',
              reqId: reqId ?? null,
              action,
              success: true
            }));
          } catch (err) {
            log('error', 'COMMAND', `Failed: ${action}`, { clientId, error: err.message });

            ws.send(JSON.stringify({
              type: 'command_ack',
              reqId: reqId ?? null,
              action,
              success: false,
              error: err.message
            }));
          }
          return;
        }

        ws.send(JSON.stringify({ type: 'error', reqId: msg.reqId ?? null, message: 'unknown message type' }));
        return;
      }

      // binary frame: raw pcm
      if (!session) {
        ws.send(JSON.stringify({ type: 'error', reqId: null, message: 'binary before start' }));
        return;
      }

      const buf = Buffer.from(data);
      session.parts.push(buf);
      session.chunks += 1;
      session.bytes += buf.length;

      // optional progress every ~256KB
      if (session.bytes % (256 * 1024) < buf.length) {
        ws.send(JSON.stringify({ type: 'progress', reqId: session.reqId, bytes: session.bytes }));
      }

    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', reqId: session?.reqId ?? null, message: String(e?.message ?? e) }));
    }
  });

  ws.on('close', (code, reason) => {
    if (session?.partialTimer) {
      clearInterval(session.partialTimer);
    }
    session = null;
    clients.delete(ws);
    log('info', 'WS', `Client disconnected: ${clientId}`, { code, reason: reason?.toString() || '', totalClients: clients.size });
  });

  ws.on('error', (err) => {
    log('error', 'WS', `Client error: ${clientId}`, { error: err.message });
  });
});

server.listen(config.port, config.host, () => {
  log('info', 'SERVER', `Started on http://${config.host}:${config.port}`, { wsPath: '/ws', defaultMode: config.defaultMode });
});
