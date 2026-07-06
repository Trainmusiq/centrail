// Prueba de round-trip del motor de corrección (docs/especificacion.md §4.4, §10.3):
// sintetiza un tono desviado → detecta → corrige al destino → vuelve a medir → verifica ±0.5 ¢.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyze } from "../engine/detect.mjs";
import { loadRubberBand, pitchShiftOffline } from "../engine/correct.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SR = 44100;
const DURATION_S = 8;
const TOLERANCE_CENTS = 0.5;

const SCENARIOS = [
  { label: "corrección leve (caso real documentado)", sourceHz: 438.6, targetHz: 440 },
  { label: "salto grande (riesgo señalado en §4.1)", sourceHz: 440.12, targetHz: 432 },
];

function centsOf(hz, ref = 440) {
  return 1200 * Math.log2(hz / ref);
}

function synthTone(freqHz, durationS, sampleRate) {
  const n = Math.round(durationS * sampleRate);
  const buf = new Float32Array(n);
  // fundamental + un par de armónicos suaves, para que el detector tenga un espectro realista
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    buf[i] = 0.6 * Math.sin(2 * Math.PI * freqHz * t)
           + 0.25 * Math.sin(2 * Math.PI * freqHz * 2 * t)
           + 0.1 * Math.sin(2 * Math.PI * freqHz * 3 * t);
  }
  return buf;
}

async function runScenario(rbApi, { label, sourceHz, targetHz }) {
  console.log(`\n── ${label}: ${sourceHz} Hz → ${targetHz} Hz ──`);
  const original = synthTone(sourceHz, DURATION_S, SR);

  console.log("1) Detectando desviación del archivo original…");
  const before = await analyze({ channelData: [original], sampleRate: SR });
  console.log(`   Patrón detectado: ${before.refHz.toFixed(2)} Hz (${before.offset.toFixed(2)} ¢, R=${before.R.toFixed(2)})`);

  const shiftCents = centsOf(targetHz, before.refHz);
  const pitchScale = targetHz / before.refHz;
  console.log(`2) Corrigiendo a ${targetHz} Hz → shift = ${shiftCents.toFixed(2)} ¢ (pitchScale=${pitchScale.toFixed(6)})…`);

  const { channelData: [corrected] } = await pitchShiftOffline(rbApi, {
    channelData: [original],
    sampleRate: SR,
    pitchScale,
  });

  if (corrected.length !== original.length) {
    throw new Error(`La corrección alteró la duración: ${original.length} → ${corrected.length} muestras`);
  }
  console.log(`   Duración preservada: ${corrected.length} muestras (sin cambio de tempo)`);

  console.log("3) Re-midiendo el archivo corregido…");
  const after = await analyze({ channelData: [corrected], sampleRate: SR });
  const centsFromTarget = centsOf(after.refHz, targetHz);
  console.log(`   Patrón re-medido: ${after.refHz.toFixed(2)} Hz (${centsFromTarget >= 0 ? "+" : ""}${centsFromTarget.toFixed(3)} ¢ respecto al destino, R=${after.R.toFixed(2)})`);

  console.log(`4) Verificando ±${TOLERANCE_CENTS} ¢…`);
  if (Math.abs(centsFromTarget) > TOLERANCE_CENTS) {
    throw new Error(`FALLÓ (${label}): desviación de ${centsFromTarget.toFixed(3)} ¢ excede la tolerancia de ±${TOLERANCE_CENTS} ¢`);
  }
  console.log(`OK — round-trip dentro de tolerancia (${centsFromTarget.toFixed(3)} ¢ ≤ ±${TOLERANCE_CENTS} ¢)`);
}

async function main() {
  console.log("Cargando rubberband.wasm…");
  const wasmPath = path.join(__dirname, "..", "vendor", "rubberband-wasm", "rubberband.wasm");
  const wasmBytes = fs.readFileSync(wasmPath);
  const wasmModule = await WebAssembly.compile(wasmBytes);
  const rbApi = await loadRubberBand(wasmModule);

  for (const scenario of SCENARIOS) {
    await runScenario(rbApi, scenario);
  }
  console.log("\nTodos los escenarios de round-trip pasaron.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
