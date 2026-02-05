import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';

// CLI mode: spawn whisper-cli process
async function runWhisperCli({ whisperBin, modelPath, wavPath, extraArgs = [] }) {
  const outBase = wavPath.replace(/\.wav$/i, '');
  const outTxt = outBase + '.txt';

  // Build args with prompt if configured
  const args = ['-m', modelPath, '-f', wavPath, '--output-txt', '--output-file', outBase];

  // Add prompt before extraArgs so user can override via WHISPER_ARGS
  if (config.whisperPrompt) {
    args.push('--prompt', config.whisperPrompt);
  }

  args.push(...extraArgs);

  const start = Date.now();
  const child = spawn(whisperBin, args, { stdio: ['ignore', 'pipe', 'pipe'] });

  let stderr = '';
  child.stderr.on('data', (d) => { stderr += d.toString('utf8'); });

  await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`whisper.cpp exited with code ${code}: ${stderr}`));
    });
  });

  const txt = await fs.readFile(outTxt, 'utf8');
  const ms = Date.now() - start;
  const text = txt.replace(/\r/g, '').trim();
  return { text, ms, outTxt };
}

// HTTP mode: call whisper-server API
async function runWhisperHttp({ serverUrl, wavPath }) {
  const start = Date.now();

  // Read wav file as buffer
  const wavBuffer = await fs.readFile(wavPath);

  // Build multipart form data manually
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).slice(2);
  const fileName = path.basename(wavPath);

  const bodyParts = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${fileName}"`,
    'Content-Type: audio/wav',
    '',
    '', // Will be replaced with binary data
  ];

  const headerBuffer = Buffer.from(bodyParts.join('\r\n'), 'utf8');
  const footerBuffer = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
  const body = Buffer.concat([headerBuffer, wavBuffer, footerBuffer]);

  // Parse URL
  const url = new URL(serverUrl.endsWith('/inference') ? serverUrl : serverUrl + '/inference');

  // Make HTTP request using native fetch (Node 18+)
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': body.length.toString()
    },
    body
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`whisper-server error ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  const ms = Date.now() - start;

  // whisper-server returns { text: "..." } or similar
  const text = (result.text || '').trim();

  return { text, ms, outTxt: null };
}

// Main entry point - choose CLI or HTTP based on config
export async function runWhisper({ whisperBin, modelPath, wavPath, extraArgs = [], serverUrl = '' }) {
  if (serverUrl) {
    return runWhisperHttp({ serverUrl, wavPath });
  }
  return runWhisperCli({ whisperBin, modelPath, wavPath, extraArgs });
}

// Export HTTP runner for direct use
export { runWhisperHttp };
