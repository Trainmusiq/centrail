// Utilidades compartidas por los scripts de prueba con archivos reales.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { FLACDecoder } from "@wasm-audio-decoders/flac";
import { loadRubberBand } from "../engine/correct.mjs";

export const __dirname = path.dirname(fileURLToPath(import.meta.url));

let flacEncoderPromise = null;
/**
 * Carga vendor/libflacjs en Node — el wrapper vendorizado detecta Node por
 * `process.versions.node` y toma su rama CommonJS (require/__dirname), que no
 * existe en nuestro ESM ("type":"module"). Se le da un shim mínimo (module.require
 * vía createRequire, __dirname apuntando a vendor/libflacjs, y se oculta el
 * fetch global de Node para que use readFileSync en vez de intentar fetchear
 * una ruta de archivo como si fuera URL). No modifica el archivo vendorizado.
 * @returns {Promise<*>} el objeto Flac listo para usar con encodeFlacWith()
 */
export function loadFlacEncoderNode() {
  if (!flacEncoderPromise) {
    flacEncoderPromise = (async () => {
      const vendorDir = path.join(__dirname, "..", "vendor", "libflacjs");
      const req = createRequire(import.meta.url);
      globalThis.__dirname = vendorDir;
      globalThis.module = { exports: {}, require: req };
      const realFetch = globalThis.fetch;
      delete globalThis.fetch;
      try {
        await import(path.join(vendorDir, "libflac.min.wasm.js"));
      } finally {
        globalThis.fetch = realFetch;
      }
      const Flac = globalThis.module.exports;
      await new Promise((resolve) => {
        if (Flac.isReady && Flac.isReady()) resolve();
        else Flac.onready = resolve;
      });
      return Flac;
    })();
  }
  return flacEncoderPromise;
}

/** @returns {Promise<{channelData: Float32Array[], sampleRate: number, bitDepth: number}>} */
export async function decodeFlacBytes(bytes) {
  const decoder = new FLACDecoder();
  await decoder.ready;
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const { channelData, sampleRate, bitDepth, samplesDecoded, errors } = await decoder.decodeFile(u8);
  decoder.free();
  if (errors && errors.length) {
    console.warn(`   (${errors.length} advertencia(s) de decodificación FLAC, ver detalle si el resultado se ve raro)`);
  }
  return { channelData, sampleRate, bitDepth, samplesDecoded };
}

/** @returns {Promise<{channelData: Float32Array[], sampleRate: number, bitDepth: number}>} */
export async function decodeFlacFile(filePath) {
  return decodeFlacBytes(fs.readFileSync(filePath));
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
