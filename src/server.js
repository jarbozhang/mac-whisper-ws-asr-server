import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';

import { config } from './config.js';
import { pcmToWavBuffer } from './wav.js';
import { runWhisper } from './whisper.js';
import { injectText } from './inject.js';
import { safeUnlink } from './utils.js';

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
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, engine: 'whisper.cpp', uptimeSec: Math.floor(process.uptime()), version: '0.1.0', mdnsHostname: config.mdnsHostname || null }));
      return;
    }

    if (req.method === 'POST' && req.url === '/hook') {
      // Simple auth: require x-auth-token to match AUTH_TOKEN
      const token = String(req.headers['x-auth-token'] ?? '');
      if (!token || token !== config.authToken) {
        res.writeHead(401, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'unauthorized' }));
        return;
      }

      const input = await readJsonBody(req);
      const payload = pickHookPayload(input);
      const evt = {
        type: 'hook',
        id: uuidv4(),
        ts: Date.now(),
        ...payload
      };

      broadcast(evt);

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

wss.on('connection', (ws, req) => {
  const remote = req.socket.remoteAddress;

  clients.add(ws);

  let session = null;

  ws.on('message', async (data, isBinary) => {
    try {
      if (!isBinary) {
        const msg = JSON.parse(data.toString('utf8'));

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
            parts: []
          };

          ws.send(JSON.stringify({ type: 'ack', reqId, status: 'ready' }));
          return;
        }

        if (msg.type === 'end') {
          if (!session || msg.reqId !== session.reqId) {
            ws.send(JSON.stringify({ type: 'error', reqId: msg.reqId ?? null, message: 'no active session' }));
            return;
          }

          const pcm = Buffer.concat(session.parts);
          const bytesPerSec = session.sampleRate * (session.bitDepth / 8) * session.channels;
          const durSec = pcm.length / bytesPerSec;
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
            const { text, ms, outTxt } = await runWhisper({
              whisperBin: config.whisperBin,
              modelPath: config.whisperModel,
              wavPath,
              extraArgs: config.whisperArgs
            });

            await injectText(text, savedMode);

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
          session = null;
          ws.send(JSON.stringify({ type: 'ack', reqId: msg.reqId ?? null, status: 'cancelled' }));
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

  ws.on('close', () => {
    session = null;
    clients.delete(ws);
  });

  console.log('WS connected:', remote);
});

server.listen(config.port, config.host, () => {
  console.log(`HTTP+WS listening on http://${config.host}:${config.port} (ws path /ws)`);
});
