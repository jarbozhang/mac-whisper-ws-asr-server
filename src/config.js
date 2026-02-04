import 'dotenv/config';

export const config = {
  host: process.env.HOST ?? '0.0.0.0',
  port: Number(process.env.PORT ?? '8765'),
  authToken: process.env.AUTH_TOKEN ?? '',
  mdnsHostname: process.env.MDNS_HOSTNAME ?? '',

  whisperBin: process.env.WHISPER_BIN ?? '',
  whisperModel: process.env.WHISPER_MODEL ?? '',
  whisperArgs: (process.env.WHISPER_ARGS ?? '').trim().length
    ? (process.env.WHISPER_ARGS ?? '').trim().split(/\s+/)
    : [],

  defaultMode: process.env.DEFAULT_MODE ?? 'paste',
  partialIntervalMs: Number(process.env.PARTIAL_INTERVAL_MS ?? '3000'),
  maxAudioSec: Number(process.env.MAX_AUDIO_SEC ?? '30'),
  sampleRate: Number(process.env.SAMPLE_RATE ?? '16000'),
  channels: Number(process.env.CHANNELS ?? '1'),
  bitDepth: Number(process.env.BIT_DEPTH ?? '16'),
  keepDebug: String(process.env.KEEP_DEBUG ?? 'false').toLowerCase() === 'true'
};
