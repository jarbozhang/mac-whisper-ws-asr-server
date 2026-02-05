import { spawn } from 'node:child_process';
import { config } from './config.js';

let serverProcess = null;
let serverReady = false;

function log(level, message, data = null) {
  const ts = new Date().toISOString();
  const prefix = `[${ts}] [${level.toUpperCase()}] [WHISPER-SERVER]`;
  if (data) {
    console.log(`${prefix} ${message}`, JSON.stringify(data));
  } else {
    console.log(`${prefix} ${message}`);
  }
}

async function waitForServer(url, maxRetries = 30, intervalMs = 500) {
  const healthUrl = url.replace(/\/$/, '') + '/health';

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(healthUrl, { method: 'GET', signal: AbortSignal.timeout(2000) });
      if (response.ok) {
        return true;
      }
    } catch (e) {
      // Server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  return false;
}

export async function startWhisperServer() {
  if (!config.whisperAutoStart) {
    log('info', 'Auto-start disabled, skipping');
    return false;
  }

  if (!config.whisperServerBin) {
    log('error', 'WHISPER_SERVER_BIN not configured');
    return false;
  }

  if (!config.whisperModel) {
    log('error', 'WHISPER_MODEL not configured');
    return false;
  }

  if (serverProcess) {
    log('warn', 'Server already running');
    return true;
  }

  // Filter args that are valid for whisper-server
  // whisper-server doesn't support: --temperature
  const invalidFlags = ['--temperature'];
  const validServerArgs = [];
  let skipNext = false;
  for (const arg of config.whisperArgs) {
    if (skipNext) {
      skipNext = false;
      continue;
    }
    if (invalidFlags.includes(arg)) {
      skipNext = true; // Skip this flag and its value
      continue;
    }
    validServerArgs.push(arg);
  }

  const args = [
    '--model', config.whisperModel,
    '--host', config.whisperServerHost,
    '--port', String(config.whisperServerPort)
  ];

  // Add prompt if configured
  if (config.whisperPrompt) {
    args.push('--prompt', config.whisperPrompt);
  }

  args.push(...validServerArgs);

  log('info', 'Starting whisper server', {
    bin: config.whisperServerBin,
    model: config.whisperModel,
    host: config.whisperServerHost,
    port: config.whisperServerPort
  });

  serverProcess = spawn(config.whisperServerBin, args, {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  serverProcess.stdout.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) log('debug', `stdout: ${msg}`);
  });

  serverProcess.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) log('debug', `stderr: ${msg}`);
  });

  serverProcess.on('error', (err) => {
    log('error', 'Failed to start server', { error: err.message });
    serverProcess = null;
    serverReady = false;
  });

  serverProcess.on('close', (code) => {
    log('info', 'Server process exited', { code });
    serverProcess = null;
    serverReady = false;
  });

  // Wait for server to be ready
  const serverUrl = `http://${config.whisperServerHost}:${config.whisperServerPort}`;
  log('info', 'Waiting for server to be ready...');

  const ready = await waitForServer(serverUrl);

  if (ready) {
    serverReady = true;
    log('info', 'Server is ready', { url: serverUrl });
    return true;
  } else {
    log('error', 'Server failed to start within timeout');
    stopWhisperServer();
    return false;
  }
}

export function stopWhisperServer() {
  if (serverProcess) {
    log('info', 'Stopping whisper server');
    serverProcess.kill('SIGTERM');

    // Force kill after 5 seconds if still running
    setTimeout(() => {
      if (serverProcess) {
        log('warn', 'Force killing server');
        serverProcess.kill('SIGKILL');
      }
    }, 5000);

    serverProcess = null;
    serverReady = false;
  }
}

export function isServerReady() {
  return serverReady;
}

export function getServerUrl() {
  // If auto-start is enabled, only return URL if server is actually ready
  if (config.whisperAutoStart) {
    if (serverReady) {
      return `http://${config.whisperServerHost}:${config.whisperServerPort}`;
    }
    // Auto-start enabled but server not ready = fall back to CLI
    return '';
  }
  // If not auto-start, use external server URL if configured
  if (config.whisperServerUrl) {
    return config.whisperServerUrl;
  }
  return '';
}
