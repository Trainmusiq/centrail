// Regresión: encodeWav/decodeWav deben preservar sample rate, cantidad de
// muestras (duración exacta) y precisión de cuantización esperada en los tres
// bit depths que soporta el formato. Sin esto, un cambio en engine/wav.mjs
// puede romper silenciosamente la exportación (§4.4: "duración no alterada").

import { encodeWav, decodeWav } from "../engine/wav.mjs";

const SR = 44100;
const DURATION_S = 2;
const N = SR * DURATION_S;

// tolerancia de cuantización esperada por bit depth (1 / 2^(bits-1))
const EXPECTED_MAX_ERROR = { 16: 1 / 32768, 24: 1 / 8388608, 32: 1 / 2147483648 };
const TOLERANCE_FACTOR = 2; // margen sobre el error de cuantización teórico

function synthStereo(n, sr) {
  const ch0 = new Float32Array(n), ch1 = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    ch0[i] = 0.7 * Math.sin(2 * Math.PI * 440 * t);
    ch1[i] = 0.5 * Math.sin(2 * Math.PI * 220 * t) - 0.2 * Math.sin(2 * Math.PI * 880 * t);
  }
  return [ch0, ch1];
}

function maxAbsError(a, b) {
  let max = 0;
  for (let i = 0; i < a.length; i++) max = Math.max(max, Math.abs(a[i] - b[i]));
  return max;
}

let failed = false;

for (const bitDepth of [16, 24, 32]) {
  console.log(`\n── WAV ${bitDepth}-bit ──`);
  const original = synthStereo(N, SR);
  const bytes = encodeWav({ channelData: original, sampleRate: SR, bitDepth });
  const decoded = decodeWav(bytes);

  const checks = [
    ["sampleRate preservado", decoded.sampleRate === SR, `${decoded.sampleRate} !== ${SR}`],
    ["bitDepth reportado correcto", decoded.bitDepth === bitDepth, `${decoded.bitDepth} !== ${bitDepth}`],
    ["canales preservados", decoded.channelData.length === original.length, `${decoded.channelData.length} !== ${original.length}`],
    ["duración exacta (misma cantidad de muestras)", decoded.channelData[0].length === N, `${decoded.channelData[0].length} !== ${N}`],
  ];

  const err0 = maxAbsError(original[0], decoded.channelData[0]);
  const err1 = maxAbsError(original[1], decoded.channelData[1]);
  const maxErr = Math.max(err0, err1);
  const expected = EXPECTED_MAX_ERROR[bitDepth] * TOLERANCE_FACTOR;
  checks.push([`error de cuantización ≤ ${expected.toExponential(2)}`, maxErr <= expected, `error medido ${maxErr.toExponential(3)}`]);

  for (const [label, ok, detail] of checks) {
    console.log(`   ${ok ? "OK" : "FALLÓ"} — ${label}${ok ? "" : ` (${detail})`}`);
    if (!ok) failed = true;
  }
}

if (failed) {
  console.error("\nFALLÓ: al menos una verificación de WAV round-trip no pasó.");
  process.exit(1);
}
console.log("\nOK — WAV round-trip correcto en 16/24/32-bit.");
