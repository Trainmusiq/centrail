// i18n mínimo, sin dependencias — arquitectura lista para los 10 idiomas de v1.1
// (§4.4): agregar un idioma es solo sumar i18n/{code}.json y una entrada aquí.

export const AVAILABLE_LOCALES = [
  { code: "es", label: "Español" },
  { code: "en", label: "English" },
  { code: "pt", label: "Português" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "zh", label: "中文" },
  { code: "ru", label: "Русский" },
];

const STORAGE_KEY = "centrail-lang";
const cache = {};

export async function loadLocale(code) {
  if (cache[code]) return cache[code];
  const res = await fetch(new URL(`../i18n/${code}.json?v=1.2.0`, import.meta.url));
  if (!res.ok) throw new Error(`No se pudo cargar el idioma "${code}"`);
  const data = await res.json();
  cache[code] = data;
  return data;
}

export function detectDefaultLocale() {
  const supported = AVAILABLE_LOCALES.map((l) => l.code);
  const saved = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
  if (saved && supported.includes(saved)) return saved;
  const nav = ((typeof navigator !== "undefined" && navigator.language) || "es").slice(0, 2).toLowerCase();
  return supported.includes(nav) ? nav : "es";
}

export function saveLocale(code) {
  if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, code);
}

export function interpolate(str, vars) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

/** @param {Record<string,string>} dict */
export function makeTranslator(dict) {
  return (key, vars) => interpolate(dict[key] ?? key, vars);
}
