# lamejs (vendored)

Vendored from [@breezystack/lamejs](https://www.npmjs.com/package/@breezystack/lamejs) v1.2.7 (npm), unmodified. Fork of [zhuker/lamejs](https://github.com/zhuker/lamejs) (pure-JS port of the LAME MP3 encoder) with a modern ESM build and no bundled test fixtures.

- `lamejs.js` — ESM build, exports `Mp3Encoder` (no bundler/build tool required, works directly as a browser `<script type="module">` import). No `import` of third-party packages, no WASM, no threads/`SharedArrayBuffer` (it's pure JavaScript — nothing to check there).

License: LGPL-3.0 (see `LICENSE`), compatible with this project's GPLv3 license.
