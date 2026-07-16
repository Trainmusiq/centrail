// Tubería de decodificación unificada (§3, hallazgo julio 2026):
// SIEMPRE la misma decodificación para medir y para corregir. Decodificación propia
// para WAV y FLAC (preserva sample rate y bit depth reales, sin el resampleo que
// puede introducir decodeAudioData). Formatos sin decodificador propio (MP3/OGG/M4A)
// se decodifican una sola vez vía decodeAudioData en el hilo principal y esa MISMA
// decodificación se reusa para medir y corregir — nunca dos caminos distintos.

import "../vendor/wasm-audio-decoders-flac/flac-decoder.min.js?v=1.2.0";
import { decodeWav } from "./wav.mjs?v=1.2.0";

/** @returns {'flac'|'wav'|'mp3'|'ogg'|'m4a'|'aiff'|'unknown'} */
export function detectFormat(filename) {
  const name = (filename || "").toLowerCase();
  if (name.endsWith(".flac")) return "flac";
  if (name.endsWith(".wav") || name.endsWith(".wave")) return "wav";
  if (name.endsWith(".mp3")) return "mp3";
  if (name.endsWith(".ogg") || name.endsWith(".oga")) return "ogg";
  if (name.endsWith(".m4a") || name.endsWith(".aac") || name.endsWith(".mp4")) return "m4a";
  if (name.endsWith(".aiff") || name.endsWith(".aif")) return "aiff";
  return "unknown";
}

/**
 * @param {Uint8Array} bytes
 * @returns {Promise<{channelData: Float32Array[], sampleRate: number, bitDepth: number, format: 'flac'}>}
 */
export async function decodeFlac(bytes) {
  const FLACDecoderCtor = globalThis["flac-decoder"] && globalThis["flac-decoder"].FLACDecoder;
  if (!FLACDecoderCtor) throw new Error("Decodificador FLAC no disponible (vendor/wasm-audio-decoders-flac no cargó)");
  const decoder = new FLACDecoderCtor();
  await decoder.ready;
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const { channelData, sampleRate, bitDepth, errors } = await decoder.decodeFile(u8);
  decoder.free();
  if (errors && errors.length) {
    console.warn(`Decodificación FLAC con ${errors.length} advertencia(s)`, errors);
  }
  return { channelData, sampleRate, bitDepth, format: "flac" };
}

/**
 * Decodifica un archivo según su formato, en una única pasada reutilizable
 * tanto para medir como para corregir.
 * @param {File|{name: string, arrayBuffer: () => Promise<ArrayBuffer>}} file
 * @param {(bytes: ArrayBuffer) => Promise<AudioBuffer>} [decodeViaBrowser] decodeAudioData del AudioContext, para formatos sin decodificador propio
 */
export async function decodeFile(file, decodeViaBrowser) {
  const format = detectFormat(file.name);
  const bytes = new Uint8Array(await file.arrayBuffer());

  if (format === "flac") {
    return decodeFlac(bytes);
  }
  if (format === "wav") {
    return decodeWav(bytes);
  }
  if (format === "aiff") {
    throw new Error("AIFF no tiene soporte nativo y aún no tiene decodificador propio (ver §4.2 de la especificación).");
  }
  // mp3 / ogg / m4a: sin decodificador propio en v1 — se usa decodeAudioData UNA vez
  // y el mismo resultado alimenta detección y corrección (tubería unificada).
  if (!decodeViaBrowser) {
    throw new Error(`Formato ${format} requiere decodeAudioData, no disponible en este contexto`);
  }
  const audioBuffer = await decodeViaBrowser(bytes.buffer);
  const channelData = [];
  for (let c = 0; c < audioBuffer.numberOfChannels; c++) channelData.push(audioBuffer.getChannelData(c).slice());
  return { channelData, sampleRate: audioBuffer.sampleRate, bitDepth: 32, format };
}
