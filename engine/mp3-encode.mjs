// Encoder MP3 (vendor/lamejs) — exportación §4.2: siempre con pérdida, 320 kbps
// por defecto, ofrecido junto a WAV/FLAC (nunca en su reemplazo).

import { Mp3Encoder } from "../vendor/lamejs/lamejs.js?v=1.3.1";

const BLOCK_SIZE = 1152; // tamaño de bloque nativo de LAME

function floatToInt16(f) {
  const out = new Int16Array(f.length);
  for (let i = 0; i < f.length; i++) {
    let s = f[i];
    if (s > 1) s = 1; else if (s < -1) s = -1;
    out[i] = s < 0 ? s * 32768 : s * 32767;
  }
  return out;
}

/**
 * @param {{channelData: Float32Array[], sampleRate: number, kbps?: number}} input
 * @param {(p:number)=>void} [onProgress]
 * @returns {Promise<Uint8Array>}
 */
export async function encodeMp3({ channelData, sampleRate, kbps = 320 }, onProgress) {
  // lamejs/LAME solo soporta mono o estéreo — si el archivo tiene más canales
  // (caso raro), se usan los dos primeros, que es lo que MP3 puede representar.
  const channels = Math.min(2, channelData.length);
  const frames = channelData[0].length;
  const enc = new Mp3Encoder(channels, sampleRate, kbps);

  const left = floatToInt16(channelData[0]);
  const right = channels > 1 ? floatToInt16(channelData[1]) : left;

  const chunks = [];
  const nBlocks = Math.ceil(frames / BLOCK_SIZE);
  for (let b = 0; b < nBlocks; b++) {
    const start = b * BLOCK_SIZE;
    const end = Math.min(frames, start + BLOCK_SIZE);
    const buf = enc.encodeBuffer(left.subarray(start, end), right.subarray(start, end));
    if (buf.length > 0) chunks.push(buf);
    if (onProgress && ((b & 63) === 63 || b === nBlocks - 1)) {
      onProgress((b + 1) / nBlocks);
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  const tail = enc.flush();
  if (tail.length > 0) chunks.push(tail);

  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}
