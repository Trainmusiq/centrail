# CLAUDE.md — centrail / trainmusiq

## Qué es este proyecto
Centrail: diagnóstico y corrección de afinación de referencia, 100% client-side, GPL v3, deploy en GitHub Pages (https://trainmusiq.github.io/centrail/). Primera herramienta del ecosistema trainmusiq. ANTES DE CUALQUIER TAREA: lee docs/especificacion.md (el qué), docs/roadmap.md (el orden y porqué) y docs/manual-continuidad.md (método y reglas de decisión).

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
10. **Nada entra a una versión en construcción**: ideas nuevas → docs/roadmap.md §6.
11. **test/private/ está en .gitignore**: contiene audio con copyright del fundador. JAMÁS commitearlo ni referenciarlo en código público.
12. **Commits por hito**, mensajes descriptivos, push al cierre de cada hito.

## Gotchas pagados (no volver a pagar)
- **Caché de módulos ES del navegador**: persiste incluso con reload y está atada al origen (puerto). Síntoma: bugs fantasma tras editar módulos (costó ~1h de debugging el 6 jul). Mitigación: server sin caché en dev + cache-busting versionado en producción.
- **decodeAudioData puede resamplear** al sample rate del AudioContext (~0.9 ¢ de desvío observado). Por eso la regla 1.
- **No crear buffers del archivo completo**: downmix y procesamiento por ventana/chunk (un buffer mono completo de un FLAC 96kHz duplicaba la memoria; corregido el 6 jul).
- **R bajo (~8%) es normal en material percusivo** y NO invalida la medición (histograma disperso ≠ centro ambiguo); la app lo declara, no lo esconde.
- **performance.memory no existe en Workers** (al menos en el entorno de pruebas usado).

## Al cerrar cada sesión
Reportar: checklist de lo pedido con ✓/✗/⚠ (los ⚠ honestos valen más que ✓ de cortesía), commits hechos, y qué quedó pendiente con su porqué. Actualizar docs/especificacion.md si la realidad enseñó algo nuevo (hallazgos con fecha).
