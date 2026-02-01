import fs from 'node:fs/promises';

export function clampInt(n, min, max) {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export async function safeUnlink(path) {
  try { await fs.unlink(path); } catch (_) {}
}

export function nowMs() {
  return Date.now();
}
