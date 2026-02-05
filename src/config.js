import 'dotenv/config';

export const config = {
  host: process.env.HOST ?? '0.0.0.0',
  port: Number(process.env.PORT ?? '8765'),
  authToken: process.env.AUTH_TOKEN ?? '',
  mdnsHostname: process.env.MDNS_HOSTNAME ?? '',

  // Whisper CLI mode
  whisperBin: process.env.WHISPER_BIN ?? '',
  whisperModel: process.env.WHISPER_MODEL ?? '',
  whisperArgs: (process.env.WHISPER_ARGS ?? '').trim().length
    ? (process.env.WHISPER_ARGS ?? '').trim().split(/\s+/)
    : [],
  whisperPrompt: process.env.WHISPER_PROMPT ?? '以下是普通话的句子。我在写代码，使用 function 定义函数，通过 API 调用接口。',

  // Whisper server mode
  whisperServerBin: process.env.WHISPER_SERVER_BIN ?? '',
  whisperServerHost: process.env.WHISPER_SERVER_HOST ?? '127.0.0.1',
  whisperServerPort: Number(process.env.WHISPER_SERVER_PORT ?? '8766'),
  whisperServerUrl: process.env.WHISPER_SERVER_URL ?? '',
  whisperAutoStart: String(process.env.WHISPER_AUTO_START ?? 'false').toLowerCase() === 'true',

  defaultMode: process.env.DEFAULT_MODE ?? 'paste',
  maxAudioSec: Number(process.env.MAX_AUDIO_SEC ?? '30'),
  sampleRate: Number(process.env.SAMPLE_RATE ?? '16000'),
  channels: Number(process.env.CHANNELS ?? '1'),
  bitDepth: Number(process.env.BIT_DEPTH ?? '16'),
  keepDebug: String(process.env.KEEP_DEBUG ?? 'false').toLowerCase() === 'true'
};
