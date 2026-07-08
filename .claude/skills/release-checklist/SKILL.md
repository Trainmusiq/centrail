---
name: release-checklist
description: Checklist de verificación antes/después de publicar una versión de centrail — corre los tests, bumpea el cache-busting, hace smoke test del deploy en vivo en GitHub Pages, y reporta el checklist de "terminado" (§4.4 de docs/especificacion.md) con ✓/✗/⚠. Usar antes de anunciar cualquier release, y después de cada push a main que toque código (no solo docs).
---

# Checklist de release — centrail

## 1. Tests (obligatorio, debe estar en verde)

```bash
npm test
```//
Corre toda la batería: `test:roundtrip`, `test:stereo`, `test:wav`, `test:flac`, `test:duration`. Si algo falla, **no continuar** — arreglar primero. CI (`.github/workflows/test.yml`) corre lo mismo en cada push; revisar que el badge/Actions esté verde en GitHub antes de considerar el release listo.

## 2. Cache-busting (si se tocó código, no solo docs)

```bash
./scripts/bump-cache-version.sh <version-nueva>
```
Revisar el diff (`git diff`) antes de commitear — debe tocar `index.html`, `engine/*.mjs`, `workers/*.mjs` y `package.json` de forma consistente. Ver hallazgo de sesión en `docs/especificacion.md` §11: sin esto, usuarios con el sitio ya cacheado pueden quedarse con módulos viejos indefinidamente.

## 3. Commit y push

Commits por hito, mensajes descriptivos (ver estilo en `git log`). Push a `main` dispara el deploy de GitHub Pages automáticamente — **no hay paso manual de deploy**.

## 4. Verificar que Pages terminó de construir

```bash
gh api repos/trainmusiq/centrail/pages/builds/latest --jq '.status, .commit'
```
`status` debe ser `"built"` y `commit` debe coincidir con `git rev-parse HEAD`. Si no coincide, esperar (o revisar `gh api repos/trainmusiq/centrail/pages` por errores de build).

## 5. Smoke test del deploy en vivo (no solo local)

Verificar que los archivos clave responden 200 con el MIME type correcto (esto ya detectó un problema real: sin esto no se sabría si `.mjs`/`.wasm` se sirven mal):
```bash
for f in "" "engine/detect.mjs" "workers/engine.worker.mjs" "vendor/rubberband-wasm/rubberband.wasm" "i18n/es.json"; do
  curl -s -o /dev/null -w "%{http_code} %{content_type} $f\n" "https://trainmusiq.github.io/centrail/$f"
done
```
Luego, con el tool de preview del navegador (nunca asumir que "debería funcionar"): navegar a `https://trainmusiq.github.io/centrail/`, cargar un archivo real de prueba (`test/private/*.flac` si existe localmente — nunca commiteado), confirmar diagnóstico, corregir a un preset, descargar, y revisar la consola por errores.

## 6. Checklist de "terminado" — §4.4 de la especificación

Reportar cada punto con ✓ (cumplido y verificado), ✗ (no cumplido), o ⚠ (cumplido parcialmente / con salvedad honesta — más valioso que un ✓ de cortesía):

- [ ] Detecta y corrige un FLAC 24/96 de 10+ minutos sin colgar el navegador
- [ ] La corrección no altera la duración del archivo (`test:duration` + verificación manual)
- [ ] Round-trip (a) sintético automatizado, error ≤ 0.1 ¢
- [ ] Round-trip (b) material real de consistencia media/alta, ±0.5 ¢ — **requiere un archivo real de R alto** (piano solo / jazz / coral); si no hay uno disponible, declarar ⚠ explícitamente, no omitirlo
- [ ] Round-trip (c) material R bajo → honestidad (veredicto no categórico, aviso de baja confianza), no falsa precisión
- [ ] Publicado en GitHub Pages, README ES+EN, licencia GPL v3
- [ ] Idiomas: ES+EN con arquitectura i18n (o los que correspondan a la versión activa)

## 7. Reporte final

Formato corto: qué se hizo (con commits), el checklist de arriba, y qué queda pendiente con su porqué (no solo "queda pendiente" — explicar la razón, ej. "falta material real de R alto, no disponible en esta sesión"). Ver también la sección "Al cerrar cada sesión" de `CLAUDE.md`.
