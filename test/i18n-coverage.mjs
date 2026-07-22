// Cobertura de i18n (v1.3, committeado — antes vivía como script ad hoc fuera
// del repo): valida que los 10 idiomas tengan exactamente las mismas claves y
// los mismos placeholders {var} que es.json (fuente de verdad), y que
// engine/note-names.mjs tenga exactamente 12 nombres de nota por cada código
// de AVAILABLE_LOCALES. Sigue el patrón check()/process.exit(1) de test/.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AVAILABLE_LOCALES } from "../engine/i18n.mjs";
import { NOTE_NAMES } from "../engine/note-names.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const i18nDir = path.join(__dirname, "..", "i18n");

let failed = false;
function check(label, ok, detail) {
  if (ok) {
    console.log(`OK — ${label}`);
  } else {
    console.error(`FALLÓ — ${label}${detail ? ` (${detail})` : ""}`);
    failed = true;
  }
}

function placeholdersOf(str) {
  return new Set([...str.matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

const codes = AVAILABLE_LOCALES.map((l) => l.code);
const source = JSON.parse(fs.readFileSync(path.join(i18nDir, "es.json"), "utf8"));
const sourceKeys = Object.keys(source);

for (const code of codes) {
  const filePath = path.join(i18nDir, `${code}.json`);
  if (!fs.existsSync(filePath)) { check(`${code}.json existe`, false); continue; }
  const dict = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const keys = Object.keys(dict);

  const missing = sourceKeys.filter((k) => !(k in dict));
  const extra = keys.filter((k) => !(k in source));
  check(`[${code}] mismas claves que es.json (${keys.length} claves)`, missing.length === 0 && extra.length === 0,
    missing.length ? `faltan: ${missing.join(", ")}` : extra.length ? `sobran: ${extra.join(", ")}` : "");

  let placeholderMismatch = [];
  for (const k of sourceKeys) {
    if (!(k in dict)) continue;
    const a = placeholdersOf(source[k]), b = placeholdersOf(dict[k]);
    if (!setsEqual(a, b)) placeholderMismatch.push(k);
  }
  check(`[${code}] mismos placeholders {var} por clave`, placeholderMismatch.length === 0,
    placeholderMismatch.length ? placeholderMismatch.join(", ") : "");

  const names = NOTE_NAMES[code];
  check(`[${code}] note-names.mjs tiene 12 nombres`, Array.isArray(names) && names.length === 12,
    names ? `tiene ${names.length}` : "no existe entrada");
}

if (failed) {
  console.error("\nFALLÓ — revisar los idiomas marcados arriba.");
  process.exit(1);
}
console.log(`\nOK — ${codes.length} idiomas con claves, placeholders y nombres de nota consistentes (${sourceKeys.length} claves).`);
