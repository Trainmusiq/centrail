// Temperamentos (v1.3) — offsets en cents por grado de la escala (0=tónica,
// ..., 11=séptima mayor), respecto a la rejilla temperada igual. Se calculan
// por FÓRMULA desde ratios/generador de quinta, no se hardcodean decimales de
// memoria (verificable, sin error de transcripción) — ver test/temperament-tables.mjs
// para la verificación contra valores canónicos publicados (quinta justa
// ≈+1.96¢, tercera justa ≈−13.69¢, quinta mesotónica ≈696.58¢).
//
// Aplicable tanto al drone (desplazar la frecuencia generada) como al afinador
// (reinterpretar contra qué "cero" se mide la desviación, engine/tuner-app.mjs).

function mod1200(cents) {
  return ((cents % 1200) + 1200) % 1200;
}

// 5-limit just intonation: ratios estándar de los 12 grados cromáticos
// respecto a la tónica (Ptolemy's intense diatonic + extensión cromática).
// Simetría de verificación: offset(k) === -offset(12-k) para k=1..11 (ver test).
const JUST_RATIOS = [
  1 / 1, 16 / 15, 9 / 8, 6 / 5, 5 / 4, 4 / 3,
  45 / 32, 3 / 2, 8 / 5, 5 / 3, 16 / 9, 15 / 8,
];

// Mesotónica de comma justa (1/4 de coma sintónica): cadena estándar de 12
// quintas temperadas Mib–Sol♯ (evita la "quinta de lobo" dentro del rango
// usado). CHAIN_POSITION[grado] = cuántas quintas (con signo) desde la
// tónica hay que apilar en esta cadena para llegar a ese grado.
const MEANTONE_CHAIN_POSITION = [0, 7, 2, -3, 4, -1, 6, 1, 8, 3, -2, 5];

function justOffsetCents(degree) {
  return 1200 * Math.log2(JUST_RATIOS[degree]) - degree * 100;
}

function meantoneFifthCents() {
  const pureFifth = 1200 * Math.log2(3 / 2);
  const syntonicComma = 1200 * Math.log2(81 / 80);
  return pureFifth - syntonicComma / 4;
}

function meantoneOffsetCents(degree) {
  const n = MEANTONE_CHAIN_POSITION[degree];
  const cents = mod1200(n * meantoneFifthCents());
  return cents - degree * 100;
}

export const TEMPERAMENTS = {
  equal: { label: "equal", offsetCents: () => 0 },
  just: { label: "just", offsetCents: justOffsetCents },
  meantone: { label: "meantone", offsetCents: meantoneOffsetCents },
};

/** @param {'equal'|'just'|'meantone'} name @param {number} degree 0-11 */
export function temperamentOffsetCents(name, degree) {
  const t = TEMPERAMENTS[name] ?? TEMPERAMENTS.equal;
  return t.offsetCents(((degree % 12) + 12) % 12);
}
