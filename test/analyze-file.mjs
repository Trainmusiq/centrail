// CLI: analiza un archivo FLAC real con el detector del motor (engine/detect.mjs).
// Uso: node test/analyze-file.mjs <archivo.flac>

import { decodeFlacFile, fmtDur } from "./lib.mjs";
import { analyze } from "../engine/detect.mjs";

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Uso: node test/analyze-file.mjs <archivo.flac>");
    process.exit(1);
  }
  console.log(`Decodificando ${filePath}…`);
  const { channelData, sampleRate, bitDepth } = await decodeFlacFile(filePath);
  const dur = channelData[0].length / sampleRate;
  console.log(`   ${sampleRate} Hz, ${bitDepth}-bit, ${channelData.length} canal(es), ${fmtDur(dur)}`);

  console.log("Analizando…");
  const r = await analyze({ channelData, sampleRate });
  console.log(`\nPatrón detectado: ${r.refHz.toFixed(2)} Hz (${r.offset >= 0 ? "+" : ""}${r.offset.toFixed(2)} ¢)`);
  console.log(`Incertidumbre (repetibilidad entre mitades): ± ${r.unc.toFixed(2)} ¢ (splitDiff=${r.splitDiff === null ? "n/a" : r.splitDiff.toFixed(2) + "¢"})`);
  console.log(`Consistencia tonal (R): ${(r.R * 100).toFixed(1)} % (${r.R > 0.15 ? "alta" : r.R > 0.05 ? "media" : "baja"})`);
  console.log(`Ventanas analizadas: ${r.nFrames}`);
  const maxDrift = Math.max(...r.segs.filter(Boolean).map(s => Math.abs(s.off - r.offset)));
  console.log(`Deriva máxima: ${maxDrift.toFixed(2)} ¢`);
}

main().catch(err => { console.error(err); process.exit(1); });
