---
name: vendorize-wasm
description: Vendorizar una dependencia WASM de terceros para centrail/trainmusiq de forma segura — sin build step, licencia verificada compatible con GPL v3, y sin hilos/SharedArrayBuffer (GitHub Pages no permite configurar COOP/COEP). Usar cada vez que se necesite integrar un motor o decodificador nuevo (ej. al elegir el motor de stems en etapa 2, o un encoder de audio adicional).
---

# Vendorizar una dependencia WASM

Patrón usado con éxito 3 veces en Centrail v1: `rubberband-wasm`, `@wasm-audio-decoders/flac`, `libflacjs`. Sin bundler ni build step — el proyecto es HTML/JS/CSS estático puro.

## 1. Elegir el paquete correcto

Buscar en npm (`npm view <paquete>`) uno que:
- Publique un build **listo para navegador sin bundler**: carpeta `dist/` con archivos `.js` (UMD, ESM, o IIFE — sin `import`/`require` de terceros dentro) + el `.wasm` correspondiente.
- Tenga la licencia declarada (`npm view <paquete> license`).

Para inspeccionar antes de instalar en `node_modules` (evita ensuciar el repo):
```bash
mkdir -p /tmp/vendor-inspect && cd /tmp/vendor-inspect
npm pack <paquete>@<version> --cache /tmp/npm-cache
tar xzf <paquete>-<version>.tgz
ls package/dist/
```

## 2. Verificar la licencia

Debe ser compatible con GPL v3 (el proyecto es GPL v3 porque Rubber Band Library lo es). MIT, BSD, Apache-2.0, GPLv2-o-posterior: todas compatibles. **GPLv2-only (sin "or later")** NO es combinable con GPLv3 — verificar el texto exacto del `LICENSE`/`COPYING` del upstream (buscar la frase "or (at your option) any later version"; si falta, confirmar en el README/sitio oficial del proyecto antes de vendorizar).

## 3. Verificar que NO usa hilos/SharedArrayBuffer (regla dura, §11 de la spec)

GitHub Pages no permite configurar headers COOP/COEP. Si la dependencia usa `SharedArrayBuffer`, hay que decidir entre `coi-serviceworker` (workaround con service worker) o buscar/forzar un build single-thread — evitar esto si es posible, es fricción evitable.

Verificación en 3 pasos (los 3, no basta con uno):

1. **Grep del build JS** por señales de threading:
   ```bash
   grep -o "SharedArrayBuffer\|USE_PTHREADS\|Atomics\.\|pthread_create" package/dist/*.js
   ```
   Sin coincidencias = buena señal, pero no concluyente por sí sola.

2. **Build script fuente** (si está en el paquete, ej. `build.sh`/`Makefile`): buscar flags `-pthread`, `-s USE_PTHREADS=1`, `-s SHARED_MEMORY=1` en la invocación de `emcc`. Su ausencia confirma build single-thread.

3. **Prueba empírica** (la más confiable): instanciar el módulo WASM y comprobar el tipo real del buffer de memoria:
   ```js
   const wasmModule = await WebAssembly.compile(fs.readFileSync("package/dist/foo.wasm"));
   const instance = await WebAssembly.instantiate(wasmModule, { /* imports mínimos necesarios */ });
   console.log(instance.exports.memory.buffer instanceof SharedArrayBuffer); // debe ser false
   ```

## 4. Copiar a `vendor/<nombre-paquete>/`

- Los archivos `dist/` necesarios (JS + wasm), **sin modificar** — así se puede diferenciar contra el upstream si hace falta actualizar.
- El `LICENSE`/`COPYING` del paquete.
- Un `README.md` corto: versión vendorizada, de dónde viene, qué se usa (a veces solo el encoder o solo el decoder de un paquete con ambos), y la nota de licencia (ej. "GPLv2-o-posterior, compatible con GPLv3").

## 5. Cargarlo desde el código

- **Import de efecto secundario** (UMD que setea un global): `import "../vendor/paquete/archivo.js";` luego usar `globalThis.NombreGlobal`.
- **Import dinámico** cuando el archivo necesita configuración previa (ej. `libflacjs` necesita `self.FLAC_SCRIPT_LOCATION` seteado ANTES del import para resolver su `.wasm`):
  ```js
  self.FLAC_SCRIPT_LOCATION = new URL("../vendor/paquete/", import.meta.url).href;
  await import("../vendor/paquete/archivo.js");
  ```
- Todo import/fetch de estos archivos debe llevar el query string de cache-busting (`?v=X.Y.Z`, ver `scripts/bump-cache-version.sh`).

## 6. Verificar que funciona de verdad

No basta con que importe sin error — probar la función real (encode/decode/proceso) con datos de prueba y verificar el resultado numéricamente, igual que se hizo con el round-trip de rubberband-wasm y el encode→decode→re-medir de FLAC (ver skill `audio-validation`).

## Gotchas ya pagados (no repetir la investigación)

- **Node vs navegador**: un wrapper Emscripten puede detectar `process.versions.node` y tomar una rama CommonJS (`require`, `__dirname`, `module.exports`) que no existe en un proyecto ESM (`"type":"module"`). Si necesitas usar la misma dependencia vendorizada en un script de Node (tests, tooling), dale un shim SIN modificar el archivo vendorizado:
  ```js
  import { createRequire } from "node:module";
  globalThis.__dirname = path.resolve("vendor/paquete");
  globalThis.module = { exports: {}, require: createRequire(import.meta.url) };
  const realFetch = globalThis.fetch; delete globalThis.fetch; // Node moderno tiene fetch global y el wrapper lo prefiere mal
  try { await import(path.join(globalThis.__dirname, "archivo.js")); } finally { globalThis.fetch = realFetch; }
  const Lib = globalThis.module.exports;
  ```
  (patrón completo en `test/lib.mjs`, función `loadFlacEncoderNode`).
- **Caché de módulos ES del navegador**: persiste incluso con reload normal, atada al origen. Ver skill `release-checklist` y `docs/especificacion.md` §11.
