// Benchmark YIN vs MPM (McLeod Pitch Method) para el motor de detección en
// tiempo real del afinador (v1.3, §2 de la especificación). Regla del proyecto:
// evidencia propia en este equipo, no reputación de qué algoritmo es "mejor"
// en papers. No es un test pass/fail — es un reporte comparativo; no llama a
// process.exit(1).
//
// Buffer de prueba: 2048 muestras @ 44100 Hz (~46ms), el tamaño real que usará
// el AudioWorkletProcessor.
import { mpmDetect as mpmDetectCanonical } from "../engine/pitch-detect.mjs";

const SR = 44100;
const BUF_SIZE = 2048;
const MIN_HZ = 60, MAX_HZ = 1500;
const MIN_TAU = Math.floor(SR / MAX_HZ);
const MAX_TAU = Math.ceil(SR / MIN_HZ);

// ── YIN (de Cheveigné & Kawahara, 2002) ──
const YIN_THRESHOLD = 0.1;

function yinDetect(buf) {
  const n = buf.length;
  const maxTau = Math.min(MAX_TAU, n >> 1);
  const d = new Float64Array(maxTau + 1);
  // función de diferencia
  for (let tau = 1; tau <= maxTau; tau++) {
    let sum = 0;
    for (let j = 0; j < n - maxTau; j++) {
      const diff = buf[j] - buf[j + tau];
      sum += diff * diff;
    }
    d[tau] = sum;
  }
  // diferencia media acumulada normalizada
  const cmnd = new Float64Array(maxTau + 1);
  cmnd[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau <= maxTau; tau++) {
    runningSum += d[tau];
    cmnd[tau] = d[tau] * tau / (runningSum || 1e-12);
  }
  // umbral absoluto: primer mínimo local bajo el umbral
  let tauEstimate = -1;
  for (let tau = MIN_TAU; tau <= maxTau; tau++) {
    if (cmnd[tau] < YIN_THRESHOLD) {
      while (tau + 1 <= maxTau && cmnd[tau + 1] < cmnd[tau]) tau++;
      tauEstimate = tau;
      break;
    }
  }
  if (tauEstimate === -1) return null;
  // interpolación parabólica
  let better = tauEstimate;
  if (tauEstimate > 1 && tauEstimate < maxTau) {
    const s0 = cmnd[tauEstimate - 1], s1 = cmnd[tauEstimate], s2 = cmnd[tauEstimate + 1];
    const denom = s0 - 2 * s1 + s2;
    if (denom !== 0) better = tauEstimate + (s0 - s2) / (2 * denom);
  }
  const confidence = 1 - cmnd[tauEstimate];
  return { hz: SR / better, confidence };
}

// ── MPM (McLeod & Wyvill, 2005) ──
// Implementación canónica en engine/pitch-detect.mjs (única fuente de verdad,
// también usada por engine/tuner-app.mjs) — se importa aquí en vez de
// duplicarla, para que el benchmark siempre mida el código real.
function mpmDetect(buf) {
  return mpmDetectCanonical(buf, SR, MIN_HZ, MAX_HZ);
}

// ── señales de prueba ──
function synthTone(freqHz, n, noiseLevel = 0) {
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let v = 0.6 * Math.sin(2 * Math.PI * freqHz * t)
          + 0.25 * Math.sin(2 * Math.PI * 2 * freqHz * t)
          + 0.1 * Math.sin(2 * Math.PI * 3 * freqHz * t);
    if (noiseLevel > 0) v += (Math.random() * 2 - 1) * noiseLevel;
    buf[i] = v;
  }
  return buf;
}

function centsError(measuredHz, trueHz) {
  return 1200 * Math.log2(measuredHz / trueHz);
}

// Casos con ruido: el sorteo de Math.random() es una muestra única y ruidosa
// en sí misma (hallazgo ya conocido de otra sesión) — cada caso con noise>0 se
// repite N_NOISE_TRIALS veces con un sorteo distinto y se promedia, en vez de
// confiar en una sola corrida.
const N_NOISE_TRIALS = 25;

const cases = [
  { label: "82.4 Hz limpio (Mi2)", freq: 82.4, noise: 0, trials: 1 },
  { label: "220 Hz limpio (La3)", freq: 220, noise: 0, trials: 1 },
  { label: "440 Hz limpio (La4)", freq: 440, noise: 0, trials: 1 },
  { label: "880 Hz limpio (La5)", freq: 880, noise: 0, trials: 1 },
  { label: "440 Hz +25¢ desafinado", freq: 440 * Math.pow(2, 25 / 1200), noise: 0, trials: 1 },
  { label: "220 Hz con ruido -30dB", freq: 220, noise: Math.pow(10, -30 / 20), trials: N_NOISE_TRIALS },
  { label: "220 Hz con ruido -20dB", freq: 220, noise: Math.pow(10, -20 / 20), trials: N_NOISE_TRIALS },
  { label: "440 Hz con ruido -20dB", freq: 440, noise: Math.pow(10, -20 / 20), trials: N_NOISE_TRIALS },
];

const N_TIMING_RUNS = 200;

function benchAlgo(name, fn) {
  console.log(`\n=== ${name} ===`);
  let sumAbsErr = 0, maxAbsErr = 0, within5c = 0, total = 0;
  for (const c of cases) {
    let caseSumAbsErr = 0, caseMaxAbsErr = 0, caseWithin5c = 0, caseMisses = 0;
    for (let t = 0; t < c.trials; t++) {
      const buf = synthTone(c.freq, BUF_SIZE, c.noise);
      const r = fn(buf);
      if (!r) { caseMisses++; continue; }
      const err = Math.abs(centsError(r.hz, c.freq));
      caseSumAbsErr += err;
      caseMaxAbsErr = Math.max(caseMaxAbsErr, err);
      if (err <= 5) caseWithin5c++;
    }
    const validTrials = c.trials - caseMisses;
    if (validTrials === 0) {
      console.log(`  ${c.label}: SIN LECTURA en ${c.trials} intentos`);
      continue;
    }
    const caseAvgErr = caseSumAbsErr / validTrials;
    sumAbsErr += caseAvgErr;
    maxAbsErr = Math.max(maxAbsErr, caseMaxAbsErr);
    within5c += caseWithin5c;
    total += validTrials;
    const trialNote = c.trials > 1 ? ` (media de ${validTrials} sorteos)` : "";
    console.log(`  ${c.label}${trialNote}: error medio=${caseAvgErr.toFixed(2)}¢, error máx=${caseMaxAbsErr.toFixed(2)}¢`);
  }
  // promedio de error POR CASO (no por trial individual): así los casos con
  // ruido (25 sorteos) no dominan el promedio frente a los limpios (1 sorteo)
  // solo por tener más muestras — cada escenario pesa igual.
  const avgOfCaseAverages = sumAbsErr / cases.length;
  // warm-up
  const warmBuf = synthTone(220, BUF_SIZE, 0.05);
  for (let i = 0; i < 10; i++) fn(warmBuf);
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < N_TIMING_RUNS; i++) fn(warmBuf);
  const t1 = process.hrtime.bigint();
  const avgMs = Number(t1 - t0) / 1e6 / N_TIMING_RUNS;
  console.log(`  --- resumen: error medio=${avgOfCaseAverages.toFixed(2)}¢, error máx=${maxAbsErr.toFixed(2)}¢, dentro de ±5¢=${within5c}/${total}, tiempo/buffer=${avgMs.toFixed(3)}ms ---`);
  return { avgAbsErr: avgOfCaseAverages, maxAbsErr, within5c, total, avgMs };
}

const yinResult = benchAlgo("YIN", yinDetect);
const mpmResult = benchAlgo("MPM", mpmDetect);

console.log("\n=== Comparación final ===");
console.log(`YIN: error medio=${yinResult.avgAbsErr.toFixed(2)}¢, error máx=${yinResult.maxAbsErr.toFixed(2)}¢, ±5¢=${yinResult.within5c}/${yinResult.total}, ${yinResult.avgMs.toFixed(3)}ms/buffer`);
console.log(`MPM: error medio=${mpmResult.avgAbsErr.toFixed(2)}¢, error máx=${mpmResult.maxAbsErr.toFixed(2)}¢, ±5¢=${mpmResult.within5c}/${mpmResult.total}, ${mpmResult.avgMs.toFixed(3)}ms/buffer`);

const hopMs = 512 / SR * 1000;
console.log(`\nPresupuesto de tiempo real: hop=512 muestras = ${hopMs.toFixed(2)}ms disponibles entre cálculos.`);
console.log(`YIN usa ${(yinResult.avgMs / hopMs * 100).toFixed(1)}% del presupuesto; MPM usa ${(mpmResult.avgMs / hopMs * 100).toFixed(1)}%.`);

// Decisión por evidencia, no por una regla de desempate arbitraria fijada de
// antemano: si un algoritmo domina en error medio, error máximo Y velocidad a
// la vez, gana sin necesidad de desempate. Solo si el resultado es realmente
// mixto (uno gana en precisión, el otro en velocidad) se recurre al criterio
// documentado (MPM = menor propensión a errores de octava) como desempate.
const yinWinsErr = yinResult.avgAbsErr < mpmResult.avgAbsErr && yinResult.maxAbsErr < mpmResult.maxAbsErr;
const mpmWinsErr = mpmResult.avgAbsErr < yinResult.avgAbsErr && mpmResult.maxAbsErr < yinResult.maxAbsErr;
const yinWinsSpeed = yinResult.avgMs < mpmResult.avgMs;
let winner;
if (yinWinsErr && yinWinsSpeed) {
  winner = "YIN (domina en error medio, error máximo Y velocidad — sin necesidad de desempate)";
} else if (mpmWinsErr && !yinWinsSpeed) {
  winner = "MPM (domina en error medio, error máximo Y velocidad)";
} else {
  const errDiff = mpmResult.avgAbsErr - yinResult.avgAbsErr;
  winner = Math.abs(errDiff) < 1
    ? "MPM (empate <1¢ en error medio, resultado mixto en las demás métricas — desempate por menor propensión documentada a errores de octava)"
    : (errDiff < 0 ? "MPM (menor error medio, resultado mixto)" : "YIN (menor error medio, resultado mixto)");
}
console.log(`\nGanador: ${winner}`);
