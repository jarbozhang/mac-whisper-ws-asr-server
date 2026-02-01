// Create a WAV buffer from raw PCM s16le
// Assumes little-endian, 16-bit, mono by default.

export function pcmToWavBuffer(pcmBuffer, { sampleRate, channels, bitDepth }) {
  const bytesPerSample = bitDepth / 8;
  const blockAlign = channels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;

  const dataSize = pcmBuffer.length;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const buf = Buffer.alloc(totalSize);
  let o = 0;
  buf.write('RIFF', o); o += 4;
  buf.writeUInt32LE(totalSize - 8, o); o += 4;
  buf.write('WAVE', o); o += 4;

  buf.write('fmt ', o); o += 4;
  buf.writeUInt32LE(16, o); o += 4;            // PCM fmt chunk size
  buf.writeUInt16LE(1, o); o += 2;             // audio format 1=PCM
  buf.writeUInt16LE(channels, o); o += 2;
  buf.writeUInt32LE(sampleRate, o); o += 4;
  buf.writeUInt32LE(byteRate, o); o += 4;
  buf.writeUInt16LE(blockAlign, o); o += 2;
  buf.writeUInt16LE(bitDepth, o); o += 2;

  buf.write('data', o); o += 4;
  buf.writeUInt32LE(dataSize, o); o += 4;

  pcmBuffer.copy(buf, o);
  return buf;
}
