// Sanidad de las fórmulas de temperamento (engine/temperament.mjs) contra
// valores canónicos publicados — nunca confiar en decimales de memoria sin
// verificar. Sigue el patrón check()/process.exit(1) de test/.
import { temperamentOffsetCents, TEMPERAMENTS } from "../engine/temperament.mjs";

const TOL = 0.05; // ¢, margen de redondeo de punto flotante
let failed = false;

function check(label, actual, expected, tol = TOL) {
  const ok = Math.abs(actual - expected) <= tol;
  if (ok) {
    console.log(`OK — ${label} (${actual.toFixed(2)}¢, esperado ${expected.toFixed(2)}¢)`);
  } else {
    console.error(`FALLÓ — ${label}: obtuvo ${actual.toFixed(2)}¢, esperaba ${expected.toFixed(2)}¢ (±${tol})`);
    failed = true;
  }
}

// ── Temperamento igual: offset siempre 0 ──
for (let d = 0; d < 12; d++) {
  check(`equal grado ${d} es 0¢`, temperamentOffsetCents("equal", d), 0);
}

// ── Justa (5-limit): valores canónicos publicados ──
check("justa: quinta (grado 7) ≈ +1.96¢", temperamentOffsetCents("just", 7), 1.96);
check("justa: tercera mayor (grado 4) ≈ −13.69¢", temperamentOffsetCents("just", 4), -13.69);
check("justa: cuarta (grado 5) ≈ −1.96¢", temperamentOffsetCents("just", 5), -1.96);
check("justa: segunda mayor (grado 2) ≈ +3.91¢", temperamentOffsetCents("just", 2), 3.91);
check("justa: sexta mayor (grado 9) ≈ −15.64¢", temperamentOffsetCents("just", 9), -15.64);
check("justa: séptima mayor (grado 11) ≈ −11.73¢", temperamentOffsetCents("just", 11), -11.73);
check("justa: tónica (grado 0) es 0¢", temperamentOffsetCents("just", 0), 0);

check("justa: tritono (grado 6, 45/32) ≈ −9.78¢", temperamentOffsetCents("just", 6), -9.78);

// Propiedad de simetría esperada en esta construcción de 5-limit de una sola
// cadena: offset(k) === -offset(12-k) para k=1..5 (el grado 6 es su propio
// espejo — 12-6=6 — y por eso queda fuera: no puede satisfacer la propiedad
// consigo mismo salvo que su offset fuera 0, que no lo es).
for (let k = 1; k <= 5; k++) {
  const a = temperamentOffsetCents("just", k);
  const b = temperamentOffsetCents("just", 12 - k);
  check(`justa: simetría offset(${k}) = −offset(${12 - k})`, a, -b, 0.02);
}

// ── Mesotónica (1/4 de coma): valores canónicos publicados ──
// La quinta mesotónica de 1/4 de coma es ≈696.58¢ (700 − 3.42¢ de offset).
check("mesotónica: quinta (grado 7) ≈ −3.42¢ (quinta ≈696.58¢)", temperamentOffsetCents("meantone", 7), -3.42);
// El rasgo definitorio del temperamento: la tercera mayor es PURA (idéntica a justa, 5/4).
const justThird = temperamentOffsetCents("just", 4);
const meantoneThird = temperamentOffsetCents("meantone", 4);
check("mesotónica: tercera mayor coincide con la justa (rasgo definitorio)", meantoneThird, justThird, 0.02);
check("mesotónica: tónica (grado 0) es 0¢", temperamentOffsetCents("meantone", 0), 0);

if (failed) {
  console.error("\nFALLÓ — alguna verificación de temperamento no coincide con la referencia canónica.");
  process.exit(1);
}
console.log("\nOK — todas las tablas de temperamento verificadas contra valores canónicos publicados.");
