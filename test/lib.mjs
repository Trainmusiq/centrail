// Utilidades compartidas por los scripts de prueba con archivos reales.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FLACDecoder } from "@wasm-audio-decoders/flac";
import { loadRubberBand } from "../engine/correct.mjs";

export const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @returns {Promise<{channelData: Float32Array[], sampleRate: number, bitDepth: number}>} */
export async function decodeFlacFile(filePath) {
  const bytes = fs.readFileSync(filePath);
  const decoder = new FLACDecoder();
  await decoder.ready;
  const { channelData, sampleRate, bitDepth, samplesDecoded, errors } = await decoder.decodeFile(
    new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  );
  decoder.free();
  if (errors && errors.length) {
    console.warn(`   (${errors.length} advertencia(s) de decodificación FLAC, ver detalle si el resultado se ve raro)`);
  }
  return { channelData, sampleRate, bitDepth, samplesDecoded };
}

export async function loadRubberBandModule() {
  const wasmPath = path.join(__dirname, "..", "vendor", "rubberband-wasm", "rubberband.wasm");
  const wasmBytes = fs.readFileSync(wasmPath);
  const wasmModule = await WebAssembly.compile(wasmBytes);
  return loadRubberBand(wasmModule);
}

export function centsOf(hz, ref = 440) {
  return 1200 * Math.log2(hz / ref);
}

/** diferencia circular a-b mapeada a (-50, 50] — mismo criterio que engine/detect.mjs */
export function circularDiff(a, b) {
  let d = a - b;
  return ((d % 100) + 150) % 100 - 50;
}

export function fmtDur(seconds) {
  const m = Math.floor(seconds / 60), s = (seconds % 60).toFixed(1);
  return `${m}:${s.padStart(4, "0")}`;
}
