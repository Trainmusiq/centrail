// Encoder WAV mínimo (PCM 16-bit) — usado para exportar previsualizaciones/pruebas.
// El exportador definitivo (mismo formato/resolución de entrada, §4.2) es trabajo futuro.

/**
 * @param {{channelData: Float32Array[], sampleRate: number}} input
 * @returns {Buffer}
 */
export function encodeWavPCM16({ channelData, sampleRate }) {
  const channels = channelData.length;
  const frames = channelData[0].length;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = frames * blockAlign;
  const buf = Buffer.alloc(44 + dataSize);

  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);              // tamaño del bloque fmt
  buf.writeUInt16LE(1, 20);               // PCM
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * blockAlign, 28); // byte rate
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(16, 34);              // bits por muestra
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      let s = channelData[c][i];
      if (s > 1) s = 1; else if (s < -1) s = -1;
      buf.writeInt16LE(Math.round(s * 32767), offset);
      offset += 2;
    }
  }
  return buf;
}
