# CLAUDE.md — centrail / trainmusiq

## Qué es este proyecto
Centrail: diagnóstico y corrección de afinación de referencia, 100% client-side, GPL v3, deploy en GitHub Pages (https://trainmusiq.github.io/centrail/). Primera herramienta del ecosistema trainmusiq. ANTES DE CUALQUIER TAREA: lee `docs/especificacion.md` (el qué técnico de Centrail, vive aquí). Los documentos transversales del ecosistema (roadmap, método, identidad) viven en el repo privado `trainmusiq/trainmusiq`, clonado en este equipo en `/Users/juanma/Aat/Trainmusiq/docs/` — léelos ahí, no se duplican en este repo.

## Comandos
- Tests: `npm run test:roundtrip` (round-trip sintético; umbral ≤0.1 ¢ en shift de referencia)
- Servidor local: usar el server SIN caché del repo (nunca un estático con caché — ver gotchas)
- Deploy: push a `main` actualiza Pages automáticamente

## Reglas duras (no re-discutir; el porqué está en docs/)
1. **Tubería de decodificación unificada**: medir y corregir SIEMPRE sobre la misma decodificación. Jamás decodeAudioData para medir y otra vía para procesar.
2. **timeRatio=1 siempre** en corrección de pitch: la duración es intocable.
3. **El algoritmo de detección está congelado** (especificacion.md §3). Mejoras van al roadmap, no al código, salvo sesión explícitamente dedicada.
4. **Sin recursos de CDN externos**: todo auto-hosteado (fuentes incluidas).
5. **Sin dependencias con hilos/SharedArrayBuffer** (GitHub Pages no permite COOP/COEP). Verificar TODA librería WASM nueva: grep por pthread|USE_PTHREADS|Atomics + test de instanciación.
6. **Vendorizar con versión fijada** toda dependencia de runtime (patrón usado con rubberband-wasm y @wasm-audio-decoders/flac): bundle sin imports externos, licencia verificada compatible GPL v3, commiteada en vendor/.
7. **Progreso honesto**: toda operación >1s reporta % real, etapa nombrada y ETA. Nunca spinner indeterminado.
8. **Copy de UI**: sincero, directo y afectivo; disuasivo, no imperativo; nunca sobre-explicado ("Ya está afinado. Déjalo así."). Detalle técnico secundario/expandible.
9. **Actuar-mínimo-e-informar**: decisiones técnicas (p.ej. reducción por picos) se aplican con el mínimo necesario y se informan; jamás se le preguntan al usuario.
10. **Nada entra a una versión en construcción**: ideas nuevas → roadmap.md §6 del repo `trainmusiq/trainmusiq`.
11. **test/private/ está en .gitignore**: contiene audio con copyright del fundador. JAMÁS commitearlo ni referenciarlo en código público.
12. **Commits por hito**, mensajes descriptivos, push al cierre de cada hito.
13. **Idioma — español neutro (registrada 15 jul 2026)**: todo texto producido — copy de producto (UI, correos, páginas) Y reportes/comunicaciones de sesión — se escribe en español neutro: tuteo estándar (quieres, suelta, haz clic, puedes), nunca voseo (querés, soltá, hacé, podés) ni regionalismos de ningún país (ver `brief-diseno.md` de `trainmusiq/trainmusiq`).
14. **Ko-fi visible siempre (registrada 16 jul 2026)**: el footer debe mostrar el enlace a ko-fi.com/trainmusiq con el copy canónico bilingüe (ver `roadmap.md` §3.12 de `trainmusiq/trainmusiq`) — la suscripción da más opciones y velocidad, el café es para quien el tier gratis ya le basta.

## Gotchas pagados (no volver a pagar)
- **Caché de módulos ES del navegador**: persiste incluso con reload y está atada al origen (puerto). Síntoma: bugs fantasma tras editar módulos (costó ~1h de debugging el 6 jul). Mitigación: server sin caché en dev + cache-busting versionado en producción.
- **decodeAudioData puede resamplear** al sample rate del AudioContext (~0.9 ¢ de desvío observado). Por eso la regla 1.
- **No crear buffers del archivo completo**: downmix y procesamiento por ventana/chunk (un buffer mono completo de un FLAC 96kHz duplicaba la memoria; corregido el 6 jul).
- **R bajo (~8%) es normal en material percusivo** y NO invalida la medición (histograma disperso ≠ centro ambiguo); la app lo declara, no lo esconde.
- **performance.memory no existe en Workers** (al menos en el entorno de pruebas usado).
- **El throttling de timers en pestañas en background NO afecta al pipeline** (investigado 9 jul con test empírico real de 3:26, foreground 212.3s vs backgrounded 199.0s, sin degradación) — porque todos los `setTimeout(r,0)` de cesión de hilo viven dentro de `workers/engine.worker.mjs`, y los Workers dedicados están exentos del clamp de Chrome. Mantener SIEMPRE el trabajo pesado dentro del Worker, nunca en el hilo principal.
- **El umbral de detección de picos (0.002 × magnitud máxima) genera ~1000 "picos" incluso en ruido blanco puro** (medido 16 jul: 1140 picos en un frame de ruido puro vs. 3 en un tono limpio) — cualquier comparación de picos entre ventanas (ej. persistencia, futuras mejoras) que no restrinja a los K picos más fuertes por ventana va a encontrar coincidencias espurias casi garantizadas. Ver especificacion.md §3 (hallazgo del 16 jul) para el intento de usar esto en la exclusión de ventanas sin contenido tonal, y por qué AND/OR simples no bastan en música real.

## Al cerrar cada sesión
Reportar: checklist de lo pedido con ✓/✗/⚠ (los ⚠ honestos valen más que ✓ de cortesía), commits hechos, y qué quedó pendiente con su porqué. Actualizar docs/especificacion.md si la realidad enseñó algo nuevo (hallazgos con fecha).
