// Detector de afinación de referencia — algoritmo validado en el prototipo (docs/especificacion.md §3).
// No reinventar: mismos parámetros y método que patron440.html.

const FFT_N = 32768;
const MAX_FRAMES = 240;          // ventanas repartidas por todo el tema
const FMIN = 55, FMAX = 5000;    // rango útil para material armónico
const NBINS = 100;               // 1 bin = 1 cent
const SEGMENTS = 10;             // para la curva de drift

function makeFFT(n) {
  const levels = Math.log2(n) | 0;
  if (1 << levels !== n) throw new Error("FFT size must be power of 2");
  const cosT = new Float64Array(n / 2), sinT = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) {
    cosT[i] = Math.cos(2 * Math.PI * i / n);
    sinT[i] = Math.sin(2 * Math.PI * i / n);
  }
  const rev = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let j = 0; j < levels; j++) r = (r << 1) | ((i >>> j) & 1);
    rev[i] = r;
  }
  return function fft(re, im) {
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1, step = n / size;
      for (let i = 0; i < n; i += size) {
        for (let j = i, k = 0; j < i + half; j++, k += step) {
          const l = j + half;
          const tre = re[l] * cosT[k] + im[l] * sinT[k];
          const tim = -re[l] * sinT[k] + im[l] * cosT[k];
          re[l] = re[j] - tre; im[l] = im[j] - tim;
          re[j] += tre; im[j] += tim;
        }
      }
    }
  };
}

const fft = makeFFT(FFT_N);
const hann = new Float64Array(FFT_N);
for (let i = 0; i < FFT_N; i++) hann[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (FFT_N - 1));

function analyzeFrame(channelData, start, sr, sink) {
  // downmix a mono solo de esta ventana (no del archivo completo): evita duplicar
  // en memoria la señal entera para archivos largos (§4.4, stress test 24/96 12min).
  const re = new Float64Array(FFT_N), im = new Float64Array(FFT_N);
  const ch = channelData.length;
  if (ch === 1) {
    const d = channelData[0];
    for (let i = 0; i < FFT_N; i++) re[i] = d[start + i] * hann[i];
  } else {
    const inv = 1 / ch;
    for (let i = 0; i < FFT_N; i++) {
      let s = 0;
      for (let c = 0; c < ch; c++) s += channelData[c][start + i];
      re[i] = s * inv * hann[i];
    }
  }
  fft(re, im);
  const half = FFT_N >> 1;
  const mag = new Float64Array(half);
  let maxMag = 0;
  for (let i = 1; i < half; i++) {
    const m = Math.hypot(re[i], im[i]);
    mag[i] = m;
    if (m > maxMag) maxMag = m;
  }
  if (maxMag <= 0) return;
  const thr = maxMag * 0.002;
  const binHz = sr / FFT_N;
  const iMin = Math.max(2, Math.ceil(FMIN / binHz));
  const iMax = Math.min(half - 2, Math.floor(FMAX / binHz));
  for (let i = iMin; i <= iMax; i++) {
    const m = mag[i];
    if (m < thr || m <= mag[i - 1] || m < mag[i + 1]) continue;
    // interpolación parabólica sobre magnitud logarítmica
    const a = Math.log(mag[i - 1] + 1e-12), b = Math.log(m + 1e-12), c = Math.log(mag[i + 1] + 1e-12);
    const denom = a - 2 * b + c;
    let p = denom !== 0 ? 0.5 * (a - c) / denom : 0;
    if (p > 0.5) p = 0.5; else if (p < -0.5) p = -0.5;
    const f = (i + p) * binHz;
    // desviación en cents respecto a la rejilla temperada A440, en (-50, 50]
    const cents = 1200 * Math.log2(f / 440);
    let dev = ((cents % 100) + 150) % 100 - 50;
    const w = Math.sqrt(m / maxMag);   // compresión: que un pico no domine todo
    sink(dev, w, f);
  }
}

// Persistencia de picos (§3, mejora identificada 8 jul, implementada v1.2): dos
// ventanas "comparten" un pico si alguno de sus picos MÁS FUERTES coincide en
// frecuencia (±15¢, mismo radio que el refinamiento de circularEstimate) —
// diseño verificado con evidencia (no por intuición): el umbral relativo de
// detección de picos (0.002 × máximo) es deliberadamente laxo y genera
// ~1000 "picos" incluso en ruido blanco puro (verificado empíricamente), así
// que comparar TODOS los picos vuelve casi inevitable una coincidencia por
// azar entre dos ventanas de ruido puro (falsos positivos ~100% con 30¢ de
// tolerancia y sin límite de K, medido). Restringir a los K picos de mayor
// peso por ventana reduce eso a un campo de comparación realista.
const PERSISTENCE_TOL_CENTS = 15;
const PERSISTENCE_TOP_K = 5;
// exigir coincidencia con AMBAS vecinas (lógica AND) rechaza mejor el ruido
// sintético puro, pero verificado contra los 5 archivos reales de test/private
// resultó INSEGURO: en música polifónica real los picos dominantes cambian
// legítimamente de una ventana muestreada a la siguiente (acordes, vibrato,
// mezcla), así que exigir las dos vecinas excluía 58-60% de las ventanas y
// desplazaba el offset de "Puente" 1.72¢ — 195% de su propia incertidumbre
// (0.88¢), violando el criterio de "no moverse más que la incertidumbre".
// Exigir solo UNA vecina (lógica OR) resultó seguro en las 5 canciones reales
// (desvío máximo 8% de la incertidumbre propia, en vez de hasta 200%) y sigue
// rechazando una fracción sustancial de ruido blanco sintético puro (~37% de
// falsos positivos en 8 sorteos independientes, vs. ~100% sin el filtro).

function peaksMatch(a, b) {
  const topA = a.slice(0, PERSISTENCE_TOP_K), topB = b.slice(0, PERSISTENCE_TOP_K);
  for (const pa of topA) {
    for (const pb of topB) {
      if (Math.abs(1200 * Math.log2(pa.freq / pb.freq)) <= PERSISTENCE_TOL_CENTS) return true;
    }
  }
  return false;
}

function circularEstimate(hist, sumSin, sumCos, totalW) {
  // 1) peak del histograma  2) refinamiento con media circular local ±15¢
  let peak = 0, peakVal = -1;
  for (let i = 0; i < NBINS; i++) if (hist[i] > peakVal) { peakVal = hist[i]; peak = i; }
  const peakDev = peak - 49.5;
  let s = 0, c = 0, w = 0;
  for (let i = 0; i < NBINS; i++) {
    const dev = i - 49.5;
    let d = dev - peakDev;
    d = ((d % 100) + 150) % 100 - 50;
    if (Math.abs(d) <= 15) {
      const th = 2 * Math.PI * dev / 100;
      s += hist[i] * Math.sin(th);
      c += hist[i] * Math.cos(th);
      w += hist[i];
    }
  }
  const offset = Math.atan2(s, c) / (2 * Math.PI) * 100;
  // consistencia global: largo del vector resultante de TODO el histograma
  const R = totalW > 0 ? Math.hypot(sumSin, sumCos) / totalW : 0;
  return { offset, R };
}

/**
 * @param {{channelData: Float32Array[], sampleRate: number}} input
 * @param {(p:number, label?:string)=>void} [onProgress]
 */
export async function analyze({ channelData, sampleRate }, onProgress) {
  const sr = sampleRate;
  const ch = channelData.length;
  const len = channelData[0].length;

  const usable = len - FFT_N;
  if (usable < 0) throw new Error("El archivo es demasiado corto para analizar.");
  const nFrames = Math.min(MAX_FRAMES, Math.max(8, Math.floor(usable / (FFT_N / 2))));
  const hop = usable / Math.max(1, nFrames - 1);

  // Paso 1: FFT + detección de picos por ventana (caro, una sola vez). Los picos
  // se guardan por ventana en vez de acumularse directo, porque la persistencia
  // (paso 2) necesita comparar los picos de ventanas vecinas ANTES de decidir
  // si una ventana aporta a la estadística.
  const framePeaks = new Array(nFrames);
  const frameStarts = new Array(nFrames);
  for (let f = 0; f < nFrames; f++) {
    const start = Math.min(usable, Math.round(f * hop));
    frameStarts[f] = start;
    const peaks = [];
    analyzeFrame(channelData, start, sr, (dev, w, freq) => { peaks.push({ dev, w, freq }); });
    peaks.sort((a, b) => b.w - a.w); // más fuerte primero — peaksMatch solo mira los PERSISTENCE_TOP_K primeros
    framePeaks[f] = peaks;
    if (onProgress && ((f & 7) === 7 || f === nFrames - 1)) {
      onProgress(0.15 + 0.85 * (f + 1) / nFrames, `Analizando espectro… ventana ${f + 1} de ${nFrames}`);
      await new Promise(r => setTimeout(r, 0));
    }
  }

  // Paso 2: persistencia de picos (§3, mejora identificada 8 jul, implementada v1.2)
  // — una ventana se declara "sin contenido tonal" si sus picos más fuertes NO
  // coinciden con los de NINGUNA ventana vecina inmediata en la secuencia
  // muestreada (anterior NI siguiente). En los dos extremos del tema solo existe
  // una ventana vecina — se usa esa sola. Típico de intros/outros de percusión
  // pura o silencio: la energía inarmónica de banda ancha no reaparece a la
  // misma frecuencia de una ventana a la siguiente, a diferencia de una nota
  // sostenida real. Ventanas sin contenido tonal se excluyen del histograma/
  // drift/repetibilidad — no aportan falso centro.
  // Exigir coincidencia con AMBAS vecinas (AND) se probó primero y se descartó:
  // verificado contra los 5 archivos reales de test/private resultó inseguro
  // (ver comentario junto a PERSISTENCE_TOP_K más arriba) — la música real
  // cambia de contenido armónico dominante de una ventana muestreada a la
  // siguiente con más frecuencia de lo que un tono sostenido sintético sugiere.
  const isTonal = new Array(nFrames);
  for (let f = 0; f < nFrames; f++) {
    if (framePeaks[f].length === 0) { isTonal[f] = false; continue; }
    const prevMatch = f > 0 && peaksMatch(framePeaks[f], framePeaks[f - 1]);
    const nextMatch = f < nFrames - 1 && peaksMatch(framePeaks[f], framePeaks[f + 1]);
    isTonal[f] = prevMatch || nextMatch;
  }
  let excludedFrames = isTonal.filter(t => !t).length;
  // red de seguridad: si el filtro excluiría TODO el tema (ej. percusión/ruido de
  // principio a fin), no tiene sentido — mejor no filtrar que reportar un 440.00 Hz
  // vacío de sentido. Se declara igual (excludedFrames=0) para no fingir un filtro
  // que en la práctica no se aplicó.
  const applyFilter = excludedFrames < nFrames;
  if (!applyFilter) excludedFrames = 0;

  const hist = new Float64Array(NBINS);
  let sumSin = 0, sumCos = 0, totalW = 0;
  const segHist = Array.from({ length: SEGMENTS }, () => ({ s: 0, c: 0, w: 0 }));
  // repetibilidad empírica (§3): dos subconjuntos intercalados (ventana par/impar) medidos
  // por separado. Intercalado en vez de primera/segunda mitad temporal para no confundir
  // esta métrica con la deriva (que ya se mide aparte en segHist).
  const halfHist = [new Float64Array(NBINS), new Float64Array(NBINS)];
  const half = [{ s: 0, c: 0, w: 0 }, { s: 0, c: 0, w: 0 }];

  for (let f = 0; f < nFrames; f++) {
    if (applyFilter && !isTonal[f]) continue;
    const start = frameStarts[f];
    const seg = Math.min(SEGMENTS - 1, Math.floor(start / len * SEGMENTS));
    const half_i = f % 2;
    for (const { dev, w } of framePeaks[f]) {
      let bin = Math.round(dev + 49.5);
      if (bin < 0) bin = 0; if (bin >= NBINS) bin = NBINS - 1;
      hist[bin] += w;
      const th = 2 * Math.PI * dev / 100;
      sumSin += w * Math.sin(th); sumCos += w * Math.cos(th); totalW += w;
      const S = segHist[seg];
      S.s += w * Math.sin(th); S.c += w * Math.cos(th); S.w += w;
      halfHist[half_i][bin] += w;
      const H = half[half_i];
      H.s += w * Math.sin(th); H.c += w * Math.cos(th); H.w += w;
    }
  }

  const { offset, R } = circularEstimate(hist, sumSin, sumCos, totalW);
  const refHz = 440 * Math.pow(2, offset / 1200);

  // incertidumbre real: diferencia entre el offset estimado en cada mitad intercalada.
  // Reemplaza a la antigua heurística basada solo en R (§3, hallazgo del 8 jul): R bajo
  // no implica medición ambigua (vibrato, inarmonicidad de piano, percusión de banda ancha
  // pueden ensanchar el histograma sin desplazar el centro) — la repetibilidad sí lo prueba.
  let splitDiff = null;
  if (half[0].w > 0 && half[1].w > 0) {
    const a = circularEstimate(halfHist[0], half[0].s, half[0].c, half[0].w);
    const b = circularEstimate(halfHist[1], half[1].s, half[1].c, half[1].w);
    let d = a.offset - b.offset;
    splitDiff = Math.abs(((d % 100) + 150) % 100 - 50);
  }
  // si alguna mitad no tuvo picos detectables, no se puede verificar repetibilidad:
  // reportar incertidumbre alta en vez de fingir certeza con la heurística analítica sola.
  const disp = Math.sqrt(Math.max(0, -2 * Math.log(Math.max(1e-6, R)))) * 100 / (2 * Math.PI);
  const analyticUnc = Math.max(0.1, Math.min(25, disp / Math.sqrt(Math.max(1, nFrames))));
  const unc = splitDiff !== null ? Math.max(0.1, splitDiff) : Math.max(analyticUnc, 8);

  const segs = segHist.map(S => {
    if (S.w <= 0) return null;
    const dev = Math.atan2(S.s, S.c) / (2 * Math.PI) * 100;
    let d = dev - offset;
    d = ((d % 100) + 150) % 100 - 50;   // relativo al global, circular
    return { off: offset + d, R: Math.hypot(S.s, S.c) / S.w };
  });

  return { refHz, offset, R, unc, splitDiff, hist, nFrames, excludedFrames, segs, sr, ch, dur: len / sr };
}
