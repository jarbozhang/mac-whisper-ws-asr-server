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

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, engine: 'whisper.cpp', uptimeSec: Math.floor(process.uptime()), version: '0.1.0' }));
    return;
  }
  res.writeHead(404);
  res.end('Not found');
});

const wss = new WebSocketServer({ server, path: '/ws' });

// Simple global mutex to run whisper serially
let whisperQueue = Promise.resolve();

wss.on('connection', (ws, req) => {
  const remote = req.socket.remoteAddress;

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

          const run = async () => {
            const t0 = Date.now();
            const { text, ms, outTxt } = await runWhisper({
              whisperBin: config.whisperBin,
              modelPath: config.whisperModel,
              wavPath,
              extraArgs: config.whisperArgs
            });

            await injectText(text, session.mode);

            ws.send(JSON.stringify({ type: 'result', reqId: session.reqId, text, ms, engine: 'whisper.cpp' }));

            if (!config.keepDebug) {
              await safeUnlink(wavPath);
              await safeUnlink(outTxt);
            }
          };

          whisperQueue = whisperQueue.then(run).catch((err) => {
            ws.send(JSON.stringify({ type: 'error', reqId: session.reqId, message: String(err?.message ?? err) }));
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
  });

  console.log('WS connected:', remote);
});

server.listen(config.port, config.host, () => {
  console.log(`HTTP+WS listening on http://${config.host}:${config.port} (ws path /ws)`);
});
