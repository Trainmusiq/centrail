# Evidencia de verificación — tres estados de veredicto (v1.3.3, 28 jul 2026)

Texto exacto renderizado en el navegador (Chrome, dev server local sin caché), copiado
del DOM, no transcrito a mano. Criterio de la sesión: **el veredicto de arriba y el panel
de deriva cuentan la misma historia con el mismo tono sobre el mismo archivo.**

> **Nota sobre las imágenes:** las capturas visuales se tomaron y se revisaron durante la
> sesión, pero la herramienta de navegador entrega la imagen a la conversación y **no puede
> escribir el PNG al disco**, así que no hay binarios en esta carpeta. Esta evidencia es
> textual y es la que quedó versionada. Si se quieren los PNG como insumo de diseño, hay
> que capturarlos a mano desde el navegador.

---

## Estado 1 — Alta confianza (`unc ≤ 1.5 ¢`)

**Archivo real:** `7 Cable A Tierra(original 438,75).flac` · 3:26 · FLAC 44.1 kHz/16-bit estéreo

| Métrica | Valor |
|---|---|
| Patrón detectado | 438.75 Hz |
| Desviación | −4.9 ¢ |
| Incertidumbre (±) | **0.1 ¢** → nivel `confident` |
| Consistencia tonal | 10 % |
| Ventanas | 240 (5 excluidas) |
| Deriva máxima | 7.2 ¢ |

**Veredicto:**
> Afinación levemente **baja**: 4.9 cents bajo 440 Hz. Una corrección global lleva el archivo al destino que elijas.

**Bloque de honestidad** (borde cian, neutro):
> La medición usó solo las ventanas con altura definida; 5 quedaron fuera (percusión, silencio o ruido).

**Panel de deriva:**
> Deriva máxima: **7.2 ¢** — la afinación varía levemente a lo largo del tema. Una corrección global deja el promedio en el destino, con los pasajes repartidos en torno a él.

**Coherencia:** ✓ El veredicto afirma la dirección y el resultado de corregir sin prometer
exactitud absoluta; el panel matiza cómo se reparten los pasajes. Ninguno contradice al otro.

---

## Estado 2 — Confianza media (`1.5 < unc ≤ 6 ¢`)

**Archivo real:** `04 - Puente_432Hz(de original).wav` · 4:34 · WAV 44.1 kHz/16-bit estéreo

| Métrica | Valor |
|---|---|
| Patrón detectado | 432.29 Hz |
| Desviación | −30.6 ¢ |
| Incertidumbre (±) | **1.9 ¢** → nivel `medium` |
| Consistencia tonal | 10 % |
| Ventanas | 240 (39 excluidas) |
| Deriva máxima | 6.3 ¢ |

**Veredicto** (los tres tramos: lo que se sabe → la precisión → la consecuencia):
> Afinación claramente **baja**: 30.6 cents bajo 440 Hz en promedio, con 1.9 ¢ de variación entre partes del archivo. Una corrección global centra el promedio en el destino; para el detalle por sección, revisa el panel de deriva.

**Panel de deriva:**
> Deriva máxima: **6.3 ¢** — la afinación varía levemente a lo largo del tema. Una corrección global deja el promedio en el destino, con los pasajes repartidos en torno a él.

**Coherencia:** ✓ Ambos declaran variación, ambos dicen que la corrección global centra el
promedio, ambos remiten al mismo detalle. Mismo tono.

*(Se verificó también `04 - Puente_re440Hz(de 432).wav`, unc = 3.4 ¢, que cae en la rama
"ya afinado" del mismo nivel: "Ya está afinado: el promedio queda en 440 Hz, con 3.4 ¢ de
variación entre partes del archivo. Déjalo así.")*

---

## Estado 3 — Variación alta (`unc > 6 ¢`) ⚠ MATERIAL SINTÉTICO

**⚠ Declarado explícitamente: este NO es material real.** En `test/private` no existe ningún
archivo que cruce el umbral nuevo — el máximo medido sobre los 9 archivos disponibles es
3.36 ¢. El archivo se construyó para verificar que **la interfaz renderiza el estado**, no
para validar el algoritmo.

**Archivo:** `SINTETICO_variacion_alta.wav` · 3:20 · WAV 44.1 kHz/16-bit mono (gitignored)

Construcción: tono armónico con la afinación alternando ±5 ¢ **al ritmo exacto del muestreo
de ventanas**, de modo que las ventanas pares caigan en una afinación y las impares en la
otra. Es aliasing deliberado contra el muestreador: no es un patrón que ocurra naturalmente
en música. Un primer intento con vaivén lento (±14 ¢ en bloques de 1.9 s) dio `unc = 0.10 ¢`
— confirmando que la deriva lenta **no** sube la incertidumbre.

| Métrica | Valor |
|---|---|
| Patrón detectado | 443.04 Hz |
| Desviación | +11.9 ¢ |
| Incertidumbre (±) | **10.0 ¢** → nivel `highVar` |
| Consistencia tonal | 95 % |
| Ventanas | 240 (0 excluidas) |
| Deriva máxima | 0.3 ¢ |

**Veredicto:**
> Afinación claramente **alta**: 11.9 cents sobre 440 Hz en promedio, y la lectura varía 10.0 ¢ según la parte del archivo. Una corrección global centra el promedio, pero no deja todo el archivo exacto; el panel de deriva muestra cómo se reparte.

**Panel de deriva:**
> Deriva máxima: **0.3 ¢** — la afinación es estable a lo largo del tema. Una corrección global basta.

**Coherencia:** ✓ — y este caso es justamente el que obligó a corregir el copy dos veces
(ver §13.6 de la spec). Incertidumbre alta con deriva baja es un caso real y posible:
la afinación varía rápido, ventana a ventana, pero se promedia estable dentro de cada
segmento. Los dos mensajes hablan de cosas distintas sin contradecirse.

---

## Estados no cubiertos

| Combinación | Estado |
|---|---|
| `confident` + rama "ya afinado" | ✗ no verificado en navegador — ningún archivo disponible cae ahí (requiere \|desvío\| < 3 ¢ **y** unc ≤ 1.5 ¢) |
| `highVar` con material **real** | ✗ no existe en `test/private`; sustituido por sintético declarado |
