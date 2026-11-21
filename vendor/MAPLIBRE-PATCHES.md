# Vendored MapLibre patches

GlobeDesk vendors MapLibre GL JS 5.24.1 (`maplibre-gl.js`, BSD-3-Clause). This file records local patches so they are not lost on a later vendor update.

## 2026-11-21 — per-readback PBO for globe projection error measurement

Chrome / Edge on Windows (ANGLE D3D11) logs:

> performance warning: READ-usage buffer was written, then fenced, but written again before being read back. This discarded the shadow copy that was created to accelerate readback.

The 5.24.1 globe projection error measurer reused one `STREAM_READ` pixel-pack buffer for every asynchronous readback. That reuse is what triggers the warning.

The local patch gives each in-flight measurement its own four-byte PBO, stored on `_readbackQueue` with its fence, and deletes the PBO and `WebGLSync` after a successful readback, on `WAIT_FAILED`, and in `destroy()`. Measurement behavior is otherwise unchanged.

This follows the approach in MapLibre PR [maplibre-gl-js#7943](https://github.com/maplibre/maplibre-gl-js/pull/7943) (opened against the same warning in issue [#7872](https://github.com/maplibre/maplibre-gl-js/issues/7872)). That PR was closed without merge because MapLibre 6 later dropped the runtime measurement in PR [#7916](https://github.com/maplibre/maplibre-gl-js/pull/7916). GlobeDesk stays on 5.24.1, so the PBO-ownership fix is applied here instead of a v6 upgrade.

A Chromium issue ([issuetracker 558254911](https://issuetracker.google.com/issues/558254911)) also describes a false-positive form of the same warning after a `getBufferSubData` change. If a later Chrome build still emits the message after this patch, treat that leftover as a driver/browser warning outside this repo.
