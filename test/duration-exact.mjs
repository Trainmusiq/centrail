// Regresión dedicada al requisito duro de §4.4: "la corrección no altera la
// duración del archivo". pitchShiftOffline() garantiza esto por construcción
// (timeRatio=1 ⇒ outputSamples = inputLength exactamente), pero un cambio
// futuro en engine/correct.mjs podría romperlo silenciosamente — este test lo
// verifica explícitamente en varios pitchScale (chico, grande, sin cambio) y
// en mono y estéreo.

import { loadRubberBand, pitchShiftOffline } from "../engine/correct.mjs";
import { loadRubberBandModule } from "./lib.mjs";

const SR = 44100;
const DURATION_S = 2;
const N = SR * DURATION_S;

function synth(n, sr, freqHz = 300) {
  const ch = new Float32Array(n);
  for (let i = 0; i < n; i++) ch[i] = 0.5 * Math.sin(2 * Math.PI * freqHz * (i / sr));
  return ch;
}

let failed = false;
function check(label, ok, detail) {
  console.log(`${ok ? "OK" : "FALLÓ"} — ${label}${ok ? "" : ` (${detail})`}`);
  if (!ok) failed = true;
}

const rbApi = await loadRubberBandModule();

const cases = [
  { label: "sin cambio (pitchScale=1)", pitchScale: 1, channels: 1 },
  { label: "shift chico (+5.5 ¢)", pitchScale: Math.pow(2, 5.5 / 1200), channels: 1 },
  { label: "shift grande (-31.8 ¢, 440→432)", pitchScale: 432 / 440, channels: 1 },
  { label: "shift grande estéreo (+100 ¢)", pitchScale: Math.pow(2, 100 / 1200), channels: 2 },
];

for (const { label, pitchScale, channels } of cases) {
  const channelData = Array.from({ length: channels }, () => synth(N, SR));
  const { channelData: corrected } = await pitchShiftOffline(rbApi, { channelData, sampleRate: SR, pitchScale });

  check(`${label}: mismo número de canales`, corrected.length === channels, `${corrected.length} !== ${channels}`);
  for (let c = 0; c < channels; c++) {
    check(`${label}: canal ${c} duración exacta`, corrected[c].length === N, `${corrected[c].length} !== ${N}`);
  }
}

if (failed) {
  console.error("\nFALLÓ: pitchShiftOffline alteró la duración en al menos un caso.");
  process.exit(1);
}
console.log("\nOK — duración exacta preservada en todos los pitchScale probados (mono y estéreo).");
