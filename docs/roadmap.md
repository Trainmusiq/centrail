# trainmusiq — Roadmap maestro hacia la herramienta monetizable

**Versión:** 1.4 · 7 de julio de 2026
**Destino:** `docs/roadmap.md` en el repo `trainmusiq/centrail` (documento vivo; lo mantiene quien ejecute cada sesión)
**Relación con otros documentos:** `docs/especificacion.md` = el QUÉ técnico de cada etapa; este roadmap = el CUÁNDO, el ORDEN y el POR QUÉ comercial. `docs/brief-diseno.md` = identidad visual (fase posterior).
**Regla madre (inmutable):** no se abre una etapa sin publicar la anterior. Nada entra a una versión en construcción; lo nuevo se anota aquí y espera.

---

## 0. La visión de producto (el norte)

**Arquitectura del ecosistema (corregida por el fundador, 6 jul):** trainmusiq NO es "cada herramienta un vagón". Es un **ecosistema de herramientas independientes para aprender y entrenar música**, con inspiración ferroviaria aplicada donde calza naturalmente en cada una. La metáfora profunda del tren pertenece al análisis armónico funcional: **la progresión de acordes ES el tren — cada acorde un vagón, la concatenación es el viaje** (la música como arte temporal que te lleva por paisajes lo que dura la canción). Herramientas del ecosistema (nombres candidatos, cada una su propio repo bajo la org `trainmusiq`, compartiendo motor):

- **centrail** (publicada) — afinación de referencia: el riel que guía/tempera la canción.
- **trackjunction** — el empalme que divide la canción en vías: stems + estudio (mute/solo, cambio de tempo, loops).
- **chordtrain** — entrenar acordes y el tren armónico: detección, análisis funcional, transposición, repositorio de posiciones.
- **triptheory** — la teoría para el viaje musical: pedagogía anclada a las canciones del usuario.
- **pianowagon** — trasponer al piano los acordes del tren: tablatura con digitación.

centrail es la **puerta de entrada** al ecosistema; la suscripción se justifica por el conjunto: útil, preciso, completo y sencillo.

**El pipeline integrado sigue siendo el corazón de trackjunction:** cargas una canción → diagnóstico honesto de afinación → separación en stems → refinamiento de pitch por stem → temperado a la referencia elegida → stems corregidos y/o mezcla. Reemplaza el ritual fix-tuning → DAW → UVR5.

**Diferenciadores contra Moises (probados o por diseño):**
1. **Precisión declarada**: medimos en décimas de cent CON incertidumbre visible; Moises corrigió mal un archivo perfecto en nuestra validación documentada (README).
2. **Honestidad estructural**: diagnóstico antes de corrección; "tu archivo ya está bien, no lo toques"; progreso real sin spinners; actuar-mínimo-e-informar-nunca-preguntar.
3. **Privacidad total en el tier gratis**: el audio nunca sale del equipo del usuario.
4. **Pipeline integrado**: pitch + stems + temperado por stem en un solo flujo. Nadie lo ofrece como unidad.
5. **Open source (GPL v3)**: la confianza como activo comercial.

**Modelo económico:** gratis = tu computador procesa (costo marginal $0 para el proyecto); premium = nuestro servidor GPU procesa en segundos + features de cómputo pesado. El código client-side no se puede candar (GPL + client-side ⇒ fork trivial); el premium vive SOLO donde el código no se distribuye: el servidor.

## 1. Estado al 6 de julio de 2026

- **Centrail v1 publicado**: https://trainmusiq.github.io/centrail/ — diagnóstico validado contra 29a.ch, corrección Rubber Band validada (error +0.017 ¢ en material limpio), export WAV. Sesión B en curso: FLAC export, velo de progreso, fixes de UI, i18n es/en, README.
- **Infra**: repo `trainmusiq/centrail`, GPL v3, 2FA + passkey, Dependabot, GitHub Pages, sin COOP/COEP necesario (todo single-thread verificado).
- **Motor reutilizable**: `engine/` desacoplado de la UI — detect, correct, wav; el pipeline de la etapa 2 se construye alrededor de él, no en su reemplazo.

## 2. La escalera de versiones (orden estricto)

### v1.1 — Pulido post-release (1-2 sesiones Sonnet, semana 1-2)
1. Lo que salga de la semana de uso real del fundador (fuente #1 de verdad).
2. Previsualización A/B si no entró en sesión B.
3. **Repetibilidad empírica** como métrica de confianza (medir mitades por separado; §3 de la spec) — sube de prioridad: es el árbitro para archivos de R bajo tipo "Pétalo de Sal" y refuerza el diferenciador #1.
4. 10 idiomas (es, en, pt-BR, fr, de, it, ja, ko, zh, ru).
5. **GitHub Sponsors + Ko-fi** en README y footer de la app (primera monetización, costo 20 min, cero fricción con GPL).
6. MP3 export (lamejs) + transposición por semitonos (mismo motor, UI simple) — ambas ya documentadas en la spec.

### v2.0 — ETAPA 2: trackjunction, el pipeline integrado (3-5 sesiones, semanas 2-5) ⭐ el salto de producto
**Definición:** dentro de la misma app, tras el diagnóstico: botón "Separar en stems" → 4 stems (voz, batería, bajo, resto) con htdemucs — **procesamiento en el navegador del usuario** (gratis, lento: advertir 10-20 min con progreso honesto por chunk/segmento).

Flujo completo nuevo:
1. Diagnóstico global (ya existe).
2. Separación en stems (demucs.cpp WASM o demucs-rs WebGPU — **decisión técnica de la primera sesión de etapa 2**, con benchmark propio: WebGPU es más rápido pero soporte de navegadores a verificar; WASM es universal pero lento). Nota: la separación es automática por diseño (Demucs no requiere configuración del usuario — ventaja de UX a comunicar). **Mejora "más que Moises" (v2.x o tier servidor): detección automática de instrumentos presentes** (audio tagging, p.ej. PANNs/YAMNet) para elegir solo el modelo óptimo (4 stems vs 6 stems con guitarra/piano) y etiquetar resultados sin configuración manual.
3. **Refinamiento de pitch por stem**: medir sobre stems armónicos (bajo/voz/resto) EXCLUYENDO batería ⇒ resuelve estructuralmente el problema de R bajo por percusión (spec §3). El diagnóstico refinado reemplaza al global cuando existe.
4. **Temperado unificado**: corregir TODOS los stems con el mismo shift (coherencia de mezcla) a la referencia elegida; exportar stems corregidos individuales + opción de mezcla re-sumada.
5. Exportes: cada stem en WAV/FLAC; nombres `{original}_{stem}_{destino}Hz.{ext}`.

Criterios de release v2.0: una canción real pasa por el flujo completo en navegador sin colgarse; el refinamiento por stem reporta mejor consistencia que el global en material percusivo (medible con los archivos de prueba); la UI mantiene la sencillez (el pipeline avanzado no puede ensuciar el flujo simple de "solo quiero corregir el pitch").

### v2.5 — Tier servidor (2-4 sesiones + hardware/cloud, semanas 4-8; EN PARALELO a v2.0 tardía)
- **Decisión de infraestructura** (tomar con datos de uso de v2.0, no antes): (A) PC propio con GPU NVIDIA (RTX 3060 12GB usada, ~USD 200-300) + UVR5/demucs dockerizado + Cloudflare Tunnel; (B) GPU on-demand (RunPod/Vast, ~USD 0.01-0.05 por canción). Empezar con (B) para validar demanda sin CAPEX; migrar a (A) si el volumen lo justifica.
- Backend mínimo: endpoint de upload → cola → proceso GPU → descarga con expiración → borrado automático (privacidad como política también en el server: retención cero post-descarga, declarada).
- Seguridad seria (spec §11): auth, rate limiting, validación de archivos, HTTPS, límites de tamaño.
- La web es LA MISMA: el tier rápido solo cambia dónde se procesa. UI: "Procesar aquí (gratis, ~15 min) / Procesar en servidor (premium, ~30 s)" — el modelo económico transparente como texto de interfaz.

### v3.0 — ETAPA 3: chordtrain (3-5 sesiones, semanas 8-12)
- Base: ChordMini (301 etiquetas, alteraciones y extensiones incluidas desde v1 de la feature — requisito del fundador) + beat tracking.
- Correr en cliente vía ONNX Runtime Web si el modelo lo permite; si es muy pesado ⇒ nace directo como feature del tier servidor (decisión con benchmark en la primera sesión de la etapa).
- UI: timeline de acordes sincronizada con reproducción; modo simple (triadas) / completo (alteraciones). Aquí nace la identidad visual vagones-acorde (coordinar con fase Design).
- Detección de tonalidad global (croma + perfiles) entra aquí casi gratis.
- **v3.5 — Análisis armónico (candidato premium fuerte):** sobre los acordes detectados, análisis con music21: numerales romanos, identificación de **cadencias y progresiones/bloques armónicos que se repiten o varían** (la metáfora vagones-acorde hecha feature), comparación con progresiones célebres. Esto conecta directo con el vagón pedagógico del horizonte y es cómputo/valor difícil de replicar ⇒ monetizable con legitimidad.

### v4.0 — ETAPA 4: piano tab con digitación (horizonte, no planificar aún)
Basic Pitch → MIDI → algoritmo de digitación (dataset PIG) → grilla beats×notas con dedo. El amigo pianista como evaluador experto. Se especifica al abrir la etapa.

### Transversal — Fase Design (con Opus 4.8, cuando el fundador decida; recomendado: entre v1.1 y v2.0, o durante la espera de benchmarks de etapa 2)
Brief completo en `docs/brief-diseno.md` (lowercase trainmusiq, diagonal t→q, principios, entregables). La identidad nueva se implementa en una sesión Sonnet posterior, nunca a medio construir una etapa.

## 3. Monetización — plan concreto

**Filosofía:** la herramienta gratis impecable ES el marketing. No se cobra por lo que corre en el equipo del usuario; se cobra por velocidad (GPU), conveniencia y features de cómputo pesado. **Principio anti-paridad:** no competir con Moises feature por feature (carrera perdida para un equipo de uno); competir por diferenciación — mejor en lo que ellos hacen mal (precisión, honestidad, pipeline integrado, privacidad) + lo esencial de lo que hacen bien. Transposición y todo lo client-side es gratis por definición (GPL + client-side ⇒ imposible de candar).

**Contenido del tier premium (suscripción):**
- Procesamiento en servidor GPU: stems en segundos (vs minutos en navegador).
- Refinamiento de pitch por stem servido rápido.
- Detección automática de instrumentos + modelos de separación superiores (6 stems, BS-RoFormer).
- Acordes completos con alteraciones servidos rápido (si el modelo no corre en cliente, es 100% premium).
- Análisis armónico v3.5: cadencias, progresiones, numerales romanos, bloques que se repiten/varían.
- Futuro: piano tab con digitación (etapa 4).

**Escalera de ingresos:**
1. **Ya / v1.1:** GitHub Sponsors + Ko-fi (donaciones; validan que a alguien le importa).
2. **v2.5:** Suscripción premium. **Hipótesis de precio del fundador: USD 3/mes o USD 24/año (−33%)** — queda registrada como hipótesis a validar contra: (a) costo real por canción en GPU, (b) precios de Moises (referencia: ~5-8 USD/mes) — entrar por debajo con diferenciadores es coherente; (c) disposición de pago observada. Alternativa a evaluar: paquete de créditos (N canciones) además de suscripción, para usuarios esporádicos.
3. **Medio de pago:** para audiencia global con mínima fricción legal/tributaria desde Chile, evaluar PRIMERO un **Merchant of Record** (Paddle, Lemon Squeezy): ellos son el vendedor formal, manejan IVA/impuestos internacionales y aceptan tarjetas globales — ideal para un desarrollador individual. Flow.cl como complemento para público chileno si se justifica. Decisión al construir v2.5.
4. **Regla de oro comercial:** el tier gratis NUNCA se degrada para empujar al pago. El premium compite contra la paciencia del usuario, no contra su acceso.

**Métricas para decidir (instalar analytics respetuoso — p.ej. contador simple sin cookies — en v1.1):** usos/semana, % que llega a descargar, % que intenta stems en navegador y abandona por tiempo (≈ demanda del tier rápido), clicks en Sponsors.

## 4. Secuencia de sesiones con prompts semilla

Cada sesión futura de Claude Code parte con: *"Lee docs/especificacion.md y docs/roadmap.md. Estamos en [versión]. Objetivo de esta sesión: [punto del roadmap]."* La spec y este roadmap son el cerebro; ningún modelo específico es necesario.

| # | Objetivo | Semilla del prompt |
|---|---|---|
| B (hoy) | Cierre v1 | (ya entregado) |
| 1 | v1.1 núcleo | "Implementa repetibilidad empírica (§3 spec) como métrica de confianza junto a R; incorpora mis notas de uso: [lista]; agrega Sponsors/Ko-fi a README y footer." |
| 2 | v1.1 idiomas | "Completa los 10 idiomas de §4.4 sobre la arquitectura i18n existente." |
| 3 | Etapa 2 · decisión técnica | "Benchmark demucs.cpp (WASM) vs demucs-rs (WebGPU) en este equipo y en un navegador sin WebGPU: tiempo por canción, memoria, compatibilidad. Recomienda con evidencia y vendoriza el elegido." |
| 4-5 | Etapa 2 · pipeline | "Integra separación de stems al flujo post-diagnóstico con progreso honesto por etapa; luego refinamiento de pitch por stem excluyendo batería (§3) y temperado unificado con export por stem." |
| 6 | Etapa 2 · release v2.0 | "Checklist de criterios v2.0 del roadmap; stress test; actualiza README con el pipeline; publica." |
| 7+ | v2.5 servidor | "Prototipo del backend: RunPod on-demand, endpoint upload→proceso→descarga con retención cero. Costo real por canción medido." |

## 5. Riesgos del plan

- **El mayor: dispersión por urgencia.** La urgencia del fundador es real (necesita la herramienta) pero UVR5 local cubre la necesidad personal de stems MIENTRAS se construye la v2.0 bien. No publicar vagones a medio construir: la reputación open source se gasta rápido y se recupera lento.
- **Demucs en navegador puede decepcionar en velocidad** en máquinas modestas ⇒ mitigación: expectativas claras en UI + el tier servidor existe precisamente para esto.
- **ChordMini puede no correr bien en cliente** ⇒ plan B ya definido: nace como feature de servidor.
- **Suscripción requiere masa crítica**: sin usuarios del tier gratis no hay conversión ⇒ el post de lanzamiento (historia Moises) y el SEO de la herramienta gratis son parte del plan comercial, no opcionales.
- **Un solo mantenedor**: automatizar todo lo automatizable (tests, Dependabot, deploy) — ya en curso.

## 6. Catálogo de prestaciones del ecosistema (banco de ideas; cada una entra SOLO cuando su versión la abra)

**centrail (pitch):** diagnóstico con incertidumbre y drift ✓ · corrección a referencia libre ✓ · export WAV/FLAC (+MP3 v1.1) · A/B ciego · repetibilidad empírica · transposición por semitonos (mismo motor, gratis) · persistencia de picos / HPSS para material percusivo (v1.x).

**trackjunction (stems + estudio):** separación 4/6 stems automática (**6 stems como default**: guitarra y piano SIEMPRE separados — ahí vive la complejidad armónica) · detección automática de instrumentos presentes (elige modelo, etiqueta, y **previene stems vacíos/fugados**: solo se separa lo que existe — diferenciador directo vs Moises) · separación fina de guitarras por timbre (eléctrica vs acústica: factible; evaluar modelos entrenados en datasets jerárquicos tipo MoisesDB en el benchmark de la etapa) · **separación de batería en componentes** (bombo/caja/toms/hi-hat/platillos — LarsNet/StemGMD, factible) · presets de uso: karaoke (quitar voz) · rock · pop · **electrónica** (kick protagónico → componentes de batería prioritarios, sintes) · sinfónico (por FAMILIAS: cuerdas/vientos/metales — nunca prometer atriles ni voces internas de una sección; para voces de sección ver transcripción multi-voz en pianowagon/chordtrain) · **cine/locución** (diálogo/música/efectos — modelos dedicados existen; ideal radioteatro/podcast) · mezclador de estudio: mute/solo por stem · **cambio de tempo sin alterar pitch, programable** por ratio (×0.8) O por BPM destino (120→90; requiere beat tracking — motor compartido con chordtrain) · loops A-B · refinamiento de pitch por stem + temperado unificado · export por stem. *Regla de oro comunicable: se separa lo que suena distinto (timbre); lo idéntico no. Horizonte no prometible: instancias del mismo instrumento (guitarra 1 vs 2 del mismo tipo).*

**chordtrain (armonía):** acordes con alteraciones completas (301 etiquetas) · beat tracking · tonalidad global · timeline sincronizado con reproducción · numerales romanos, cadencias, bloques armónicos que se repiten/varían (v3.5, premium) · transposición de charts · **chord charts exportables** (PDF/imagen) · **repositorio exhaustivo de posiciones de acordes en guitarra y piano** (voicings navegables, vinculados a los acordes detectados).

**triptheory (pedagogía):** lecciones ancladas a las canciones que el usuario sube ("esta es la cadencia que acabas de escuchar") · biblioteca de progresiones célebres (corpus Beatles/Isophonics como banco) · ejercicios sobre material propio. Nace de chordtrain; no antes.

**pianowagon (tablatura):** audio→MIDI (Basic Pitch) · digitación automática (dataset PIG) · grilla beats×notas con número de dedo · export MIDI/MusicXML · **transcripción multi-voz** (identificar las líneas/voces de una sección — ej. violines en 2 voces — como MIDI/partitura, SIN separar el audio: lo que la separación no puede, la transcripción sí, y para estudiar suele bastar).

**Transversales de ecosistema:** progreso honesto · privacidad client-side · actuar-mínimo-e-informar · i18n 10 idiomas · tier servidor = velocidad · candidato futuro: PWA instalable con uso offline.

**Cluster "one-click" (lo que un DAW hace complejo, aquí en un clic; banco de ideas, cada una entra cuando su herramienta/versión la abra):**
- **Procesamiento por lotes** (carpeta/álbum/discoteca completa: diagnosticar y temperar todo de una vez — killer para el nicho coleccionista que Moises ignora; candidato centrail v1.x).
- **Modo práctica one-click** (trackjunction): loop A-B + velocidad reducida + transpuesto a tu tonalidad, en un botón.
- **Pack de práctica exportable**: un zip con stems + chord chart + versión lenta + metadatos, de una vez.
- **Igualar afinación entre dos canciones** (DJ/mashup/medley: mide ambas, tempera una a la otra).
- **Nivelar volumen a estándar de playlist** (normalización LUFS con un clic, informando el ajuste).
- **Click/metrónomo sincronizado** sobre la canción (nace del beat tracking de chordtrain).
- Trim/fades/quitar silencios de extremos; export de secciones/loops; edición de metadatos FLAC.

**Diferenciación drástica vs Moises (síntesis comercial, julio 2026 — Moises: gratis 5 separaciones/mes con ads; Premium ~$3.99/mes; Pro ~$9.99/mes):**
1. **Gratis ilimitado estructural**: nuestro tier gratis corre en el equipo del usuario ⇒ ilimitado, privado y sin ads a costo cero — Moises no puede copiarlo sin demoler su modelo de costos.
2. **Enseña, no solo procesa**: análisis armónico + pedagogía sobre la música del usuario (ellos: cero).
3. **Precisión verificable**: open source auditable + incertidumbre declarada + validación documentada (README).
4. **El nicho ignorado**: alta resolución de punta a punta (FLAC 24/96) + lotes para coleccionistas.
