# Centrail

**trainmusiq** — diagnóstico y corrección de afinación de referencia (A440 y cualquier destino).

**App en vivo:** https://trainmusiq.github.io/centrail/

Centrail mide con honestidad antes de tocar el audio: muestra la desviación, la incertidumbre y la consistencia de la medición, y recién entonces ofrece corregir — incluyendo decirte "este archivo ya está bien, no lo toques" cuando corresponde.

## Por qué existe

La mayoría de las herramientas de corrección de pitch corrigen sin decirte qué tan confiable es la medición. En nuestra validación, encontramos un caso real: un archivo que ya estaba prácticamente afinado (440.12 Hz) fue "corregido" por otra herramienta (Moises) y quedó 5.5 cents desafinado. Centrail detectó el error:

| Archivo de prueba | Centrail | 29a.ch/fix-tuning | Concordancia |
|---|---|---|---|
| Original de disco | 440.12 Hz (+0.5 ¢) | +1 ¢ (redondea a enteros) | ✓ |
| Mismo tema "corregido" por Moises | 438.6 Hz (−5.5 ¢) | −5 ¢ | ✓ |

Resolución de Centrail: décimas de cent. La medición coincide con una herramienta de referencia independiente (29a.ch), y detectó exactamente el error que otra herramienta de pago introdujo.

## Privacidad primero

**Tu audio nunca sale de tu equipo.** Todo el procesamiento —decodificar, medir, corregir, exportar— corre en tu navegador. No hay servidor, no hay cuenta, no hay subida de archivos. Es la primera medida de seguridad del proyecto: sin backend no hay superficie de ataque sobre tus datos.

## Qué hace

1. Cargas un archivo (WAV, FLAC, MP3, OGG, M4A) → diagnóstico automático: Hz detectado, desviación en cents, incertidumbre, consistencia tonal, deriva a lo largo del tema.
2. Si ya está afinado, te lo dice — y desaconseja corregir.
3. Eliges destino (432/440/442/444 Hz o un valor libre) y corriges sin alterar el tempo (motor [Rubber Band](https://breakfastquay.com/rubberband/), modo de máxima calidad).
4. Descargas el resultado en WAV y FLAC (mismo formato/resolución cuando la entrada ya es una de las dos).

Disponible en español e inglés (arquitectura lista para 10 idiomas).

## Motor y arquitectura

- `engine/` — detección (FFT + estadística circular), corrección (Rubber Band WASM), decodificación propia de WAV/FLAC (evita el resampleo de `decodeAudioData`), encoders WAV/FLAC.
- `workers/` — el procesamiento pesado corre en un Web Worker, nunca bloquea la interfaz.
- `vendor/` — dependencias WASM vendorizadas (rubberband-wasm, decoder/encoder FLAC), todas single-thread — no se necesitan headers COOP/COEP, compatible con GitHub Pages tal cual.
- Sin build step: HTML/JS/CSS estático, cero dependencias en producción.

Especificación técnica completa: [`docs/especificacion.md`](docs/especificacion.md). Prototipo original de detección (conservado por historia): [`patron440.html`](patron440.html).

## Licencia

[GNU GPL v3](LICENSE). Rubber Band Library es GPLv2-o-posterior, compatible con GPLv3 — coherente con el espíritu open source del proyecto ("el regalo al mundo" de trainmusiq).

---

# Centrail (English)

**trainmusiq** — reference pitch diagnosis and correction (A440 and any target frequency).

**Live app:** https://trainmusiq.github.io/centrail/

Centrail measures honestly before touching your audio: it shows the deviation, the uncertainty, and how reliable the measurement is — and only then offers to correct it, including telling you "this file is already fine, leave it alone" when that's the truth.

## Why it exists

Most pitch-correction tools correct without telling you how trustworthy the measurement is. In our validation we found a real case: a file that was already essentially in tune (440.12 Hz) got "corrected" by another tool (Moises) and ended up 5.5 cents flat. Centrail caught it:

| Test file | Centrail | 29a.ch/fix-tuning | Agreement |
|---|---|---|---|
| Original from disc | 440.12 Hz (+0.5 ¢) | +1 ¢ (rounds to whole cents) | ✓ |
| Same track "corrected" by Moises | 438.6 Hz (−5.5 ¢) | −5 ¢ | ✓ |

Centrail's resolution: tenths of a cent. The measurement matches an independent reference tool (29a.ch), and it caught exactly the error another paid tool introduced.

## Privacy first

**Your audio never leaves your device.** All processing — decoding, measuring, correcting, exporting — runs in your browser. No server, no account, no file upload. This is the project's first line of security: no backend means no attack surface over your data.

## What it does

1. Load a file (WAV, FLAC, MP3, OGG, M4A) → automatic diagnosis: detected Hz, deviation in cents, uncertainty, tonal consistency, drift across the track.
2. If it's already in tune, it tells you — and advises against correcting.
3. Pick a target (432/440/442/444 Hz or a free value) and correct without touching tempo (powered by [Rubber Band](https://breakfastquay.com/rubberband/), highest-quality mode).
4. Download the result as WAV and FLAC (same format/resolution when the input already is one of the two).

Available in Spanish and English (architecture ready for 10 languages).

## Engine and architecture

- `engine/` — detection (FFT + circular statistics), correction (Rubber Band WASM), native WAV/FLAC decoding (avoids the resampling `decodeAudioData` can introduce), WAV/FLAC encoders.
- `workers/` — heavy processing runs in a Web Worker, never blocks the UI.
- `vendor/` — vendored WASM dependencies (rubberband-wasm, FLAC decoder/encoder), all single-thread — no COOP/COEP headers needed, works on GitHub Pages as-is.
- No build step: static HTML/JS/CSS, zero production dependencies.

Full technical spec (Spanish): [`docs/especificacion.md`](docs/especificacion.md). Original detection prototype (kept for history): [`patron440.html`](patron440.html).

## License

[GNU GPL v3](LICENSE). The Rubber Band Library is GPLv2-or-later, compatible with GPLv3 — consistent with the project's open source spirit (trainmusiq's "gift to the world").
