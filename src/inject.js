import { spawn } from 'node:child_process';

function pbcopy(text) {
  return new Promise((resolve, reject) => {
    const p = spawn('pbcopy');
    p.on('error', reject);
    p.stdin.write(text, 'utf8');
    p.stdin.end();
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`pbcopy exited ${code}`))));
  });
}

function osascript(script) {
  return new Promise((resolve, reject) => {
    const p = spawn('osascript', ['-e', script]);
    let stderr = '';
    p.stderr.on('data', (d) => (stderr += d.toString('utf8')));
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`osascript exited ${code}: ${stderr}`))));
  });
}

export async function injectText(text, mode) {
  if (mode === 'return_only') return;

  await pbcopy(text);
  // Cmd+V
  await osascript('tell application "System Events" to keystroke "v" using command down');

  if (mode === 'paste_enter') {
    // Enter
    await osascript('tell application "System Events" to key code 36');
  }
}

const COMMAND_KEYS = {
  approve: 'key code 36', // Enter
  reject: 'key code 53', // Escape
  switch_model: 'keystroke "p" using option down', // Option+P
  toggle_auto_approve: 'key code 48 using shift down' // Shift+Tab
};

export async function pressCommandKey(action) {
  const keyCommand = COMMAND_KEYS[action];
  if (!keyCommand) {
    throw new Error(`unknown command action: ${action}`);
  }
  await osascript(`tell application "System Events" to ${keyCommand}`);
}
