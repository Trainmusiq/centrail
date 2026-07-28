// Lectura AIFF / AIFF-C (PCM), sin dependencias — funciona en Node y en el navegador.
// AIFF no tiene decodificación nativa en Chrome/Firefox (§4.2), así que necesita
// decodificador propio. Es PCM simple en contenedor IFF (pariente de WAV), con dos
// diferencias que hay que respetar: todo es BIG-ENDIAN, y el sample rate se guarda
// como float extendido de 80 bits (formato IEEE 754 de Motorola 68881), no como
// entero. AIFF-C agrega un campo de compresión: se aceptan solo las variantes sin
// comprimir ("NONE" big-endian y "sowt" little-endian, que es lo que exporta macOS).

/** El sample rate en AIFF es un float extendido de 80 bits: 1 bit de signo, 15 de exponente, 64 de mantisa. */
function readExtendedFloat80(dv, offset) {
  const expon = dv.getUint16(offset, false);
  const hiMant = dv.getUint32(offset + 2, false);
  const loMant = dv.getUint32(offset + 6, false);
  if (expon === 0 && hiMant === 0 && loMant === 0) return 0;
  const sign = expon & 0x8000 ? -1 : 1;
  const e = (expon & 0x7fff) - 16383;
  return sign * (hiMant * Math.pow(2, e - 31) + loMant * Math.pow(2, e - 63));
}

/**
 * @param {ArrayBuffer|Uint8Array} bytes
 * @returns {{channelData: Float32Array[], sampleRate: number, bitDepth: number, format: 'aiff'}}
 */
export function decodeAiff(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);

  const readTag = (off) => String.fromCharCode(u8[off], u8[off + 1], u8[off + 2], u8[off + 3]);
  const formType = readTag(8);
  if (readTag(0) !== "FORM" || (formType !== "AIFF" && formType !== "AIFC")) {
    throw new Error("No es un archivo AIFF válido (falta cabecera FORM/AIFF)");
  }

  let channels = 0, frames = 0, bitDepth = 0, sampleRate = 0;
  let compression = "NONE";
  let ssndOffset = -1;
  let foundComm = false;

  let pos = 12;
  while (pos + 8 <= u8.length) {
    const chunkId = readTag(pos);
    const chunkSize = dv.getUint32(pos + 4, false); // big-endian
    const bodyOffset = pos + 8;
    if (chunkId === "COMM") {
      channels = dv.getUint16(bodyOffset, false);
      frames = dv.getUint32(bodyOffset + 2, false);
      bitDepth = dv.getUint16(bodyOffset + 6, false);
      sampleRate = readExtendedFloat80(dv, bodyOffset + 8);
      // AIFF-C: tras los 18 bytes estándar viene el tipo de compresión
      if (formType === "AIFC" && chunkSize >= 22) compression = readTag(bodyOffset + 18);
      foundComm = true;
    } else if (chunkId === "SSND") {
      // SSND lleva 8 bytes de cabecera propia (offset + blockSize) antes de las muestras
      const dataOffset = dv.getUint32(bodyOffset, false);
      ssndOffset = bodyOffset + 8 + dataOffset;
    }
    pos = bodyOffset + chunkSize + (chunkSize & 1); // los chunks se alinean a 2 bytes
  }

  if (!foundComm) throw new Error("Archivo AIFF sin chunk 'COMM'");
  if (ssndOffset < 0) throw new Error("Archivo AIFF sin chunk 'SSND'");

  // "sowt" es PCM little-endian (lo que exporta macOS/Logic); "NONE"/"twos" es el
  // big-endian estándar de AIFF. Cualquier otra cosa es audio comprimido real
  // (ej. ima4, ulaw) y no se puede leer sin un códec adicional — se declara.
  const littleEndian = compression === "sowt";
  if (compression !== "NONE" && compression !== "twos" && compression !== "sowt") {
    throw new Error(`AIFF-C comprimido no soportado (compresión "${compression}"): solo PCM sin comprimir.`);
  }

  const bytesPerSample = bitDepth / 8;
  const available = Math.floor((u8.length - ssndOffset) / (bytesPerSample * channels));
  const n = Math.max(0, Math.min(frames, available)); // no leer más allá del archivo si el header miente
  const channelData = Array.from({ length: channels }, () => new Float32Array(n));

  let off = ssndOffset;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < channels; c++) {
      let sample;
      if (bitDepth === 16) {
        sample = dv.getInt16(off, littleEndian) / 32768;
      } else if (bitDepth === 24) {
        const b0 = u8[off], b1 = u8[off + 1], b2 = u8[off + 2];
        let v = littleEndian ? b0 | (b1 << 8) | (b2 << 16) : (b0 << 16) | (b1 << 8) | b2;
        if (v & 0x800000) v -= 0x1000000;
        sample = v / 8388608;
      } else if (bitDepth === 32) {
        sample = dv.getInt32(off, littleEndian) / 2147483648;
      } else if (bitDepth === 8) {
        // AIFF de 8 bits es PCM con signo (a diferencia de WAV, que lo guarda sin signo)
        sample = dv.getInt8(off) / 128;
      } else {
        throw new Error(`Bit depth AIFF no soportado: ${bitDepth}`);
      }
      channelData[c][i] = sample;
      off += bytesPerSample;
    }
  }

  return { channelData, sampleRate: Math.round(sampleRate), bitDepth, format: "aiff" };
}
