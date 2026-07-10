// Worker de motor: decodifica, mide y corrige fuera del hilo principal.
// Tubería de decodificación unificada (§3): el buffer decodificado se cachea aquí
// y se reutiliza tal cual para "correct" — nunca se vuelve a decodificar el archivo.

import { decodeFlac } from "../engine/decode.mjs?v=1.1.1";
import { decodeWav, encodeWav } from "../engine/wav.mjs?v=1.1.1";
import { encodeFlac } from "../engine/flac-encode.mjs?v=1.1.1";
import { encodeMp3 } from "../engine/mp3-encode.mjs?v=1.1.1";
import { analyze } from "../engine/detect.mjs?v=1.1.1";
import { loadRubberBand, pitchShiftOffline, peakOf, applyPeakSafety } from "../engine/correct.mjs?v=1.1.1";

let rbApiPromise = null;
function getRubberBand() {
  if (!rbApiPromise) {
    rbApiPromise = fetch(new URL("../vendor/rubberband-wasm/rubberband.wasm?v=1.1.1", import.meta.url))
      .then(r => r.arrayBuffer())
      .then(bytes => WebAssembly.compile(bytes))
      .then(mod => loadRubberBand(mod));
  }
  return rbApiPromise;
}

/** estado del último archivo decodificado — la MISMA decodificación sirve para medir y corregir */
let current = null; // { channelData, sampleRate, bitDepth, format, fileBaseName }

function baseName(fileName) {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

function post(msg, transfer) {
  postMessage(msg, transfer || []);
}

function maxDriftOf(result) {
  let m = 0;
  for (const s of result.segs) if (s) m = Math.max(m, Math.abs(s.off - result.offset));
  return m;
}

async function diagnose({ fileName, format, bytes, decoded }) {
  post({ type: "progress", stage: "decodificando", pct: 0.05 });

  let d;
  if (decoded) {
    d = decoded; // ya decodificado en el hilo principal (mp3/ogg/m4a vía decodeAudioData)
  } else if (format === "flac") {
    d = await decodeFlac(bytes);
  } else if (format === "wav") {
    d = decodeWav(bytes);
  } else {
    throw new Error(`Formato no soportado en el worker: ${format}`);
  }

  // Yield tras decodificar: en archivos grandes (24/96, 10+ min) el decoder deja
  // basura pesada (buffers internos del WASM) que conviene dejar recolectar antes
  // de las siguientes asignaciones grandes (§4.4, stress test 24/96/12min).
  await new Promise((r) => setTimeout(r, 0));

  current = { ...d, format, fileBaseName: baseName(fileName), peak: peakOf(d.channelData) };
  await new Promise((r) => setTimeout(r, 0));

  post({ type: "progress", stage: "analizando", pct: 0.2 });
  const r = await analyze(
    { channelData: current.channelData, sampleRate: current.sampleRate },
    (p) => post({ type: "progress", stage: "analizando", pct: 0.2 + 0.8 * p })
  );

  post({
    type: "diagnosis",
    refHz: r.refHz,
    offset: r.offset,
    unc: r.unc,
    splitDiff: r.splitDiff,
    R: r.R,
    nFrames: r.nFrames,
    hist: Array.from(r.hist),
    segs: r.segs,
    maxDrift: maxDriftOf(r),
    durationSec: current.channelData[0].length / current.sampleRate,
    sampleRate: current.sampleRate,
    channels: current.channelData.length,
    bitDepth: current.bitDepth,
    format: current.format,
    detectedRefHz: r.refHz, // guardado también para el cálculo de pitchScale en 'correct'
  });
}

const PREVIEW_SEGMENT_SECONDS = 8;

/**
 * Previsualización A/B (§4.3): corrige solo un segmento corto (no todo el
 * archivo) para poder comparar original vs. corregido antes de procesar
 * completo. Usa el mismo motor y la misma seguridad de nivel que la
 * corrección real, para que lo que se escucha sea representativo.
 */
async function preview({ targetHz, detectedRefHz }) {
  if (!current) throw new Error("No hay archivo decodificado (llama a 'diagnose' primero)");

  const sr = current.sampleRate;
  const total = current.channelData[0].length;
  const segLen = Math.min(total, Math.round(PREVIEW_SEGMENT_SECONDS * sr));
  // segmento representativo: ni el inicio (silencio/fade típico) ni el final
  const start = Math.min(Math.floor(total * 0.25), total - segLen);
  const originalSegment = current.channelData.map((ch) => ch.slice(start, start + segLen));

  const pitchScale = targetHz / detectedRefHz;
  const rbApi = await getRubberBand();
  const { channelData: correctedSegment } = await pitchShiftOffline(rbApi, {
    channelData: originalSegment.map((ch) => ch.slice()), // pitchShiftOffline no debe mutar el original
    sampleRate: sr,
    pitchScale,
  });
  applyPeakSafety(correctedSegment, peakOf(originalSegment));

  const originalBuffers = originalSegment.map((ch) => ch.buffer);
  const correctedBuffers = correctedSegment.map((ch) => ch.buffer);
  post(
    { type: "preview", sampleRate: sr, original: originalBuffers, corrected: correctedBuffers },
    [...originalBuffers, ...correctedBuffers]
  );
}

function chooseExportBitDepth() {
  // 16/24 reales del decodificador propio se preservan; 32 (float, vía decodeAudioData
  // de respaldo para mp3/ogg/m4a) se exporta en 24-bit entero, resolución de sobra.
  return current.bitDepth === 16 || current.bitDepth === 24 ? current.bitDepth : 24;
}

async function correct({ targetHz, detectedRefHz, semitones }) {
  if (!current) throw new Error("No hay archivo decodificado (llama a 'diagnose' primero)");

  // Transposición (§4.1 v1.1): pitchScale directo por semitonos, independiente
  // de la referencia detectada — es un cambio de tono relativo, no una corrección
  // hacia un patrón de afinación. Mismo motor y misma tubería que la corrección.
  const isTranspose = semitones !== undefined;
  const pitchScale = isTranspose ? Math.pow(2, semitones / 12) : targetHz / detectedRefHz;
  const rbApi = await getRubberBand();

  post({ type: "progress", stage: "corrigiendo", pct: 0 });
  const { channelData: corrected } = await pitchShiftOffline(
    rbApi,
    { channelData: current.channelData, sampleRate: current.sampleRate, pitchScale },
    (p, stage) => post({ type: "progress", stage: stage === "study" ? "estudiando" : "corrigiendo", pct: p })
  );

  await new Promise((r) => setTimeout(r, 0)); // yield: liberar buffers de estudio de Rubber Band

  post({ type: "progress", stage: "verificando", pct: 0.95 });
  const after = await analyze({ channelData: corrected, sampleRate: current.sampleRate });

  // Seguridad de nivel (§11/§4.3): nunca preguntar — actuar mínimo e informar.
  const levelNote = applyPeakSafety(corrected, current.peak);

  post({ type: "progress", stage: "codificando", pct: 0.98 });
  const bitDepth = chooseExportBitDepth();
  const suffix = isTranspose ? `_${semitones >= 0 ? "+" : ""}${semitones}st` : `_${targetHz}Hz`;
  const files = [];

  // WAV siempre disponible (§4.2), o "mismo formato" si la entrada ya era WAV.
  const wavBytes = encodeWav({ channelData: corrected, sampleRate: current.sampleRate, bitDepth });
  files.push({ name: `${current.fileBaseName}${suffix}.wav`, bytes: wavBytes.buffer, mime: "audio/wav" });
  await new Promise((r) => setTimeout(r, 0)); // yield: WAV y FLAC no necesitan coexistir en memoria a la vez

  // FLAC siempre disponible (§4.2), o "mismo formato" si la entrada ya era FLAC —
  // en ambos casos es el mismo archivo, no se duplica.
  const flacBitDepth = bitDepth === 16 || bitDepth === 24 ? bitDepth : 24;
  const flacBytes = await encodeFlac({ channelData: corrected, sampleRate: current.sampleRate, bitDepth: flacBitDepth });
  files.push({ name: `${current.fileBaseName}${suffix}.flac`, bytes: flacBytes.buffer, mime: "audio/flac" });
  await new Promise((r) => setTimeout(r, 0));

  // MP3 320 kbps (§4.2 v1.1) — siempre con pérdida, nunca reemplaza a WAV/FLAC;
  // el aviso de formato con pérdida se muestra en la UI (lossy: true).
  const mp3Bytes = await encodeMp3(
    { channelData: corrected, sampleRate: current.sampleRate, kbps: 320 },
    (p) => post({ type: "progress", stage: "codificando", pct: 0.98 + 0.02 * p })
  );
  files.push({ name: `${current.fileBaseName}${suffix}.mp3`, bytes: mp3Bytes.buffer, mime: "audio/mpeg", lossy: true });

  post(
    {
      type: "corrected",
      mode: isTranspose ? "transpose" : "reference",
      semitones: isTranspose ? semitones : undefined,
      after: { refHz: after.refHz, offset: after.offset, R: after.R },
      durationSamplesIn: current.channelData[0].length,
      durationSamplesOut: corrected[0].length,
      levelNote,
      files,
    },
    files.map(f => f.bytes)
  );
}

self.onmessage = async (ev) => {
  const msg = ev.data;
  try {
    if (msg.cmd === "diagnose") {
      const decoded = msg.decoded
        ? { channelData: msg.decoded.channelData.map(b => new Float32Array(b)), sampleRate: msg.decoded.sampleRate, bitDepth: msg.decoded.bitDepth }
        : null;
      await diagnose({ fileName: msg.fileName, format: msg.format, bytes: msg.bytes ? new Uint8Array(msg.bytes) : null, decoded });
    } else if (msg.cmd === "correct") {
      await correct({ targetHz: msg.targetHz, detectedRefHz: msg.detectedRefHz, semitones: msg.semitones });
    } else if (msg.cmd === "preview") {
      await preview({ targetHz: msg.targetHz, detectedRefHz: msg.detectedRefHz });
    }
  } catch (err) {
    post({ type: "error", message: (err && err.message) || String(err) });
  }
};
