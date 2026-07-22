// Nombres de nota por idioma — módulo aparte, NO dentro de los i18n/*.json de
// copy: son datos posicionales de tamaño fijo (12, el orden importa) que
// consume matemática musical, no strings de interpolación con t(). Mezclarlos
// con las 95+ claves de copy ensuciaría la validación de paridad existente.
//
// Convención por idioma (decisión de diseño, v1.3):
// - Español/francés/italiano/portugués: solfeo (Do Re Mi Fa Sol La Si), como
//   se enseña y se usa en afinadores de esas culturas.
// - Inglés: letras C–B.
// - Alemán: letras, con "H" para el Si natural (convención alemana estándar)
//   — se usan solo sostenidos ascendentes (nunca "B" alemán, que es Si♭, para
//   no generar ambigüedad en un afinador cromático que solo sube en semitonos).
// - Japonés/coreano/chino/ruso: letras C–B — estándar internacional de
//   afinadores digitales en estos mercados (evita apostar por una convención
//   de solfeo/silábica sin revisión de hablante nativo, ya declarada como
//   limitación honesta del proyecto en otros idiomas).
const SOLFEGE = ["Do", "Do♯", "Re", "Re♯", "Mi", "Fa", "Fa♯", "Sol", "Sol♯", "La", "La♯", "Si"];
const LETTERS = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const LETTERS_DE = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "H"];

export const NOTE_NAMES = {
  es: SOLFEGE, fr: SOLFEGE, it: SOLFEGE, pt: SOLFEGE,
  en: LETTERS, ja: LETTERS, ko: LETTERS, zh: LETTERS, ru: LETTERS,
  de: LETTERS_DE,
};

/**
 * Convierte una frecuencia medida a nota+octava+desviación, relativa a la
 * frecuencia de referencia elegida (no asume 440 — si el riel es 442, A4=442
 * es el centro exacto de la nota La4). La bucketización de semitono siempre
 * es temperada igual; la reinterpretación por temperamento (justa/mesotónica)
 * se aplica DESPUÉS, en engine/tuner-app.mjs, sobre `centsFromEqual`.
 *
 * @param {number} hz
 * @param {number} referenceHz
 * @returns {{semitoneIndex:number, octave:number, centsFromEqual:number}}
 */
export function hzToNote(hz, referenceHz) {
  const noteNum = 12 * Math.log2(hz / referenceHz) + 69; // 69 = A4 en numeración tipo MIDI
  const rounded = Math.round(noteNum);
  const semitoneIndex = ((rounded % 12) + 12) % 12; // 0=Do/C
  const octave = Math.floor(rounded / 12) - 1;
  const centsFromEqual = (noteNum - rounded) * 100;
  return { semitoneIndex, octave, centsFromEqual };
}
