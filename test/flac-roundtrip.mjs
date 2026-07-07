// Regresión: encodeFlacWith/decodeFlac (via @wasm-audio-decoders/flac) deben
// preservar sample rate, bit depth y duración exacta, y no deben introducir
// drift de medición: comparamos la medición de engine/detect.mjs ANTES de
// codificar contra la medición DESPUÉS de decodificar — no contra la
// frecuencia fundamental teórica, porque el tono de prueba es fundamental +
// 2 armónicos (igual que test/roundtrip.mjs) y el detector pondera todos los
// picos espectrales: medir ~438.70 Hz para un fundamental de 438.6 Hz es el
// comportamiento correcto y ya validado del algoritmo, no un error de FLAC.
// Cubre los dos bit depths que soporta el encoder (16/24 — no existe FLAC de
// 32-bit entero en esta app).

import { encodeFlacWith } from "../engine/flac-encode.mjs";
import { decodeFlacBytes, centsOf, loadFlacEncoderNode } from "./lib.mjs";
import { analyze } from "../engine/detect.mjs";

const SR = 44100;
const DURATION_S = 8;
const N = SR * DURATION_S;
const SOURCE_HZ = 438.6;
const TOLERANCE_CENTS = 0.1; // drift introducido por el ciclo encode/decode, no vs. el fundamental teórico

function synthStereo(freqHz, n, sr) {
  const ch0 = new Float32Array(n), ch1 = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const v = 0.6 * Math.sin(2 * Math.PI * freqHz * t) + 0.25 * Math.sin(2 * Math.PI * freqHz * 2 * t) + 0.1 * Math.sin(2 * Math.PI * freqHz * 3 * t);
    ch0[i] = v; ch1[i] = v * 0.9;
  }
  return [ch0, ch1];
}

let failed = false;

const Flac = await loadFlacEncoderNode();
const original = synthStereo(SOURCE_HZ, N, SR);
const before = await analyze({ channelData: original, sampleRate: SR });
console.log(`Medición antes de codificar: ${before.refHz.toFixed(3)} Hz (fundamental de prueba: ${SOURCE_HZ} Hz)`);

for (const bitDepth of [16, 24]) {
  console.log(`\n── FLAC ${bitDepth}-bit ──`);
  const bytes = encodeFlacWith(Flac, { channelData: original, sampleRate: SR, bitDepth, compressionLevel: 3 });
  const decoded = await decodeFlacBytes(bytes);

  const checks = [
    ["sampleRate preservado", decoded.sampleRate === SR, `${decoded.sampleRate} !== ${SR}`],
    ["bitDepth reportado correcto", decoded.bitDepth === bitDepth, `${decoded.bitDepth} !== ${bitDepth}`],
    ["duración exacta (misma cantidad de muestras)", decoded.channelData[0].length === N, `${decoded.channelData[0].length} !== ${N}`],
  ];
  for (const [label, ok, detail] of checks) {
    console.log(`   ${ok ? "OK" : "FALLÓ"} — ${label}${ok ? "" : ` (${detail})`}`);
    if (!ok) failed = true;
  }

  const after = await analyze({ channelData: decoded.channelData, sampleRate: decoded.sampleRate });
  const dev = centsOf(after.refHz, before.refHz);
  const ok = Math.abs(dev) <= TOLERANCE_CENTS;
  console.log(`   ${ok ? "OK" : "FALLÓ"} — re-medido tras encode/decode: ${after.refHz.toFixed(3)} Hz (${dev >= 0 ? "+" : ""}${dev.toFixed(3)} ¢ de drift vs la medición pre-FLAC, tolerancia ±${TOLERANCE_CENTS} ¢)`);
  if (!ok) failed = true;
}

if (failed) {
  console.error("\nFALLÓ: al menos una verificación de FLAC round-trip no pasó.");
  process.exit(1);
}
console.log("\nOK — FLAC round-trip correcto en 16/24-bit (encode → decode → re-medir, sin drift).");
