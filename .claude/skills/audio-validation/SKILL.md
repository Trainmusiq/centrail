---
name: audio-validation
description: Cómo correr y leer los round-trips de afinación de centrail, qué umbrales usar, cómo interpretar R (consistencia tonal) y cuándo confiar en material real de R alto vs bajo, y el protocolo para diagnosticar si un error viene del motor de corrección o de la re-medición. Usar antes de declarar una corrección/detección "validada", o al investigar un resultado numérico que parece raro.
---

# Validación de audio en centrail

## 1. Suite automatizada (material sintético, corre en CI)

```bash
npm test
```

| Test | Qué verifica | Umbral |
|---|---|---|
| `test:roundtrip` | detectar → corregir → re-medir, tono sintético limpio, incluye el salto grande 440→432 | ≤ 0.1 ¢ en shift de referencia (validado: 0.017 ¢); salto grande puede acercarse más al límite — no es señal de alarma por sí sola |
| `test:stereo` | rama estéreo/multicanal de `analyze()` — mono vs estéreo idéntico, estéreo asimétrico, 3 canales | ≤ 0.1 ¢ de diferencia vs. la medición mono equivalente |
| `test:wav` | encode/decode WAV en 16/24/32-bit | duración exacta + error de cuantización ≈ 1/2^(bits-1) |
| `test:flac` | encode/decode FLAC en 16/24-bit + re-medición | duración exacta + 0 ¢ de drift entre medición pre/post-FLAC (**no comparar contra el fundamental teórico** si el tono de prueba tiene armónicos — ver nota abajo) |
| `test:duration` | `pitchShiftOffline` en varios pitchScale, mono y estéreo | duración exacta (garantizado por construcción, `timeRatio=1`) |

**Nota importante:** si generas un tono de prueba con fundamental + armónicos (patrón usado en `test/roundtrip.mjs` y `test/flac-roundtrip.mjs`: `0.6·sin(f) + 0.25·sin(2f) + 0.1·sin(3f)`), el detector pondera **todos** los picos espectrales — la medición resultante NO es exactamente la frecuencia fundamental (para 438.6 Hz mide ~438.70 Hz). Esto es comportamiento correcto y esperado del algoritmo (§3 de la spec, independiente de la tonalidad), no un bug. Al escribir un test nuevo con esta construcción, compara **antes vs. después** de la operación que estás probando, nunca contra el fundamental teórico.

## 2. Material real: el protocolo

Los scripts `test/analyze-file.mjs <archivo>` y `test/correct-file.mjs <archivo> --target=<Hz>|--shift-cents=<N> --out=<salida>` operan sobre archivos reales — **nunca** en `test/private/` se commitea (tiene audio con copyright, está en `.gitignore`).

### Leer R (consistencia tonal)
- **R > 35%**: alta confianza.
- **R 15–35%**: media.
- **R < 15%**: baja — **pero esto NO significa que la medición esté mal.** Hallazgo validado en sesión: archivos reales con R≈8% coincidieron con herramientas y tuberías independientes dentro de ~1 ¢. R bajo suele indicar histograma disperso (mucha percusión, mezcla densa), no un centro tonal ambiguo. La app debe declarar la baja confianza (honestidad), no negarse a medir.
- Para validar el criterio §4.4(b) ("material real de consistencia media/alta, ±0.5 ¢") hace falta un archivo con R alto de verdad — candidatos: piano solo, jazz, coral (nada de batería/percusión dominante). Si no hay uno disponible, decláralo como ⚠ explícito, no lo omitas ni lo des por hecho con un archivo de R bajo.

### Diagnosticar: ¿el error viene de la corrección o de la re-medición?

Si un round-trip real da un error de cents mayor al esperado, no asumas que el motor de corrección falló. Aísla la causa:

1. Corre `test/correct-file.mjs <archivo> --shift-cents=<N> --out=<salida>` con un **shift exacto conocido, independiente de cualquier medición** (ej. `--shift-cents=100`, un semitono limpio). El script reporta el offset predicho (antes + shift aplicado, circular) vs. el medido — la diferencia aísla el error real.
2. Repite el mismo shift exacto sobre un tono sintético limpio (`R≈1.0`). Si el error ahí es de centésimas de cent pero en el material real es de varios cents, el motor de corrección está bien — el error viene de la re-medición en material de baja consistencia (R bajo), que es honesto reportar, no un bug que arreglar.
3. Esto ya se hizo una vez con evidencia real: shift de +100 ¢ dio +0.017 ¢ de error en tono sintético vs. varios ¢ en material real de R≈8% — confirmó que Rubber Band es transparente y el "error" real es ruido de medición esperable en ese material.

## 3. Stress test de tamaño/memoria (no es parte de `npm test`, correr manualmente si se toca el pipeline de decode/analyze/correct)

Generar un FLAC sintético grande (ej. 24-bit/96kHz/12min) con `engine/flac-encode.mjs` y pasarlo por el flujo completo en el navegador (worker), no en Node — el motor de memoria del worker es lo que importa. Ver `docs/especificacion.md` §9 para la metodología y los hallazgos ya documentados (incluyendo que `performance.memory` no existe en Workers en el entorno de pruebas usado, y que gran parte de la "memoria" reportada en el hilo principal durante estas pruebas era basura de la generación del archivo de prueba, no uso real de la app).
