# Centrail — Especificación del proyecto

**Marca paraguas:** TrainMusiq · **Producto (vagón 1):** Centrail — diagnóstico y corrección de afinación de referencia
**Versión:** 1.2 · Julio 2026
**Autor:** Juanma (Punta Arenas) con Claude
**Estado:** Prototipo 1 validado. Este documento es el traspaso a la fase de construcción en Claude Code y el norte anti-dispersión del proyecto completo.

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

Nota de contexto (investigado julio 2026): para pitch monofónico neural existen PESTO (130k parámetros, tiempo real, TISMIR 2025) y FCPE (2025, ~77× más rápido que CREPE). **No se necesitan para la detección global** (el método espectral estadístico es el correcto para mezclas completas), pero PESTO es el candidato para el refinamiento por stem (etapa 2+, tier de pago).

## 4. Etapa 1 — App completa de pitch (fase Claude Code)

### 4.1 Motor de corrección

- **Rubber Band compilado a WASM** (existe: rubberband-wasm), modo de máxima calidad. Pitch shift **sin alterar el BPM/tempo** (requisito duro).
- **Frecuencia de referencia de destino configurable**: presets 432 / 440 / 442 / 444 Hz + campo de valor libre. Fórmula: shift = 1200 × log2(destino / detectado).
- Atención a saltos grandes: 440→432 = −31.8 ¢. Verificar calidad en transientes de percusión con el modo HQ de Rubber Band; documentar artefactos si los hay.
- Alternativa de respaldo si Rubber Band WASM da problemas: SoundTouch.js (calidad menor; solo como plan B documentado).

### 4.2 Archivos grandes y formatos

- Entrada: WAV, FLAC (incluida alta resolución 24-bit/96kHz), MP3, OGG y M4A/AAC — todos con decodificación nativa del navegador. AIFF: **sin soporte nativo en Chrome/Firefox**, requiere decodificador propio; como es PCM simple (pariente de WAV), incluirlo en v1 solo si el costo de implementación resulta trivial; si no, difiere a v1.x documentado.
- Decodificación: `decodeAudioData` del navegador para detección (ya funciona). Para **corrección con exportación en resolución original**, usar decodificación propia (libflac.js / decodificador WAV propio) porque `decodeAudioData` convierte a float32 al sample rate del contexto.
- Procesamiento por **chunks con Web Workers** (no bloquear UI, no reventar RAM con FLACs largos).
- Exportación v1: **mismo formato y resolución de entrada** (FLAC→FLAC con libflac.js encoder, WAV→WAV) + **WAV siempre disponible como alternativa** (costo trivial, cubre la mayoría de los casos de "quiero otro formato"). Conversión completa entre formatos/resoluciones (elegir compresión y bit depth de salida): **v1.x explícita, fuera del release inicial** — un conversor completo es scope creep respecto del propósito de Centrail. Nombre de salida: `{original}_{destino}Hz.{ext}`.

### 4.3 Flujo de UX (el diferenciador)

1. Cargar archivo → diagnóstico automático (lo que ya hace el prototipo: Hz, cents, dial, histograma, drift, incertidumbre, consistencia).
2. Si |desviación| < umbral perceptible (~3 ¢) y drift bajo: mensaje explícito **"este archivo ya está afinado al estándar; corregirlo solo puede degradarlo"**. El botón de corregir queda disponible pero desaconsejado.
3. Si corresponde corregir: elegir destino (presets + libre), previsualización A/B (reproducir original vs. corregido de un segmento), luego procesar y descargar.
4. Consistencia tonal baja → advertir que la medición no es confiable en vez de entregar un número con falsa seguridad.

### 4.4 Definición de "terminado" para v1 (release)

- Detecta y corrige un FLAC 24/96 de 10+ minutos sin colgar el navegador.
- La corrección no altera la duración del archivo (verificable en muestras).
- Round-trip verificable: corregir un archivo desviado y volver a medirlo debe dar el destino ±0.5 ¢.
- Publicada en GitHub Pages con README en español e inglés, licencia GPL v3 (decidida: Rubber Band es GPL y el espíritu "regalo al mundo" es coherente con copyleft).
- **Idiomas**: release con **español (chileno neutro) + inglés**, con arquitectura i18n lista desde el día uno (patrón ya probado en el timer HIIT de 11 idiomas). Primera actualización post-release (v1.1): completar **10 idiomas**, elegidos por las culturas con mayor producción y consumo musical/de audio: español, inglés, portugués (Brasil), francés, alemán, italiano, japonés, coreano, chino simplificado y ruso. Razón del orden: los 8 idiomas restantes no deben pararse entre el código terminado y el primer release (regla anti-dispersión, §9).

## 5. Roadmap por etapas (cada etapa = un release publicable, no un feature pendiente)

**Arquitectura de marca:** TrainMusiq es la marca paraguas; cada etapa es un vagón del tren, con nombre propio dentro de la familia ferroviaria. Vagón 1 = **Centrail** (pitch). Los nombres de los vagones 2–4 se deciden al abrir cada etapa. Referencia visual futura (etapa 3): cada vagón un acorde; secuencias de vagones = bloques armónicos que se repiten o varían (la progresión como tren). Identidad del logotipo TrainMusiq: diagonalidad T alta al inicio → q descendente al final (brief para fase Claude Design).

**Etapa 1 — Pitch (gratis, el regalo al mundo).** Detección + corrección client-side. Descrita arriba. No se abre la etapa 2 hasta publicar esta.

**Etapa 2 — Stems.** Integrar motor existente, no reinventar: demucs.cpp (WASM) o demucs-rs (WebGPU, más rápido, marzo 2026). Modelo por defecto htdemucs_ft. Tier navegador: gratis y lento (minutos). Tier servidor propio con GPU: segundos (ver §7). Habilita el **refinamiento de pitch por stem** (PESTO sobre voz/instrumento aislado) como feature premium.

**Etapa 3 — Acordes.** Referencia open source: ChordMini (301 etiquetas: 12 tonalidades × 25 tipos, incluyendo séptimas, suspendidos, disminuidos, con beat tracking). Las alteraciones/extensiones van desde la primera versión funcional (requisito de Juanma), aunque comercialmente puedan segmentarse después (triadas gratis / extensiones premium).

**Etapa 4 — Piano tab con digitación.** Pipeline: audio → MIDI con Basic Pitch (Spotify, corre en navegador con TensorFlow.js) → algoritmo de digitación (programación dinámica minimizando costo de movimiento de mano; referencia académica: dataset PIG). Visualización: grilla beats (columnas) × notas (filas) con número de dedo por celda — modelo de la planilla Excel del amigo pianista, quien actúa como evaluador experto en la iteración.

**Horizonte (post-etapa 4, investigación).** Análisis musicológico: progresiones, cadencias, numerales romanos con music21 (MIT); corpus anotado de los Beatles (Isophonics, ~180 canciones) como banco de pruebas. Music emotion recognition (modelos Essentia) para la línea "efecto de la música en humanos". **Vagón pedagógico**: programa de aprendizaje de teoría musical — no replicar musictheory.net (gratuito e imbatible en lo genérico), sino lo que nadie hace: enseñar teoría a través de la música que el usuario sube, con lecciones ancladas al análisis de los vagones 3-4 ("esta es la cadencia que acabas de escuchar en tu canción y así funciona"). Doble sentido de la marca: train = tren y entrenar. Requiere vagones 3-4 publicados. No comprometer fechas.

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
- **Memoria en navegador** con FLAC 24/96 largos: mitigado por chunks + workers; probar temprano con el archivo más pesado disponible.
- **Drift alto** (>10 ¢): la corrección por tramos queda fuera de v1; v1 solo lo diagnostica y lo dice.
- **Dispersión** (riesgo #1 del proyecto según el propio Juanma): la regla es una sola — **no se abre una etapa sin publicar la anterior**. Aplica también dentro de cada etapa: nada se agrega a la definición de "terminado" (§4.4) una vez iniciada la construcción; lo nuevo va a v1.x.

## 10. Primera sesión de Claude Code (arranque sugerido)

1. Crear repo `centrail` (en la organización GitHub `trainmusiq`) con el prototipo como base + este documento en `/docs/especificacion.md`.
2. Licencia GPL v3 (decidida, §9): agregar LICENSE al primer commit.
3. Integrar rubberband-wasm y lograr el primer round-trip: archivo → detectar → corregir a destino → re-medir → verificar ±0.5 ¢.
4. Recién después: chunks/workers para archivos grandes y exportación FLAC.
