# Offline share pack (`.globedesk.html`)

A share pack is one HTML file that plays a story read-only (Play, Pause, Scrub) when opened straight from disk. It needs no server and no internet. Schema `globedesk.share/1`.

## What goes in

- The chosen stories, after the promote rules in `tools/promote_layer.py`: personal fields (owner, address, phone, email, valuation, street, occupant…) and desk links are stripped; each story needs at least one real `https://` source; the pack needs a licence (non-commercial licences are refused) and a PUBLIC / RECORDED / PROJECTED label.
- `scrub_scan` and `name_scan` must both report 0 hits. name_scan fails closed when no patterns file is set (`GLOBEDESK_NAME_PATTERNS` or `GLOBEDESK_DATA/settings/name-scan-patterns.json`).
- Nothing is written until you confirm: the confirm box in the Export dialog (after **Check**, for the unchanged form) or `--yes` on the CLI.
- Inlined: MapLibre GL JS (BSD-3-Clause), the Natural Earth land and country outline (public domain), `share/player.js`, `share/player.css` and the camera math from `js/frame-export.js`. A Credits panel carries every attribution and the MapLibre and GlobeDesk licence texts.
- Source and credit links are https only. `javascript:`, `http:`, `data:` and every other scheme are dropped when the pack is built, and the player renders only https links.
- The page has a strict Content-Security-Policy (`default-src 'none'`, hashed inline scripts and styles, images and workers from `data:` / `blob:` only).

## Map add-ons (optional, local packs only)

| Choice | Source | Licence | Notes |
|---|---|---|---|
| `outline` (default) | bundled Natural Earth | public domain | ≈1.5 MB pack |
| `bluemarble` | local Blue Marble MBTiles, z0–4 | NASA, public domain | needs the local pack |
| `eox-region` | local 2016 EOX Sentinel-2 cloudless region pack | CC BY 4.0, attributed | needs the local pack |

Never: OpenFreeMap tiles, non-commercial (NC / NC-SA) mosaics, API keys, live embeds. The tool refuses a pack whose data mentions a live tile host or a key.

Caps: 20 MiB for an outline pack, 80 MiB with tiles. The episode JSON is capped at 8 MiB.

## Not packed in v1.3

Local media files (photos, video, voice-over audio), the user content layer, and event layers. The report lists what was left out.

## CLI

```
python3 tools/export_share_pack.py --episode my.globedesk.json --label PUBLIC --license "CC BY 4.0" \
  [--tiles outline|bluemarble|eox-region] [--story ID ...] [--patterns names.json] [--out pack.globedesk.html] [--yes]
```

Dry run unless `--yes`. Never overwrites an existing file. Never commits or uploads.

## In the app

Export → Share pack → **Check** → read the report → tick the confirm box → **Build**. The local `serve.py` builds it (`POST /api/share-pack`, loopback only) and the browser downloads it.
