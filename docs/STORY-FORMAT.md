# GlobeDesk story format

Current episode schema: `globedesk.episode/2`.

GlobeDesk still opens `globedesk.episode/1` and the typo-era `gobedesk.episode/1`, then saves as `/2`.

A machine-readable copy of the same keys, types and LIMITS lives in [schema/globedesk-story.schema.json](../schema/globedesk-story.schema.json) (`additionalProperties` is false). The application itself validates with [js/schema.js](../js/schema.js), which is the authoritative check at import and load time.

Claim scores, news-desk section metadata, research notes, record lists, and "Open in…" targets live in sidecar catalogs, not as unknown keys on the episode. Official GIS overlays live in the core GIS registry; a story may name their ids in optional `gisOverlayIds`. Ids should exist in the bundled registry (`data/gis-registry.json`, currently `ohm`); an unknown id is a warning, not a rejected episode, and stays off with `[UNKNOWN]` at runtime. A story may optionally name allowlisted targets in `openIn` (ids only; see [docs/SIDECARS.md](SIDECARS.md)).

## Architecture: base map vs content

- The **base map / globe** is a separate core layer (MapLibre style, satellite and street tiles, optional terrain, bundled offline outlines). User files must not describe changes to that style, its sources, or its tiles.
- **User content** (stories, cards, media placements, sound overlays, event layers, embeds) lives in a content layer / plugin on top. Loading or clearing user content leaves base map state unchanged.

## Episode

```
{
  "schema": "globedesk.episode/2",
  "id": "ep-…",
  "show": "string",
  "title": "string",
  "date": "YYYY-MM-DD",
  "lede": "string",
  "handle": "@handle",
  "sample": false,
  "look": { "theme": "globedesk" },
  "outro": { "enabled": true, "durationSec": 5, "line1": "", "link": "", "handle": "", "showXLogo": true },
  "output": { "aspect": "16:9", "fps": 30 },
  "stories": [ /* Story */ ],
  "eventLayers": [ /* Event Layers; see js/events-model.js */ ],
  "mediaBin": [ { "ref": "media-…", "name": "file.mp4", "kind": "video|audio|image", "size": 0 } ]
}
```

`mediaBin` holds descriptors only. File bytes are not stored in JSON. A `.globedesk` project pack is a zip of `project.json` plus `media/<ref>/<filename>`.

## Story

```
{
  "id": "story-…",
  "title": "string",
  "summary": "string",
  "date": "YYYY-MM-DD or free text",
  "credit": "creator credit (required for other people's work)",
  "creditUrl": "https://… or empty",
  "asReported": true,
  "durationSec": 24,
  "location": {
    "name": "string",
    "lat": 0, "lon": 0,
    "precision": "unset|approximate|…",
    "verified": false,
    "note": "string",
    "look": { "lat": 0, "lon": 0, "name": "", "note": "" }
  },
  "script": "string",
  "captions": [ { "start": 0, "end": 2, "text": "…" } ],
  "cards": [ /* topic cards */ ],
  "sources": [ { "id": "src-…", "label": "", "url": "https://…", "status": "verified|unverified", "note": "" } ],
  "camera": [ /* keyframes: orbit, dive, street, cinematic, close, overview */ ],
  "media": [ { "mediaRef": "media-…", "role": "broll|still|music", "at": 0, "dur": 8, "citation": {}, "caption": "" } ],
  "audioOverlays": [ { "id": "snd-…", "mediaRef": "media-…", "volume": 1, "offset": 0, "loop": false, "at": 0, "dur": null } ],
  "content": [ /* Content element */ ],
  "voiceover": "media-… or null",
  "highlight": { "a3": "UKR", "geojson": null },
  "eventWindow": { "start": "", "end": "" },
  "openIn": [ "sample-civic-desk" ],
  "gisOverlayIds": [ "ohm" ]
}
```

## Content element

`kind` is one of: `card`, `pin-popup`, `overlay`, `geo-panel`, `embed`.

```
{
  "id": "ct-…",
  "kind": "overlay",
  "mediaRef": "media-… or empty",
  "embedUrl": "https://… (allowlisted YouTube or X only)",
  "credit": "required for embeds and for other people's work",
  "title": "string",
  "caption": "caption or transcript",
  "visible": true,
  "at": 0,
  "dur": 8,
  "order": 0,
  "pin": { "lat": 0, "lon": 0 },
  "overlay": { "mode": "pip|full", "x": 6, "y": 18, "width": 32, "height": 28, "opacity": 1 }
}
```

Rules:

- Source and credit URLs must be `https://`.
- Embeds must match the allowlist and include a credit.
- Do not invent facts. Use `[UNKNOWN]` when something is not known.
- Do not include API keys or file bytes in this JSON.

## Project pack

```
{
  "schema": "globedesk.project/1",
  "episode": { /* globedesk.episode/2 */ }
}
```

Stored as `project.json` at the root of a `.globedesk` zip (store method), with media under `media/`.

## Playback, pause, and resume

The playback clock derives visible cards, captions, media and the current camera keyframe from `(episode, t)`. Story-driven mode fires the allowlisted command API for those beats (`flyTo`, `openCard` / `closeCard`).

If the viewer **pauses** and then explores — opens or closes several cards, toggles layers, drops or moves pins, or moves the camera — those edits are temporary. **On Resume**, every viewer edit is cleared and the desk returns to the story state at the paused beat, then continues the original story order from that time. `seek` likewise shows the story state at the requested time, not a mix of old viewer edits.

A two-story sample built on the Washington, DC demo region is `episodes/washington-dc-demo.globedesk.json`. Pins are approximate. Facts are cited from official pages or marked [UNKNOWN].
