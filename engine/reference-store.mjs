// Riel compartido (v1.3): un solo concepto de frecuencia de referencia +
// temperamento + tónica entre el modo Grabación (destino de corrección) y el
// modo En vivo (afinador + drones). Mismo patrón que engine/i18n.mjs
// (localStorage + fallback a default), un solo blob JSON porque los 3 campos
// cambian juntos conceptualmente ("mi riel").

const STORAGE_KEY = "centrail-reference";
const DEFAULT = { hz: 440, temperament: "equal", tonic: 0 }; // tonic: índice semitono, 0=Do/C

function loadFromStorage() {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {}; // JSON corrupto/manual — no reventar, usar default
  }
}

const bus = typeof EventTarget !== "undefined" ? new EventTarget() : null;
let state = { ...DEFAULT, ...loadFromStorage() };

export function getReference() {
  return { ...state };
}

export function setReference(partial) {
  state = { ...state, ...partial };
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
  bus?.dispatchEvent(new CustomEvent("change", { detail: getReference() }));
}

/** @param {(ref: {hz:number, temperament:string, tonic:number}) => void} cb @returns {() => void} unsubscribe */
export function onReferenceChange(cb) {
  if (!bus) return () => {};
  const handler = (e) => cb(e.detail);
  bus.addEventListener("change", handler);
  return () => bus.removeEventListener("change", handler);
}

// sync entre pestañas: el evento "storage" solo se dispara en OTRAS pestañas,
// nunca en la que hizo el cambio (comportamiento estándar del navegador).
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    try {
      const parsed = JSON.parse(e.newValue);
      state = { ...DEFAULT, ...parsed };
      bus?.dispatchEvent(new CustomEvent("change", { detail: getReference() }));
    } catch {
      // JSON corrupto de otra pestaña — ignorar, mantener el estado local
    }
  });
}
