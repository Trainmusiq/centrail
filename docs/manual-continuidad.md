# trainmusiq — Manual de continuidad

**Versión:** 1.0 · 7 de julio de 2026 · Destino: `docs/manual-continuidad.md`
**Qué es esto:** el método de trabajo que construyó Centrail v1 en 48 horas, escrito para que cualquier sesión futura (Sonnet en Code para construir, Opus en Design para identidad, cualquier modelo para estrategia) replique el proceso completo sin depender de ninguna conversación ni modelo anterior. Los tres documentos hermanos: `especificacion.md` (el QUÉ de la etapa activa), `roadmap.md` (el orden y el porqué comercial), `brief-diseno.md` (identidad).

---

## 1. El método (los 7 pasos que funcionaron)

1. **Prototipo mínimo antes que nada.** Una versión desechable que valide el algoritmo/enfoque central con archivos reales del fundador. Si el núcleo no funciona, nada más importa.
2. **Validación cruzada externa.** Comparar contra al menos una herramienta/referencia independiente ANTES de construir (Centrail: 29a.ch). La coincidencia valida; la discrepancia enseña.
3. **Especificación antes de construir.** El QUÉ completo con decisiones tomadas, criterios de "terminado" medibles, y sección de riesgos. La spec es un documento VIVO: crece durante la construcción cuando la realidad enseña (registrar hallazgos con fecha, como §3 de la spec actual).
4. **Construcción por hitos con commits frecuentes.** Prompts autocontenidos y ordenados por prioridad estricta ("si la cuota se corta, lo de arriba queda hecho"). Nunca interrumpir a mitad de tarea; feedback en lote.
5. **Prueba manual del fundador con material real + oído.** Los números los valida la máquina; los artefactos audibles y la UX confusa solo los detecta un humano usando la herramienta de verdad.
6. **Release cuando el checklist de "terminado" da ✓ (con ⚠ honestos declarados), nunca antes ni mucho después.** Publicar con un ⚠ documentado es mejor que retrasar por perfeccionismo o publicar ocultándolo.
7. **Congelar y anotar.** Tras el release, TODO lo nuevo va al roadmap (banco de ideas §6), no a la versión. La regla madre: no se abre una etapa sin publicar la anterior; nada entra a una versión en construcción.

## 2. Reglas de decisión (los criterios que evitan re-discutir)

- **Gratis vs premium:** lo que corre client-side es gratis por definición (GPL + client-side ⇒ imposible de candar; ver "fork"). Premium = solo lo que vive en servidor (velocidad GPU, modelos pesados) o valor difícil de replicar.
- **Prometible vs no:** se promete lo resuelto por la industria (integrable), se marca "evaluar" lo que requiere benchmark, se declara "horizonte no prometible" la frontera de investigación. Regla del timbre en separación: se separa lo que suena distinto; lo idéntico, no.
- **Honestidad de producto:** diagnóstico antes de acción · progreso real, nunca spinner · actuar-mínimo-e-informar, nunca preguntar decisiones técnicas al usuario · incertidumbre declarada, jamás falsa precisión · advertencias en tono sincero, directo y afectivo, sin sobre-explicar ("Ya está afinado. Déjalo así.").
- **Anti-paridad comercial:** no perseguir el catálogo de Moises; ganar en lo que hacen mal + lo esencial de lo que hacen bien.
- **Decisiones técnicas con evidencia propia:** benchmark en el equipo/navegador real antes de elegir motor (nunca por reputación del modelo).

## 3. Prompt listo — Sesión v1.1 de Centrail (pegar en Claude Code)

> Lee docs/especificacion.md y docs/roadmap.md. Centrail v1 está publicado; esta sesión es la v1.1. En orden estricto de prioridad:
> 1. Cache-busting de módulos ES para producción (versionar imports o hash en nombres) — motivado por el incidente de caché documentado.
> 2. Previsualización A/B (§4.3): reproducir un segmento original vs. corregido antes de procesar completo.
> 3. Repetibilidad empírica (§3): medir mitades (o subconjuntos de ventanas) por separado y reportar su diferencia como incertidumbre real junto a R; recalibrar el mensaje de confianza con ambas señales.
> 4. GitHub Sponsors + Ko-fi en README y footer.
> 5. Los 10 idiomas de §4.4 sobre la arquitectura i18n existente.
> 6. MP3 export con lamejs (320 kbps default, aviso de formato con pérdida).
> 7. Transposición por semitonos (mismo motor; UI simple; advertencia de artefactos proporcional a la magnitud).
> 8. Cierra el ⚠ del checklist: incluye en test/ la validación round-trip (b) con el archivo real de R alto que te indicaré [fundador: aportar un FLAC de piano solo / jazz / coral].
> 9. Checklist §4.4 actualizado ✓/✗, deploy, URL.
> Incorpora además mis notas de uso de la semana: [LISTA DEL FUNDADOR].

## 4. Plantilla — Prompt de apertura de cualquier etapa nueva (trackjunction, chordtrain, …)

> Lee docs/roadmap.md (§0 arquitectura, §2 la etapa que abrimos, §6 catálogo) y docs/manual-continuidad.md (método y reglas). Abrimos [HERRAMIENTA]. Esta primera sesión NO construye producto: ejecuta los pasos 1-3 del método —
> 1. **Benchmark/decisión técnica**: [la decisión listada en el roadmap para esta etapa — p.ej. trackjunction: demucs.cpp WASM vs demucs-rs WebGPU, tiempo/memoria/compatibilidad en este equipo Y en un navegador sin WebGPU] — recomienda con evidencia y vendoriza el elegido.
> 2. **Prototipo mínimo** del núcleo con un archivo real del fundador.
> 3. **Escribe docs/especificacion-[herramienta].md** siguiendo la estructura de la spec de Centrail (visión, validado, algoritmo/motor, etapa con criterios de "terminado" medibles, riesgos, seguridad), incorporando lo aprendido en 1-2 y el catálogo §6 del roadmap como alcance de referencia.
> Crea el repo `trainmusiq/[herramienta]` (GPL v3, mismas prácticas de seguridad §11: Dependabot, sin CDN externos, verificación COOP/COEP del motor elegido). El motor compartido con Centrail (Rubber Band, detect, wav) se reutiliza — evaluar en la spec si como copia vendorizada o repo común `trainmusiq/engine`.

## 5. Qué pedir a quién

- **Sonnet (Claude Code):** todo lo de construir, testear, publicar, mantener specs del repo. Es el ejecutor del método.
- **Opus (Claude Design u otra sesión):** identidad visual con `docs/brief-diseno.md`; entregar 2-3 direcciones; la implementación de la identidad elegida la hace después Sonnet en una sesión propia, nunca a mitad de una etapa.
- **Cualquier modelo (estrategia/difusión):** darle roadmap + README como contexto; el plan de difusión es materia aparte (insumos: §3 del roadmap, la historia de validación vs Moises del README, la audiencia).
- **El fundador (insustituible):** prueba manual con oído, decisiones de marca/precio, la regla madre contra la dispersión, y aportar material real de prueba variado (el proyecto necesita un archivo de R alto: piano solo, jazz, coral).

## 6. Estado al cierre del arco de diseño (7 jul 2026)

Centrail v1 publicado y verificado (https://trainmusiq.github.io/centrail/, checklist §4.4 con un solo ⚠ documentado y cerrable). Backlog v1.1 completo con prompt listo (§3 de este manual). trackjunction ejecutable-ready, chordtrain estrategia-ready, triptheory/pianowagon visión documentada — el detalle fino de cada una se escribe AL ABRIRLA, con benchmarks en mano: eso es el método, no una omisión. Identidad visual: brief completo, exploración pendiente (fase Opus). Monetización: escalera definida, precio como hipótesis registrada, Merchant of Record anotado como primera evaluación.
