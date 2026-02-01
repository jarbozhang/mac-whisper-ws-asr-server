import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

export async function runWhisper({ whisperBin, modelPath, wavPath, extraArgs = [] }) {
  const outBase = wavPath.replace(/\.wav$/i, '');
  const outTxt = outBase + '.txt';

  // Use output-txt to avoid parsing stdout
  const args = ['-m', modelPath, '-f', wavPath, '--output-txt', '--output-file', outBase, ...extraArgs];

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
