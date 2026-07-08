# Centrail — Especificación del proyecto

**Ecosistema:** trainmusiq (herramientas independientes para aprender/entrenar música, inspiración ferroviaria aplicada donde calza — ver §5) · **Producto (puerta de entrada):** Centrail — diagnóstico y corrección de afinación de referencia
**Versión:** 1.10 · Julio 2026
**Autor:** Juanma (Punta Arenas) con Claude
**Estado:** v1 publicada en GitHub Pages (https://trainmusiq.github.io/centrail/). Esta es ahora la especificación viva del repo — la mantiene quien ejecute cada sesión de Claude Code. Documento hermano: `docs/roadmap.md` (el CUÁNDO/ORDEN/POR QUÉ comercial; esta spec es el QUÉ técnico).

**Nombre:** "Centrail" une **cent** (la unidad de medida de la herramienta), **rail** (el universo ferroviario de TrainMusiq) y el eco de "central/centrar" (centrar la afinación: la aguja del dial queda centrada en el riel cuando el tema está afinado). El nombre de trabajo anterior era "Patrón 440"; el prototipo `patron440.html` lo conserva hasta que se porte.

---

## 1. Visión

Una aplicación web que diagnostica y corrige la afinación de referencia de grabaciones musicales, y que escala por etapas hacia una herramienta completa de análisis musical (stems, acordes, tablatura de piano con digitación). Filosofía central: **medir con honestidad antes de tocar el audio**. La app muestra el diagnóstico (desviación, incertidumbre, deriva) y recién entonces ofrece corregir — incluyendo decirle al usuario "este archivo ya está bien, no lo toques".

Procesamiento 100% client-side por defecto (el audio nunca sale del equipo del usuario), hosting estático en GitHub Pages, costo operativo $0. Open source.

## 2. Estado actual: qué está validado

El prototipo 1 (`patron440.html`, archivo único HTML/JS) implementa la **detección** y fue validado con contraste cruzado contra 29a.ch/fix-tuning:

| Archivo de prueba | Centrail (prototipo) | 29a.ch | Concordancia |
|---|---|---|---|
| Original FLAC de disco | 440.12 Hz (+0.5 ¢) | +1 ¢ (redondeo a entero) | ✓ |
| Mismo tema "corregido" por Moises | 438.6 Hz (−5.5 ¢) | −5 ¢ | ✓ |

Hallazgo relevante: Moises tomó un archivo prácticamente perfecto y lo dejó ~5 cents bajo. Nuestro diagnóstico detectó el error; esto valida la propuesta de valor ("diagnóstico transparente y superior") y define el flujo de UX.

Resolución del prototipo: décimas de cent (29a.ch redondea a enteros). Prueba pendiente opcional: desafinación controlada conocida en Audacity (ej. −20 ¢ → debe medir ~438.9 Hz).

## 3. Algoritmo de detección (validado — no reinventar)

Parámetros y método exactos del prototipo, que deben conservarse al portar:

- FFT radix-2 de **32.768 puntos** con ventana de **Hann**.
- Hasta **240 ventanas** distribuidas uniformemente a lo largo de todo el tema (muestreo, no barrido completo: análisis en segundos incluso para FLAC largos).
- Rango útil de picos: **55–5000 Hz**. Detección de máximos locales sobre umbral relativo (0.002 × magnitud máxima del frame).
- Refinamiento de frecuencia de cada pico por **interpolación parabólica sobre magnitud logarítmica** (resolución sub-bin).
- Desviación de cada pico respecto a la rejilla temperada A440: cents módulo 100, mapeada a (−50, 50] con **matemática circular** en todo el pipeline (histograma, medias, drift). Esto evita errores cerca del medio semitono y hace el método independiente de la tonalidad del tema.
- Ponderación por energía comprimida: peso = √(magnitud/máximo), para que ningún pico domine.
- Estimación final: peak del histograma de 100 bins (1 ¢/bin) refinado con **media circular local ±15 ¢**.
- Patrón de referencia = 440 × 2^(desviación/1200).
- **Deriva (drift)**: el tema se divide en 10 segmentos, cada uno con su propia media circular. Deriva máxima < 3 ¢ → corrección global basta; 3–10 ¢ → advertir variación leve (típico cinta); > 10 ¢ → recomendar corrección por tramos (feature futura).
- Métricas de honestidad expuestas al usuario: **incertidumbre** (± cents, heurística sobre dispersión circular) y **consistencia tonal** (largo del vector resultante R del histograma completo; R > 0.35 alta, 0.15–0.35 media, < 0.15 baja/no confiable).

**Hallazgos de la validación con archivos reales (julio 2026, sesión Claude Code):**
- **Tubería de decodificación unificada (requisito duro):** medir y corregir SIEMPRE sobre la misma decodificación. `decodeAudioData` del navegador puede resamplear al sample rate del `AudioContext` y desplazó la medición ~0.9 ¢ respecto de la decodificación FLAC nativa del mismo archivo. La app nunca debe medir por un camino y procesar por otro.
- **R bajo ≠ medición mala.** Los archivos de validación tienen R≈8% (zona "no confiable") y aun así la medición coincidió entre herramientas y tuberías independientes dentro de ~1 ¢: R bajo indica histograma disperso (percusión, mezcla densa), no necesariamente centro tonal ambiguo. Mejora para v1 o v1.x: estimar la confianza por **repetibilidad empírica** — medir mitades (o subconjuntos de ventanas) por separado y reportar su diferencia como incertidumbre real — en lugar de depender solo de R. Recalibrar los umbrales de R con más material real.
- **Motor de corrección validado:** shift exacto de +100 ¢ sobre tono sintético reproduce con error de +0.017 ¢ (Rubber Band Finer es transparente en la práctica). Los errores de cents observados en round-trips con material real provienen de la re-medición en material de R bajo, no de la corrección.
- **Percusión inarmónica (mejora identificada, NO entra a v1 — algoritmo congelado):** las percusiones son mayormente inarmónicas (modos de membrana/platillos sin razones enteras); su energía se reparte uniforme por el histograma: diluye el peak (baja R) pero no lo desplaza (la medición sigue siendo repetible). Cortar bandas de frecuencia NO sirve (la percusión es de banda ancha y se solapa con bajo y armónicos). La separación correcta es temporal: (a) **persistencia de picos** — contar solo picos presentes en la misma frecuencia durante 2-3 ventanas consecutivas (cambio barato, candidato v1.x); (b) **HPSS** clásico por filtros de mediana sobre el espectrograma, medir solo la capa armónica (candidato v1.x); (c) **la etapa 2 lo resuelve estructuralmente**: medir sobre stems armónicos excluyendo batería = el "refinamiento por stem" premium ya planificado.

**Hallazgos de prueba manual real, 8 de julio de 2026 (v1.1, antes de recalibrar umbrales — ver §3 punto de repetibilidad empírica):**
- **El vibrato dispersa el histograma igual que la percusión.** Material tonal con vibrato natural (voz, cuerdas frotadas) da R bajo aunque el tema esté perfectamente afinado: el vibrato mueve la frecuencia instantánea de cada nota varios cents de forma continua, y esa variación se sigue promediando en la ventana FFT de ~32.768 muestras — el histograma se ensancha por una razón completamente distinta a la percusión (modulación continua de una fuente armónica limpia, no energía inarmónica de banda ancha), pero el síntoma en R es el mismo. R bajo no distingue estas dos causas.
- **Incluso piano 100% solo da R≈20%.** Las cuerdas de piano tienen inarmonicidad natural (parciales estirados respecto a la serie armónica ideal, por la rigidez de la cuerda) — el `detector` compara cada pico contra la rejilla temperada ideal, así que los parciales superiores de un piano perfectamente afinado ya caen levemente fuera de esa rejilla por diseño físico del instrumento, no por desafinación. Esto pone un **techo real de R en música (no en tonos sintéticos) alrededor de 20-25%**, incluso en el mejor caso posible (una sola fuente armónica limpia, sin percusión ni vibrato).
- **Consecuencia: los umbrales actuales (R > 0.35 alta, 0.15–0.35 media, < 0.15 baja) están descalibrados contra la realidad** — fueron diseñados con la intuición de tonos limpios/sintéticos, no con el techo real de ~20-25% que da música de verdad. Con los umbrales actuales, un piano solo perfectamente afinado (R≈20%) cae en "media", y casi nada real llega a "alta". Recalibrar en v1.1 combinando R con la **repetibilidad empírica** (medir mitades por separado): la referencia de campo es piano solo ≈20% R, piano+voz ≈5-11% R, mezcla percusiva ≈8% R — los umbrales nuevos deben ubicar estos casos reales de forma que el mensaje al usuario sea honesto (un piano solo bien afinado no debería leer como "poco confiable" solo porque R nunca puede acercarse al 35% en música real).

Nota de contexto (investigado julio 2026): para pitch monofónico neural existen PESTO (130k parámetros, tiempo real, TISMIR 2025) y FCPE (2025, ~77× más rápido que CREPE). **No se necesitan para la detección global** (el método espectral estadístico es el correcto para mezclas completas), pero PESTO es el candidato para el refinamiento por stem (etapa 2+, tier de pago).

## 4. Etapa 1 — App completa de pitch (fase Claude Code)

### 4.1 Motor de corrección

- **Rubber Band compilado a WASM** (existe: rubberband-wasm), modo de máxima calidad (motor "Finer"/R3). Pitch shift **sin alterar el BPM/tempo** (requisito duro) — validado: shift exacto de +100 ¢ sobre tono sintético reproduce con error de +0.017 ¢.
- **Frecuencia de referencia de destino configurable**: presets 432 / 440 / 442 / 444 Hz + campo de valor libre. Fórmula: shift = 1200 × log2(destino / detectado).
- Atención a saltos grandes: 440→432 = −31.8 ¢. Verificado en round-trip sintético (§4.4): error dentro de tolerancia incluso en el salto grande, aunque más cerca del límite que en correcciones leves — vigilar con material real de percusión intensa.
- Alternativa de respaldo si Rubber Band WASM da problemas: SoundTouch.js (calidad menor; solo como plan B documentado). No se necesitó: Rubber Band funcionó sin problemas.
- **Seguridad de nivel (implementada v1):** la corrección de pitch puede levantar el pico de la señal (los transientes se redistribuyen). Tras corregir, medir el pico del resultado; si excede 0 dBFS **o** el pico del archivo original, aplicar la reducción de ganancia mínima necesaria para no superar el más bajo de los dos techos, e **informarlo en el resultado en lenguaje humano** ("Se redujo el nivel X dB para evitar recorte" / "...para no superar el nivel del original"). Ver principio general en §4.3.
- **Transposición por semitonos (candidata v1.x, no en el release inicial):** mismo motor (Rubber Band ya soporta pitchScale arbitrario, no solo el shift fino en cents que usa la corrección de referencia), UI simple (selector de semitonos enteros, ej. −12 a +12). Con saltos grandes (varios semitonos) advertir artefactos audibles según la magnitud del salto — el umbral exacto de advertencia se calibra con material real al implementar (percusión y voz son más sensibles que material armónico sostenido).

### 4.2 Archivos grandes y formatos

- Entrada: WAV, FLAC (incluida alta resolución 24-bit/96kHz), MP3, OGG y M4A/AAC — todos con decodificación nativa del navegador. AIFF: **sin soporte nativo en Chrome/Firefox**, requiere decodificador propio; como es PCM simple (pariente de WAV), incluirlo en v1 solo si el costo de implementación resulta trivial; si no, difiere a v1.x documentado.
- Decodificación: `decodeAudioData` del navegador para detección (ya funciona). Para **corrección con exportación en resolución original**, usar decodificación propia (libflac.js / decodificador WAV propio) porque `decodeAudioData` convierte a float32 al sample rate del contexto.
- Procesamiento por **chunks con Web Workers** (no bloquear UI, no reventar RAM con FLACs largos).
- Exportación v1: **mismo formato y resolución de entrada** (FLAC→FLAC con libflac.js encoder, WAV→WAV) + **WAV siempre disponible** + **FLAC siempre disponible** como alternativa para cualquier entrada (delta cero: el encoder libflac.js ya es requisito de FLAC→FLAC). Exportación v1.x: **MP3 con lamejs** (encoder LAME en JS puro; patentes expiradas en 2017, sin fricción GPL) — default 320 kbps con advertencia visible de formato con pérdida — y conversión completa entre formatos/resoluciones (elegir compresión y bit depth de salida); un conversor completo en v1 sería scope creep respecto del propósito de Centrail. Nombre de salida: `{original}_{destino}Hz.{ext}`.

### 4.3 Flujo de UX (el diferenciador)

1. Cargar archivo → diagnóstico automático (lo que ya hace el prototipo: Hz, cents, dial, histograma, drift, incertidumbre, consistencia).
2. Si |desviación| < umbral perceptible (~3 ¢) y drift bajo: mensaje explícito **"este archivo ya está afinado al estándar; corregirlo solo puede degradarlo"**. El botón de corregir queda disponible pero desaconsejado.
3. Si corresponde corregir: elegir destino (presets + libre), previsualización A/B (reproducir original vs. corregido de un segmento), luego procesar y descargar.
4. Consistencia tonal baja → advertir que la medición no es confiable en vez de entregar un número con falsa seguridad.
5. **Progreso honesto (principio de la casa, mismo espíritu que el diagnóstico):** todo procesamiento muestra progreso REAL — barra con porcentaje verdadero (chunks procesados/total), etapa nombrada (Decodificando / Analizando / Corrigiendo / Codificando) y tiempo restante estimado. Nunca spinner indeterminado. Estados con color de la identidad (§8): ámbar = en progreso, cian = listo, rojo = error con mensaje en lenguaje humano (qué pasó y qué hacer), advertencia = avisos de honestidad (archivo ya afinado, medición no confiable). La app nunca oculta su estado real al usuario. ("Esperando conexión" no existe en la etapa 1 — no hay servidor; se incorpora como estado recién con los tiers de la etapa 2+.)
6. **Actuar mínimo e informar, nunca preguntar (principio de UX, transversal al ecosistema):** cuando la app debe tomar una decisión técnica para poder entregar un resultado seguro o correcto (ej. reducir ganancia para evitar recorte, §4.1), la toma sola, aplicando el cambio **mínimo** necesario — nunca interrumpe con un diálogo de confirmación. Lo que sí hace siempre es **informar** la decisión en el resultado, en una frase de lenguaje humano (qué se hizo y por qué), nunca en letra chica ni silenciosamente. Este principio es distinto de la honestidad de medición (§3, punto 4 arriba): la honestidad es sobre lo que la app *mide y no sabe con certeza*; "actuar mínimo e informar" es sobre lo que la app *decide y hace* para proteger el resultado. Ambos comparten el mismo espíritu: nunca ocultar, nunca fingir certeza que no existe.

### 4.4 Definición de "terminado" para v1 (release)

- Detecta y corrige un FLAC 24/96 de 10+ minutos sin colgar el navegador.
- La corrección no altera la duración del archivo (verificable en muestras).
- Round-trip verificable: (a) en el **test sintético** automatizado, error ≤ 0.1 ¢ (validado: 0.017 ¢); (b) en **material real de consistencia media/alta**, corregir y re-medir debe dar el destino ±0.5 ¢; (c) en material de **R bajo**, el criterio no es de precisión sino de honestidad: la app debe declarar la medición como no confiable en vez de reportar falsa precisión.
- Publicada en GitHub Pages con README en español e inglés, licencia GPL v3 (decidida: Rubber Band es GPL y el espíritu "regalo al mundo" es coherente con copyleft).
- **Idiomas**: release con **español (chileno neutro) + inglés**, con arquitectura i18n lista desde el día uno (patrón ya probado en el timer HIIT de 11 idiomas). Primera actualización post-release (v1.1): completar **10 idiomas**, elegidos por las culturas con mayor producción y consumo musical/de audio: español, inglés, portugués (Brasil), francés, alemán, italiano, japonés, coreano, chino simplificado y ruso. Razón del orden: los 8 idiomas restantes no deben pararse entre el código terminado y el primer release (regla anti-dispersión, §9).

## 5. Roadmap por etapas (cada etapa = un release publicable, no un feature pendiente)

**Corrección de arquitectura de marca (6 jul 2026, el fundador):** trainmusiq **no** es "cada herramienta un vagón del tren". Es un **ecosistema de herramientas independientes** para aprender/entrenar música, con inspiración ferroviaria aplicada donde calza naturalmente en cada una — no como estructura obligatoria. La metáfora profunda del tren pertenece a la **armonía funcional**: la progresión de acordes ES el tren — cada acorde un vagón, la concatenación es el viaje (la música como arte temporal que te lleva por paisajes lo que dura la canción). Esa imagen es material central de identidad para la herramienta de acordes (etapa 3), no un molde para nombrar todo el ecosistema. Herramientas del ecosistema (nombres candidatos, cada una su propio repo bajo la org `trainmusiq`, compartiendo el motor de `engine/`):

- **centrail** (publicada) — afinación de referencia: el riel que guía/tempera la canción. Es la **puerta de entrada** al ecosistema.
- **trackjunction** (candidato, etapa 2) — el empalme que divide la canción en vías: stems + estudio (mute/solo, cambio de tempo, loops).
- **chordtrain** (candidato, etapa 3) — entrenar acordes y el tren armónico: detección, análisis funcional, transposición, repositorio de posiciones.
- **triptheory** (candidato, horizonte) — la teoría para el viaje musical: pedagogía anclada a las canciones del usuario.
- **pianowagon** (candidato, etapa 4) — trasponer al piano los acordes del tren: tablatura con digitación.

Detalle completo de la escalera de versiones, monetización y secuencia de sesiones: `docs/roadmap.md`. Regla madre (inmutable): no se abre una etapa sin publicar la anterior; nada entra a una versión en construcción — lo nuevo se anota en el roadmap y espera.

**Etapa 1 — Pitch (gratis, el regalo al mundo).** Detección + corrección client-side. Descrita arriba. **Publicada.** No se abre la etapa 2 hasta agotar el pulido v1.1 (ver roadmap).

**Etapa 2 — Stems (trackjunction).** Integrar motor existente, no reinventar: demucs.cpp (WASM) o demucs-rs (WebGPU, más rápido, marzo 2026) — decisión técnica con benchmark propio al abrir la etapa. Modelo por defecto htdemucs_ft. Tier navegador: gratis y lento (minutos). Tier servidor propio con GPU: segundos (ver §7). Habilita el **refinamiento de pitch por stem** (PESTO sobre voz/instrumento aislado, excluyendo batería — resuelve estructuralmente el hallazgo de R bajo por percusión de §3) como feature premium.

**Etapa 3 — Acordes (chordtrain).** Referencia open source: ChordMini (301 etiquetas: 12 tonalidades × 25 tipos, incluyendo séptimas, suspendidos, disminuidos, con beat tracking). Las alteraciones/extensiones van desde la primera versión funcional (requisito de Juanma), aunque comercialmente puedan segmentarse después (triadas gratis / extensiones premium). **Detección de tonalidad (key) global** entra aquí (vía perfiles de croma sobre los acordes ya detectados) — casi gratis una vez que existe el pipeline de acordes; no se adelanta a etapa 1 porque el método espectral de Centrail es intencionalmente independiente de la tonalidad (§3) y no la necesita para medir afinación.

**Etapa 4 — Piano tab con digitación (pianowagon).** Pipeline: audio → MIDI con Basic Pitch (Spotify, corre en navegador con TensorFlow.js) → algoritmo de digitación (programación dinámica minimizando costo de movimiento de mano; referencia académica: dataset PIG). Visualización: grilla beats (columnas) × notas (filas) con número de dedo por celda — modelo de la planilla Excel del amigo pianista, quien actúa como evaluador experto en la iteración.

**Horizonte (post-etapa 4, investigación).** Análisis musicológico: progresiones, cadencias, numerales romanos con music21 (MIT); corpus anotado de los Beatles (Isophonics, ~180 canciones) como banco de pruebas. Music emotion recognition (modelos Essentia) para la línea "efecto de la música en humanos". **triptheory (pedagógico)**: programa de aprendizaje de teoría musical — no replicar musictheory.net (gratuito e imbatible en lo genérico), sino lo que nadie hace: enseñar teoría a través de la música que el usuario sube, con lecciones ancladas al análisis de chordtrain/pianowagon ("esta es la cadencia que acabas de escuchar en tu canción y así funciona"). Doble sentido de la marca: train = tren y entrenar. Requiere chordtrain publicado. No comprometer fechas.

## 6. Modelo de tiers (hipótesis a validar, no dogma)

Decisión tomada: la corrección de pitch **no** es el feature de pago — 29a.ch ya la ofrece gratis; competir cobrando contra gratis es débil. En cambio:

- **Gratis (client-side, costo marginal $0):** diagnóstico completo + corrección + stems lentos en navegador. Construye reputación y adopción open source.
- **De pago (costo de cómputo real o valor difícil de replicar):** stems en segundos vía servidor GPU; refinamiento de pitch por stem; acordes completos con análisis avanzado; piano tab con digitación. Pueden ser tiers de un servicio o productos separados — decidir con datos de uso reales.
- **Medio de pago**: candidatos Flow.cl (coherente con la decisión ya tomada para la Ruta Radioteatral; ideal para público chileno) y PayPal o similar (necesario para audiencia internacional, que en este producto será mayoritaria). Decisión diferida hasta abrir el primer tier de pago; hoy no bloquea nada.

## 7. Infraestructura de servidor (para tiers rápidos, no bloquea etapa 1)

- Opción A: PC propio con GPU NVIDIA (punto dulce: RTX 3060 12GB usada) corriendo UVR5 CLI dockerizado (existen imágenes con Roformer/SCNet/MDX/Demucs para servidores headless). Acceso remoto gratis vía Tailscale o Cloudflare Tunnel. Costo: hardware una vez + electricidad.
- Opción B: GPU on-demand (RunPod / Vast.ai), centavos de USD por canción, sin hardware.
- Arquitectura: la web estática es la misma; el tier rápido solo cambia el backend de procesamiento.

## 8. Identidad visual

El prototipo estableció una dirección: **instrumento de banco de pruebas** — fondo grafito (#16181d), tinta cálida (#e9e5d9), ámbar de aguja VU (#f2a33c) para lecturas, cian de traza de osciloscopio (#5fd4c4) para datos; tipografías Archivo (UI) + IBM Plex Mono (lecturas); elemento firma: el dial de aguja de desviación en cents. La v1 funcional puede salir con esta identidad.

**Fase Claude Design (posterior al release funcional):** definir la identidad definitiva de TrainMusiq/Centrail tomando como referentes los lenguajes visuales que la audiencia objetivo ya habita — DAWs y plugins de audio contemporáneos, apps masivas de práctica y análisis musical (Moises, Chordify, Yousician) y la estética de la pedagogía musical popular en YouTube — sin perder la diferenciación. Conservar, evolucionar o reemplazar la identidad del prototipo debe ser una decisión consciente, no accidental.

## 9. Riesgos y decisiones abiertas

- **Licencia**: decidida — GPL v3 (Rubber Band es GPL; coherente con "regalo al mundo").
- **Memoria en navegador** con FLAC 24/96 largos: mitigado por chunks + workers; stress test hecho con un FLAC sintético 24-bit/96kHz de 12 minutos generado con el propio encoder — diagnose + correct + export completan sin problemas de memoria (heap del hilo principal con margen amplio; el procesamiento pesado vive aislado en el Worker). `analyze()` fue optimizado para hacer el downmix a mono por ventana en vez de crear un buffer del archivo completo (ahorra ~duplicar el tamaño del audio en RAM en archivos largos). Pendiente: repetir con un archivo real (no sintético) de esa duración/resolución si aparece uno disponible.
- **Drift alto** (>10 ¢): la corrección por tramos queda fuera de v1; v1 solo lo diagnostica y lo dice.
- **Dispersión** (riesgo #1 del proyecto según el propio Juanma): la regla es una sola — **no se abre una etapa sin publicar la anterior**. Aplica también dentro de cada etapa: nada se agrega a la definición de "terminado" (§4.4) una vez iniciada la construcción; lo nuevo va a v1.x.

## 10. Primera sesión de Claude Code (arranque sugerido)

1. Crear repo `centrail` (en la organización GitHub `trainmusiq`) con el prototipo como base + este documento en `/docs/especificacion.md`.
2. Licencia GPL v3 (decidida, §9): agregar LICENSE al primer commit.
3. Integrar rubberband-wasm y lograr el primer round-trip: archivo → detectar → corregir a destino → re-medir → verificar ±0.5 ¢.
4. Recién después: chunks/workers para archivos grandes y exportación FLAC.

## 11. Seguridad

**Principio: la arquitectura client-side es la primera medida de seguridad.** Sin servidor, sin base de datos, sin cuentas y sin datos de usuarios, se eliminan por diseño las categorías principales de riesgo web. El audio nunca sale del equipo del usuario. Lo que queda:

- **Cuenta GitHub (la joya de la corona):** 2FA activado en `regeneracion-hub` (hecho, julio 2026) + **códigos de recuperación guardados offline**. Quien controla la cuenta puede publicar código malicioso a todos los usuarios; es el activo a proteger sobre todos los demás.
- **Cadena de suministro (dependencias npm):** vendorizar con versiones fijadas (práctica ya en uso: rubberband-wasm, @wasm-audio-decoders/flac); mínimo de dependencias; activar **Dependabot alerts** en el repo; no actualizar dependencias sin revisar changelog. Los decodificadores y el motor corren en WASM (sandbox del navegador): un archivo de audio malformado, en el peor caso, cae la pestaña del propio usuario — riesgo aceptable.
- **COOP/COEP — resuelto (verificado en sesión, con evidencia):** ni `rubberband-wasm` ni el decodificador FLAC (`@wasm-audio-decoders/flac`) usan `SharedArrayBuffer` ni hilos — confirmado inspeccionando los imports del módulo WASM (solo syscalls WASI estándar), el build script fuente (sin flags `-pthread`/`USE_PTHREADS`), y empíricamente (`exports.memory.buffer instanceof SharedArrayBuffer` → `false`). No se necesitan headers COOP/COEP ni `coi-serviceworker`. Verificado también específicamente en GitHub Pages: `.mjs` se sirve como `text/javascript`, `.wasm` como `application/wasm` — todo funciona sin configuración adicional. Repetir esta verificación para cualquier dependencia WASM nueva (ej. al elegir el motor de stems en etapa 2).
- **Sin recursos externos en producción:** auto-hostear tipografías (no Google Fonts CDN) y todo asset — mejor privacidad, sin dependencia de terceros, GDPR-friendly para usuarios europeos.
- **Cache-busting de módulos ES (hallazgo de sesión):** el navegador puede quedarse con una versión vieja de un `.mjs`/`.json` cacheada indefinidamente, incluso entre reloads — no solo un problema del dev server local, también relevante en producción para que un release nuevo llegue a usuarios con pestañas ya cacheadas. Sin build step (sitio estático puro), la mitigación es versionar a mano: todo import/fetch interno (`index.html`, `engine/*.mjs`, `workers/*.mjs`) lleva `?v=X.Y.Z` sincronizado con `package.json`. `scripts/bump-cache-version.sh <version>` actualiza todos los archivos a la vez — correrlo en cada release. Límite conocido: el `.wasm` binario de libflacjs se resuelve desde dentro del wrapper vendorizado (sin tocar el archivo de terceros) y no lleva query string; en la práctica no es un problema porque wrapper y binario se vendorizan juntos desde la misma versión upstream.
- **Cuando llegue el servidor (etapa 2+, tier de pago):** ahí comienza la seguridad seria — autenticación, manejo de uploads, procesamiento de pagos, rate limiting. No subestimar; presupuestar tiempo específico al abrir esa etapa.
