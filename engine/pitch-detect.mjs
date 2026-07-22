// Detección de pitch en tiempo real — MPM (McLeod Pitch Method), elegido sobre
// YIN por benchmark propio en este equipo (§2/§10 de la especificación, v1.3):
// mismo presupuesto de tiempo real (ambos muy por debajo del hop disponible),
// pero MPM tuvo menor error medio Y menor error máximo bajo ruido en 3
// corridas repetidas de test/bench-pitch.mjs (error máx ~3.3-3.5¢ vs hasta
// 9.2¢ de YIN) — más robusto es lo que importa en un micrófono real.
//
// Implementación de referencia, testeable en Node (ver test/bench-pitch.mjs).
// El AudioWorkletProcessor (workers/tuner-processor.mjs) usa una COPIA sin
// imports de este mismo algoritmo — los AudioWorkletProcessor no soportan
// imports de módulos ES de forma confiable en todos los navegadores (riesgo
// conocido en Safari), así que se duplica deliberadamente en vez de importar.

const MPM_K = 0.93; // umbral relativo al pico global (McLeod & Wyvill, 2005)

/**
 * @param {Float32Array|Float64Array} buf ventana de audio (mono, [-1,1])
 * @param {number} sampleRate
 * @param {number} [minHz=60]
 * @param {number} [maxHz=1500]
 * @returns {{hz:number, confidence:number}|null}
 */
export function mpmDetect(buf, sampleRate, minHz = 60, maxHz = 1500) {
  const n = buf.length;
  const minTau = Math.max(1, Math.floor(sampleRate / maxHz));
  const maxTau = Math.min(Math.ceil(sampleRate / minHz), n >> 1);
  if (maxTau <= minTau) return null;

  const nsdf = new Float64Array(maxTau + 1);
  for (let tau = 0; tau <= maxTau; tau++) {
    let acf = 0, m = 0;
    for (let j = 0; j < n - tau; j++) {
      acf += buf[j] * buf[j + tau];
      m += buf[j] * buf[j] + buf[j + tau] * buf[j + tau];
    }
    nsdf[tau] = m > 0 ? 2 * acf / m : 0;
  }

  // picos clave: tras cada cruce por cero ascendente, el máximo local hasta el próximo descendente
  const peaks = [];
  let tau = minTau;
  while (tau < maxTau - 1) {
    if (nsdf[tau] > 0 && nsdf[tau - 1] <= 0) {
      let localMaxTau = tau, localMax = nsdf[tau];
      while (tau < maxTau - 1 && nsdf[tau] > 0) {
        if (nsdf[tau] > localMax) { localMax = nsdf[tau]; localMaxTau = tau; }
        tau++;
      }
      peaks.push({ tau: localMaxTau, value: localMax });
    }
    tau++;
  }
  if (peaks.length === 0) return null;

  const globalMax = Math.max(...peaks.map(p => p.value));
  const chosen = peaks.find(p => p.value >= globalMax * MPM_K) || peaks[0];

  let better = chosen.tau;
  if (chosen.tau > 0 && chosen.tau < maxTau) {
    const s0 = nsdf[chosen.tau - 1], s1 = nsdf[chosen.tau], s2 = nsdf[chosen.tau + 1];
    const denom = s0 - 2 * s1 + s2;
    if (denom !== 0) better = chosen.tau + 0.5 * (s0 - s2) / denom;
  }
  if (better <= 0) return null;
  return { hz: sampleRate / better, confidence: chosen.value };
}
