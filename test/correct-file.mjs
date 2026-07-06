// CLI: corrige el pitch de un archivo FLAC real y verifica el resultado re-midiéndolo.
// Uso:
//   node test/correct-file.mjs <in.flac> --target=440 --out=<out.wav>
//   node test/correct-file.mjs <in.flac> --shift-cents=100 --out=<out.wav>   (shift exacto conocido, para diagnóstico)

import fs from "node:fs";
import { decodeFlacFile, loadRubberBandModule, centsOf, circularDiff, fmtDur } from "./lib.mjs";
import { analyze } from "../engine/detect.mjs";
import { pitchShiftOffline } from "../engine/correct.mjs";
import { encodeWavPCM16 } from "../engine/wav.mjs";

function parseArgs(argv) {
  const args = { _: [] };
  for (const a of argv) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) args[m[1]] = m[2];
    else args._.push(a);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const filePath = args._[0];
  if (!filePath || (!args.target && !args["shift-cents"]) || !args.out) {
    console.error("Uso: node test/correct-file.mjs <in.flac> --target=440|--shift-cents=N --out=<out.wav>");
    process.exit(1);
  }

  console.log(`Decodificando ${filePath}…`);
  const { channelData, sampleRate } = await decodeFlacFile(filePath);
  const dur = channelData[0].length / sampleRate;
  console.log(`   ${sampleRate} Hz, ${channelData.length} canal(es), ${fmtDur(dur)}`);

  console.log("Midiendo archivo original…");
  const before = await analyze({ channelData, sampleRate });
  console.log(`   Antes: ${before.refHz.toFixed(2)} Hz (${before.offset >= 0 ? "+" : ""}${before.offset.toFixed(2)} ¢), R=${(before.R * 100).toFixed(1)}%`);

  let pitchScale, appliedShiftCents, mode;
  if (args["shift-cents"] !== undefined) {
    appliedShiftCents = Number(args["shift-cents"]);
    pitchScale = Math.pow(2, appliedShiftCents / 1200);
    mode = "control (shift exacto conocido, independiente de la medición)";
  } else {
    const targetHz = Number(args.target);
    pitchScale = targetHz / before.refHz;
    appliedShiftCents = centsOf(targetHz, before.refHz);
    mode = `corrección a destino ${targetHz} Hz`;
  }
  console.log(`Corrigiendo (${mode}): shift=${appliedShiftCents.toFixed(3)} ¢, pitchScale=${pitchScale.toFixed(6)}…`);

  const rbApi = await loadRubberBandModule();
  const t0 = Date.now();
  const { channelData: corrected } = pitchShiftOffline(rbApi, { channelData, sampleRate, pitchScale });
  console.log(`   Procesado en ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  if (corrected[0].length !== channelData[0].length) {
    console.warn(`   ADVERTENCIA: duración cambió (${channelData[0].length} → ${corrected[0].length} muestras)`);
  } else {
    console.log(`   Duración preservada: ${corrected[0].length} muestras`);
  }

  console.log("Re-midiendo archivo corregido…");
  const after = await analyze({ channelData: corrected, sampleRate });
  console.log(`   Después: ${after.refHz.toFixed(2)} Hz (${after.offset >= 0 ? "+" : ""}${after.offset.toFixed(2)} ¢), R=${(after.R * 100).toFixed(1)}%`);

  const predictedAfterOffset = ((before.offset + appliedShiftCents % 100) + 150) % 100 - 50;
  const errorVsPrediction = circularDiff(after.offset, predictedAfterOffset);
  console.log(`\nOffset predicho (before + shift aplicado, circular): ${predictedAfterOffset >= 0 ? "+" : ""}${predictedAfterOffset.toFixed(3)} ¢`);
  console.log(`Offset medido:                                        ${after.offset >= 0 ? "+" : ""}${after.offset.toFixed(3)} ¢`);
  console.log(`Error (medido − predicho):                            ${errorVsPrediction >= 0 ? "+" : ""}${errorVsPrediction.toFixed(3)} ¢`);

  if (args.target !== undefined) {
    const errorVsTarget = centsOf(after.refHz, Number(args.target));
    console.log(`Error vs destino (${args.target} Hz):                          ${errorVsTarget >= 0 ? "+" : ""}${errorVsTarget.toFixed(3)} ¢`);
  }

  fs.writeFileSync(args.out, encodeWavPCM16({ channelData: corrected, sampleRate }));
  console.log(`\nEscrito: ${args.out}`);
}

main().catch(err => { console.error(err); process.exit(1); });
