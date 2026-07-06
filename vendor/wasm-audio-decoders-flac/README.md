# @wasm-audio-decoders/flac (vendored)

Vendored from [wasm-audio-decoders](https://github.com/eshaz/wasm-audio-decoders) (npm `@wasm-audio-decoders/flac` 0.2.10), unmodified, browser build (`dist/flac-decoder.min.js`).

Copyright 2021-2025 Ethan Halsall. License: MIT (as declared in the package's `package.json`; no separate `LICENSE` file ships in the upstream repo, only the standard MIT terms).

Decodificador FLAC/Ogg FLAC en WebAssembly, single-thread (sin `SharedArrayBuffer`, ver §11 de la especificación). Se usa en `index.html` cargándolo como script clásico o vía import de efecto secundario en el worker; expone `globalThis["flac-decoder"].FLACDecoder`.

Usado para la **tubería de decodificación unificada** (§3): mismo decode para medir y para corregir, evitando el resampleo de `decodeAudioData`.
