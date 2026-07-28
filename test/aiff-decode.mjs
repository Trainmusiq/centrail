// Decodificación AIFF (engine/aiff.mjs, v1.3.2): AIFF no tiene decodificador
// nativo en el navegador, así que este es 100% código propio y necesita su
// propio test. Se construyen AIFF sintéticos en memoria (big-endian estándar y
// "sowt" little-endian de macOS), se decodifican, y se verifica que el audio
// recuperado coincide con el original dentro del error de cuantización — y que
// la medición de afinación sobre el resultado es la misma que sobre el buffer
// original (lo que realmente importa para el pipeline).
import { decodeAiff } from "../engine/aiff.mjs";
import { analyze } from "../engine/detect.mjs";

const SR = 44100;
let failed = false;

function check(label, ok, detail) {
  if (ok) {
    console.log(`   OK — ${label}`);
  } else {
    console.error(`   FALLÓ — ${label}${detail ? ` (${detail})` : ""}`);
    failed = true;
  }
}

function synthTone(freqHz, seconds, channels = 1) {
  const n = Math.round(seconds * SR);
  return Array.from({ length: channels }, (_, c) => {
    const buf = new Float32Array(n);
    const gain = c === 0 ? 1 : 0.8; // canales distintos para probar el intercalado
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      buf[i] = gain * (
        0.6 * Math.sin(2 * Math.PI * freqHz * t) +
        0.25 * Math.sin(2 * Math.PI * 2 * freqHz * t) +
        0.1 * Math.sin(2 * Math.PI * 3 * freqHz * t)
      );
    }
    return buf;
  });
}

/** Escribe un float extendido de 80 bits (el formato del sample rate en AIFF). */
function writeExtendedFloat80(dv, offset, value) {
  const e = Math.floor(Math.log2(value));
  const expon = e + 16383;
  const mant = value / Math.pow(2, e - 63); // mantisa de 64 bits con el bit implícito puesto
  dv.setUint16(offset, expon, false);
  dv.setUint32(offset + 2, Math.floor(mant / 4294967296), false);
  dv.setUint32(offset + 6, mant >>> 0, false);
}

/** Construye un AIFF (o AIFF-C "sowt") en memoria para probar el decoder. */
function buildAiff({ channelData, sampleRate, bitDepth, sowt = false }) {
  const channels = channelData.length;
  const frames = channelData[0].length;
  const bytesPerSample = bitDepth / 8;
  const ssndDataSize = frames * channels * bytesPerSample;
  const commSize = sowt ? 22 + 2 : 18; // AIFF-C agrega compressionType + nombre pascal vacío
  const ssndSize = 8 + ssndDataSize;
  const formSize = 4 + (sowt ? 8 + 4 : 0) + (8 + commSize) + (8 + ssndSize);
  const buf = new ArrayBuffer(8 + formSize);
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);
  const tag = (off, s) => { for (let i = 0; i < 4; i++) u8[off + i] = s.charCodeAt(i); };

  let p = 0;
  tag(p, "FORM"); dv.setUint32(p + 4, formSize, false); p += 8;
  tag(p, sowt ? "AIFC" : "AIFF"); p += 4;

  if (sowt) { // AIFF-C exige un chunk FVER antes de COMM
    tag(p, "FVER"); dv.setUint32(p + 4, 4, false); dv.setUint32(p + 8, 0xA2805140, false); p += 12;
  }

  tag(p, "COMM"); dv.setUint32(p + 4, commSize, false); p += 8;
  dv.setUint16(p, channels, false);
  dv.setUint32(p + 2, frames, false);
  dv.setUint16(p + 6, bitDepth, false);
  writeExtendedFloat80(dv, p + 8, sampleRate);
  if (sowt) { tag(p + 18, "sowt"); u8[p + 22] = 0; u8[p + 23] = 0; }
  p += commSize;

  tag(p, "SSND"); dv.setUint32(p + 4, ssndSize, false); p += 8;
  dv.setUint32(p, 0, false); dv.setUint32(p + 4, 0, false); p += 8; // offset + blockSize

  const clamp = (s) => (s > 1 ? 1 : s < -1 ? -1 : s);
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const s = clamp(channelData[c][i]);
      if (bitDepth === 16) {
        dv.setInt16(p, Math.round(s * 32767), sowt);
      } else if (bitDepth === 24) {
        const v = Math.round(s * 8388607) & 0xffffff;
        if (sowt) { u8[p] = v & 0xff; u8[p + 1] = (v >> 8) & 0xff; u8[p + 2] = (v >> 16) & 0xff; }
        else { u8[p] = (v >> 16) & 0xff; u8[p + 1] = (v >> 8) & 0xff; u8[p + 2] = v & 0xff; }
      } else if (bitDepth === 32) {
        dv.setInt32(p, Math.round(s * 2147483647), sowt);
      }
      p += bytesPerSample;
    }
  }
  return u8;
}

function maxAbsDiff(a, b) {
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i]));
  return m;
}

// Tolerancia: 1/2^(bits-1) por el paso de cuantización, con factor 2 de margen —
// misma convención que test/wav-roundtrip.mjs. El factor cubre la asimetría
// estándar de codificar con 2^(bits-1)−1 y decodificar con 2^(bits-1).
const TOLERANCE_FACTOR = 2;
const quantStep = (bits) => Math.pow(2, -(bits - 1));

const scenarios = [
  { label: "AIFF 16-bit mono (big-endian)", bitDepth: 16, channels: 1, sowt: false },
  { label: "AIFF 24-bit estéreo (big-endian)", bitDepth: 24, channels: 2, sowt: false },
  { label: "AIFF 32-bit mono (big-endian)", bitDepth: 32, channels: 1, sowt: false },
  { label: "AIFF-C 16-bit estéreo (sowt, little-endian de macOS)", bitDepth: 16, channels: 2, sowt: true },
].map((sc) => ({ ...sc, tol: quantStep(sc.bitDepth) * TOLERANCE_FACTOR }));

const F0 = 438.6;
const beforeRef = (await analyze({ channelData: synthTone(F0, 4, 1), sampleRate: SR })).refHz;
console.log(`Medición del buffer original (fundamental de prueba ${F0} Hz): ${beforeRef.toFixed(3)} Hz\n`);

for (const sc of scenarios) {
  console.log(`── ${sc.label} ──`);
  const original = synthTone(F0, 4, sc.channels);
  const bytes = buildAiff({ channelData: original, sampleRate: SR, bitDepth: sc.bitDepth, sowt: sc.sowt });
  const decoded = decodeAiff(bytes);

  check("sampleRate preservado", decoded.sampleRate === SR, `obtuvo ${decoded.sampleRate}`);
  check("bitDepth reportado correcto", decoded.bitDepth === sc.bitDepth, `obtuvo ${decoded.bitDepth}`);
  check("canales preservados", decoded.channelData.length === sc.channels, `obtuvo ${decoded.channelData.length}`);
  check("duración exacta (misma cantidad de muestras)",
    decoded.channelData[0].length === original[0].length,
    `${decoded.channelData[0].length} vs ${original[0].length}`);

  let worst = 0;
  for (let c = 0; c < sc.channels; c++) worst = Math.max(worst, maxAbsDiff(original[c], decoded.channelData[c]));
  check(`error de cuantización ≤ ${sc.tol.toExponential(2)}`, worst <= sc.tol, `obtuvo ${worst.toExponential(2)}`);

  // Lo que de verdad importa para el pipeline: la medición sobre el AIFF decodificado
  // debe coincidir con la del buffer original (no comparar contra el fundamental
  // teórico — el detector pondera todos los picos, ver skill audio-validation).
  const after = await analyze({ channelData: decoded.channelData, sampleRate: decoded.sampleRate });
  const driftCents = 1200 * Math.log2(after.refHz / beforeRef);
  check(`medición sin drift vs el original (${after.refHz.toFixed(3)} Hz, ${driftCents >= 0 ? "+" : ""}${driftCents.toFixed(3)} ¢)`,
    Math.abs(driftCents) <= 0.1, `${driftCents.toFixed(3)} ¢`);
  console.log("");
}

// Rechazo honesto de AIFF-C realmente comprimido (no se puede leer sin un códec).
console.log("── AIFF-C comprimido (debe rechazarse con mensaje claro) ──");
const fake = buildAiff({ channelData: synthTone(F0, 0.1, 1), sampleRate: SR, bitDepth: 16, sowt: true });
for (let i = 0; i < fake.length - 4; i++) { // busca "sowt" y lo reemplaza por "ima4"
  if (String.fromCharCode(fake[i], fake[i + 1], fake[i + 2], fake[i + 3]) === "sowt") {
    "ima4".split("").forEach((ch, k) => { fake[i + k] = ch.charCodeAt(0); });
    break;
  }
}
let rejected = false, msg = "";
try { decodeAiff(fake); } catch (e) { rejected = true; msg = e.message; }
check("rechaza AIFF-C comprimido en vez de devolver ruido", rejected, "no lanzó error");
check("el mensaje nombra la compresión encontrada", rejected && msg.includes("ima4"), msg);

if (failed) {
  console.error("\nFALLÓ — la decodificación AIFF no cumple algún criterio.");
  process.exit(1);
}
console.log("\nOK — decodificación AIFF correcta en 16/24/32-bit, mono/estéreo, big-endian y sowt.");
