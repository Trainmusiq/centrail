// Regresión específica del hallazgo de sesión (6 jul): el refactor de
// analyzeFrame() en engine/detect.mjs (downmix por ventana en vez de un
// buffer mono del archivo completo) solo se había probado con audio MONO
// (test/roundtrip.mjs) hasta que un archivo estéreo real expuso el problema
// (que resultó ser caché del navegador, no el downmix — pero el vacío de
// cobertura era real). Este test ejercita la rama estéreo de forma aislada
// y rápida, sin depender de archivos reales.

import { analyze } from "../engine/detect.mjs";

const SR = 44100;
const DURATION_S = 6;
const N = SR * DURATION_S;
const HZ = 438.6;
const TOLERANCE_CENTS = 0.1;

function synthMono(freqHz, n, sr) {
  const ch = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    ch[i] = 0.6 * Math.sin(2 * Math.PI * freqHz * t) + 0.25 * Math.sin(2 * Math.PI * freqHz * 2 * t) + 0.1 * Math.sin(2 * Math.PI * freqHz * 3 * t);
  }
  return ch;
}

let failed = false;
function check(label, ok, detail) {
  console.log(`${ok ? "OK" : "FALLÓ"} — ${label}${ok ? "" : ` (${detail})`}`);
  if (!ok) failed = true;
}

// 1) Estéreo con canales idénticos debe medir igual que mono (el downmix de un
//    par de canales iguales no debe introducir ningún sesgo).
const mono = synthMono(HZ, N, SR);
const rMono = await analyze({ channelData: [mono], sampleRate: SR });
const rStereoIdentical = await analyze({ channelData: [mono, mono], sampleRate: SR });
const devIdentical = 1200 * Math.log2(rStereoIdentical.refHz / rMono.refHz);
check(
  "estéreo con canales idénticos mide igual que mono",
  Math.abs(devIdentical) <= TOLERANCE_CENTS,
  `mono=${rMono.refHz.toFixed(3)}Hz stereo=${rStereoIdentical.refHz.toFixed(3)}Hz diff=${devIdentical.toFixed(3)}¢`
);

// 2) Estéreo con canales de distinta amplitud (caso real: mezclas no perfectamente
//    centradas) debe seguir midiendo el mismo fundamental, el downmix promedia
//    correctamente sin desplazar el pico.
const ch1 = synthMono(HZ, N, SR);
const ch2 = new Float32Array(N);
for (let i = 0; i < N; i++) ch2[i] = ch1[i] * 0.4; // mismo contenido, mitad de amplitud
const rStereoAsym = await analyze({ channelData: [ch1, ch2], sampleRate: SR });
const devAsym = 1200 * Math.log2(rStereoAsym.refHz / rMono.refHz);
check(
  "estéreo con canales de amplitud distinta no desplaza la medición",
  Math.abs(devAsym) <= TOLERANCE_CENTS,
  `mono=${rMono.refHz.toFixed(3)}Hz stereo_asym=${rStereoAsym.refHz.toFixed(3)}Hz diff=${devAsym.toFixed(3)}¢`
);

// 3) 3 canales (caso no común, pero analyzeFrame no debe asumir exactamente 2):
//    debe seguir convergiendo al mismo fundamental.
const rThreeCh = await analyze({ channelData: [mono, mono, mono], sampleRate: SR });
const devThreeCh = 1200 * Math.log2(rThreeCh.refHz / rMono.refHz);
check(
  "3 canales idénticos miden igual que mono (downmix no asume estéreo)",
  Math.abs(devThreeCh) <= TOLERANCE_CENTS,
  `mono=${rMono.refHz.toFixed(3)}Hz 3ch=${rThreeCh.refHz.toFixed(3)}Hz diff=${devThreeCh.toFixed(3)}¢`
);

// 4) Alta consistencia tonal esperada en material sintético limpio (sanity check
//    de que el downmix no está diluyendo la energía del pico artificialmente).
check("R alto en tono sintético limpio (R > 0.9)", rStereoIdentical.R > 0.9, `R=${rStereoIdentical.R.toFixed(3)}`);

if (failed) {
  console.error("\nFALLÓ: la rama estéreo/multicanal de analyze() no se comporta como se espera.");
  process.exit(1);
}
console.log("\nOK — detect.mjs mide correctamente en mono, estéreo (simétrico y asimétrico) y 3 canales.");
