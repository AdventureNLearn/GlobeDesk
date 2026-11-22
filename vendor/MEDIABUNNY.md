# Mediabunny (vendored, unmodified)

- Package: `mediabunny` 1.66.2 on npm, <https://www.npmjs.com/package/mediabunny>
- Source: <https://github.com/Vanilagy/mediabunny>
- Licence: MPL-2.0 (`vendor/LICENSE-mediabunny.txt`, identical to the package `LICENSE`). The MPL header at the top of the bundle is kept.
- File: `vendor/mediabunny-1.66.2.min.js` is a byte-for-byte copy of `dist/bundles/mediabunny.min.cjs` from the npm tarball.
  sha256 `8a0e529432f11a94be04a737005eac7581c4b6687783e0b5fe7cb8c8fd510692`
- Modifications: none. If it is ever patched, the patched file and its source must be published under MPL-2.0 and listed here.
- Use: `js/frame-export.js` muxes the browser's WebCodecs H.264 / AAC (or VP9 / Opus) output into MP4 or WebM. It does no network access.
- Check: `npm pack mediabunny@1.66.2 && tar xzf mediabunny-1.66.2.tgz && sha256sum package/dist/bundles/mediabunny.min.cjs`
