// Corrección de pitch sin alterar tempo — envoltorio sobre Rubber Band (vendor/rubberband-wasm).
// Modo de máxima calidad (motor "Finer"/R3), tal como pide docs/especificacion.md §4.1.

import { RubberBandInterface, RubberBandOption } from "../vendor/rubberband-wasm/index.esm.js";

export { RubberBandOption };

const DEFAULT_OPTIONS = RubberBandOption.RubberBandOptionEngineFiner
  | RubberBandOption.RubberBandOptionProcessOffline
  | RubberBandOption.RubberBandOptionPitchHighQuality;

/**
 * @param {WebAssembly.Module} wasmModule  módulo ya compilado de rubberband.wasm
 * @returns {Promise<RubberBandInterface>}
 */
export async function loadRubberBand(wasmModule) {
  return RubberBandInterface.initialize(wasmModule);
}

/**
 * Cambia el pitch de un buffer multicanal sin alterar su duración (timeRatio = 1 por defecto).
 * @param {RubberBandInterface} rbApi
 * @param {{channelData: Float32Array[], sampleRate: number, pitchScale: number, timeRatio?: number, options?: number}} input
 * @returns {{channelData: Float32Array[]}}
 */
export function pitchShiftOffline(rbApi, { channelData, sampleRate, pitchScale, timeRatio = 1, options = DEFAULT_OPTIONS }) {
  const channels = channelData.length;
  const inputLength = channelData[0].length;
  const outputSamples = Math.round(inputLength * timeRatio);
  const outputBuffers = channelData.map(() => new Float32Array(outputSamples));

  const rbState = rbApi.rubberband_new(sampleRate, channels, options, timeRatio, pitchScale);
  rbApi.rubberband_set_pitch_scale(rbState, pitchScale);
  rbApi.rubberband_set_time_ratio(rbState, timeRatio);
  const samplesRequired = rbApi.rubberband_get_samples_required(rbState);

  const channelArrayPtr = rbApi.malloc(channels * 4);
  const channelDataPtr = [];
  for (let c = 0; c < channels; c++) {
    const bufferPtr = rbApi.malloc(samplesRequired * 4);
    channelDataPtr.push(bufferPtr);
    rbApi.memWritePtr(channelArrayPtr + c * 4, bufferPtr);
  }

  rbApi.rubberband_set_expected_input_duration(rbState, inputLength);

  const tryRetrieve = (write, final) => {
    while (true) {
      const available = rbApi.rubberband_available(rbState);
      if (available < 1) break;
      if (!final && available < samplesRequired) break;
      const toRead = Math.min(samplesRequired, available, outputSamples - write);
      if (toRead <= 0) break;
      const recv = rbApi.rubberband_retrieve(rbState, channelArrayPtr, toRead);
      channelDataPtr.forEach((ptr, c) => outputBuffers[c].set(rbApi.memReadF32(ptr, recv), write));
      write += recv;
    }
    return write;
  };

  // 1) study: pasada de análisis previa (mejora calidad del stretch/pitch offline)
  let read = 0;
  while (read < inputLength) {
    channelData.forEach((buf, c) => rbApi.memWrite(channelDataPtr[c], buf.subarray(read, read + samplesRequired)));
    const remaining = Math.min(samplesRequired, inputLength - read);
    read += remaining;
    const isFinal = read < inputLength ? 0 : 1;
    rbApi.rubberband_study(rbState, channelArrayPtr, remaining, isFinal);
  }

  // 2) process + retrieve
  read = 0;
  let write = 0;
  while (read < inputLength) {
    channelData.forEach((buf, c) => rbApi.memWrite(channelDataPtr[c], buf.subarray(read, read + samplesRequired)));
    const remaining = Math.min(samplesRequired, inputLength - read);
    read += remaining;
    const isFinal = read < inputLength ? 0 : 1;
    rbApi.rubberband_process(rbState, channelArrayPtr, remaining, isFinal);
    write = tryRetrieve(write, false);
  }
  tryRetrieve(write, true);

  channelDataPtr.forEach(ptr => rbApi.free(ptr));
  rbApi.free(channelArrayPtr);
  rbApi.rubberband_delete(rbState);

  return { channelData: outputBuffers };
}
