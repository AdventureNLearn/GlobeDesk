# Vendored MapLibre patches

GlobeDesk vendors MapLibre GL JS 5.24.1 (`maplibre-gl.js`, BSD-3-Clause). This file records local patches so they are not lost on a later vendor update.

## 2026-11-21 — per-readback PBO for globe projection error measurement

Chrome / Edge on Windows (ANGLE D3D11) logs:

> performance warning: READ-usage buffer was written, then fenced, but written again before being read back. This discarded the shadow copy that was created to accelerate readback.

The 5.24.1 globe projection error measurer reused one `STREAM_READ` pixel-pack buffer for every asynchronous readback. That reuse is what triggers the warning.

The local patch gives each in-flight measurement its own four-byte PBO, stored on `_readbackQueue` with its fence, and deletes the PBO and `WebGLSync` after a successful readback, on `WAIT_FAILED`, and in `destroy()`. Measurement behavior is otherwise unchanged.

This follows the approach in MapLibre PR [maplibre-gl-js#7943](https://github.com/maplibre/maplibre-gl-js/pull/7943) (opened against the same warning in issue [#7872](https://github.com/maplibre/maplibre-gl-js/issues/7872)). That PR was closed without merge because MapLibre 6 later dropped the runtime measurement in PR [#7916](https://github.com/maplibre/maplibre-gl-js/pull/7916). GlobeDesk stays on 5.24.1, so the PBO-ownership fix is applied here instead of a v6 upgrade.

A Chromium issue ([issuetracker 558254911](https://issuetracker.google.com/issues/558254911)) also describes a false-positive form of the same warning after a `getBufferSubData` change. If a later Chrome build still emits the message after this patch, treat that leftover as a driver/browser warning outside this repo.

## 2026-11-24 — backports of two upstream raster fixes (first-load map errors)

Early users saw uncaught map errors on first open; the main smoke reproduced them as 23 console errors in two groups. Both are MapLibre 5.24.1 bugs that upstream fixed in v6. GlobeDesk stays on 5.24.1, so the fixes are backported here, unchanged in logic.

1. `TypeError: Cannot read properties of undefined (reading 'signal')` in the image request queue (`processQueue`). Upstream issue [maplibre-gl-js#8004](https://github.com/maplibre/maplibre-gl-js/issues/8004), fixed in v6.1.0. `RasterTileSource.loadTile` evaluated `tile.abortController` *after* awaiting `transformRequest`; if the tile was aborted during that await (for example, the style or base map changes while the first tiles load, which GlobeDesk does at boot when an episode sets the base), `abortTile` deleted the controller and `getImage` queued a request with `abortController: undefined`. The queue then crashed when it reached that item. Patch: transform the request first, then create the controller (the order `RasterDEMTileSource` already used). The same reorder is applied to `ImageSource.load`, as in the upstream fix. Diagnosed with the unminified 5.24.1 build: 35 EOX tile requests reached `getImage` without a controller 1.4 s after first load, and the `signal` errors followed 3.5 s later.

2. `TypeError: Cannot read properties of undefined (reading 'bind')` in `drawRaster`. Upstream issue [#7775](https://github.com/maplibre/maplibre-gl-js/issues/7775), PR [#7911](https://github.com/maplibre/maplibre-gl-js/pull/7911) (merged for v6). `setTiles()`/`setUrl()` fire a source data change and `TileManager.reload()` re-marked every in-view tile `expired`, including `errored` tiles that never got a texture; `expired` counts as renderable, so the renderer called `bind` on a missing texture every frame. Patch: errored tiles reload as `loading`. Diagnosed with the unminified build: the failing tile was `sat` z3 in state `expired`, `hasData: true`, no texture. GlobeDesk also stopped calling `setTiles()` when the tile URL has not changed (js/globe.js, js/gis.js), which was the app-side trigger.

`tests/maplibre-patches.unit.mjs` fails if a vendor update drops either patch. Remove both when moving to MapLibre 6.1 or later.
