// AudioWorkletProcessor del afinador en vivo (v1.3) — deliberadamente SIN
// IMPORTS: el soporte de módulos ES dentro de un AudioWorkletProcessor ha sido
// históricamente inconsistente en Safari, y este es un requisito móvil
// explícito del proyecto. El algoritmo MPM se copia inline (duplicación
// aceptada y documentada) desde la implementación canónica y testeable en
// engine/pitch-detect.mjs — si se ajusta el algoritmo ahí, replicar el cambio
// aquí a mano.
//
// Elegido por benchmark propio (test/bench-pitch.mjs, ver docs/especificacion.md
// §2 v1.3): MPM sobre YIN, menor error medio Y menor error máximo bajo ruido
// en corridas repetidas, ambos muy por debajo del presupuesto de tiempo real.

const WINDOW = 2048;      // muestras por análisis (~46ms @44100Hz)
const HOP = 512;          // avance entre análisis (~11.6ms @44100Hz, 75% overlap)
const REPORT_INTERVAL_MS = 50; // throttle de postMessage — no cada quantum de 128 muestras
const MIN_HZ = 60, MAX_HZ = 1500;
const MPM_K = 0.93;
const CONFIDENCE_THRESHOLD = 0.5; // por debajo, no hay periodicidad clara (ruido/silencio)
const RMS_FLOOR = 0.003;          // por debajo, no hay señal real que analizar
const MEDIAN_HISTORY = 3;         // mediana móvil: mata saltos de una sola ventana

function mpmDetectInline(buf, sampleRate) {
  const n = buf.length;
  const minTau = Math.max(1, Math.floor(sampleRate / MAX_HZ));
  const maxTau = Math.min(Math.ceil(sampleRate / MIN_HZ), n >> 1);
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

function median3(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

class TunerPitchProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._ring = new Float32Array(WINDOW);
    this._writeIdx = 0;
    this._samplesSinceAnalysis = 0;
    this._samplesSinceReport = 0;
    this._hzHistory = [];
    this._filled = false; // el ring aún no tiene WINDOW muestras reales (arranque)
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0 || !input[0] || input[0].length === 0) {
      return true; // sin entrada conectada todavía — seguir vivo, no reportar
    }
    const chunk = input[0]; // mono: primer canal alcanza para afinar
    for (let i = 0; i < chunk.length; i++) {
      this._ring[this._writeIdx] = chunk[i];
      this._writeIdx = (this._writeIdx + 1) % WINDOW;
    }
    this._samplesSinceAnalysis += chunk.length;
    this._samplesSinceReport += chunk.length;
    if (!this._filled && this._writeIdx === 0) this._filled = true;
    // igual acepta analizar con el ring parcialmente lleno tras el arranque
    // (ceros al inicio) — HOP ya garantiza varias pasadas antes de reportar

    if (this._samplesSinceAnalysis >= HOP) {
      this._samplesSinceAnalysis = 0;
      const ordered = new Float32Array(WINDOW);
      // reordenar el ring circular en orden temporal correcto para el análisis
      for (let i = 0; i < WINDOW; i++) ordered[i] = this._ring[(this._writeIdx + i) % WINDOW];

      let rms = 0;
      for (let i = 0; i < ordered.length; i++) rms += ordered[i] * ordered[i];
      rms = Math.sqrt(rms / ordered.length);

      let pitchResult = null;
      if (rms >= RMS_FLOOR) {
        const r = mpmDetectInline(ordered, sampleRate);
        if (r && r.confidence >= CONFIDENCE_THRESHOLD && r.hz >= MIN_HZ && r.hz <= MAX_HZ) {
          pitchResult = r;
        }
      }

      if (pitchResult) {
        this._hzHistory.push(pitchResult.hz);
        if (this._hzHistory.length > MEDIAN_HISTORY) this._hzHistory.shift();
        this._lastStable = { hz: median3(this._hzHistory), confidence: pitchResult.confidence };
      } else {
        this._hzHistory = [];
        this._lastStable = null;
      }
    }

    if (this._samplesSinceReport >= Math.round((REPORT_INTERVAL_MS / 1000) * sampleRate)) {
      this._samplesSinceReport = 0;
      if (this._lastStable) {
        this.port.postMessage({ type: "pitch", hz: this._lastStable.hz, confidence: this._lastStable.confidence });
      } else {
        this.port.postMessage({ type: "no-signal" });
      }
    }

    return true; // mantener el procesador vivo mientras el nodo exista
  }
}

registerProcessor("tuner-pitch-processor", TunerPitchProcessor);
