# Build your own object

The v1.4.0 Atlas release ships the Atlas **3D workshop** and one **demo sample**: the bag solar kit. You can add your own buildable object or kit layer by copying that sample. You do not need to do a real kit build, fill in prices, or invent numbers. Mark any gap `[UNKNOWN]`.

This is a local draft in your copy of the app. Publishing a pack still needs the owner's YES ([docs/PROMOTE.md](PROMOTE.md)).

## What to copy

| Piece | Sample to copy | Required? |
| --- | --- | --- |
| Object record | [data/atlas/objects/bag-solar-kit.json](../data/atlas/objects/bag-solar-kit.json) | Yes |
| Atlas entry | The `bag-solar-kit` object in [atlas/packs/objects/entries.json](../atlas/packs/objects/entries.json) | Yes |
| 3D model | [js/atlas/models/bag-solar-kit.js](../js/atlas/models/bag-solar-kit.js) and its `<script>` tag in [index.html](../index.html) | Yes, if you want 3D |
| Prices | A row in [data/atlas/prices/](../data/atlas/prices/) (see below) | No. Unknown prices are fine |

Do **not** run `node tools/atlas/build-object.mjs` for your object. That script only regenerates the bag solar kit sample from `tools/atlas/sizing.mjs`.

## Steps

1. **Pick a slug.** Lowercase letters, digits and hyphens, for example `sample-lamp`. Use the same id for the Atlas entry, the object record, the model key and any price rows.

2. **Copy the object record.** Save it as `data/atlas/objects/<id>.json`. Change `id`, `name`, `summary`, `kind`, `parts`, `safety`, `model.generator` and `citations`. Keep `"schema": "globedesk.object/1"` and a `license` that starts with `CC BY 4.0`. Leave prices out of this file; they belong in the region price files.

3. **Copy the Atlas entry** into `atlas/packs/objects/entries.json` (or another category pack if it fits better). Set `"kind": "object"`, `"record": "data/atlas/objects/<id>.json"`, at least one source id, `"subject_person_living": false`, and `"current": false`. Register every source id in [atlas/packs/core/sources.json](../atlas/packs/core/sources.json) with a class (`official`, `reference`, or `experimental`) and, for official sources, a publisher.

4. **Copy the 3D model** to `js/atlas/models/<id>.js`. Keep `layout(parallel)` returning millimetre data the workshop already draws: `{ units: "mm", cells, box, inner }`. `cells` is an array of cylinders `{ d, h, x, y, z }` (they can be any upright cylinders, not only battery cells). `box` is `{ w, h, d }`. Register it as `GD_ATLAS_MODELS["<id>"]` (see the sample). Add a `<script src="js/atlas/models/<id>.js"></script>` in `index.html` next to the bag solar kit script, before `js/atlas/atlas-3d.js`.

5. **Optional prices.** In a region file such as `data/atlas/prices/US.json`, add a row per part with `"object": "<id>"`, `"part": "<part-id>"` and `"status": "unknown"`. Do not invent amounts. A checked price is allowed only when you have a real, dated, https source; that is out of scope for the demo sample.

6. **Rebuild and validate** from the repo root:

   ```bash
   node tools/atlas/build-packs.mjs && node tools/atlas/build-js.mjs
   node tools/atlas/validate.mjs
   node tools/atlas/validate.mjs data/atlas/objects/<id>.json
   ```

   The first `validate.mjs` checks the whole Atlas, including your new entry and object record. The second checks just the object file.

7. **Load it.** Run `python3 tools/serve.py`, open the app, press **Atlas**, select your entry, and switch **Globe | 3D**. You should see the Object, Parts and Sources tabs and, if you added a model, the artistic 3D layout. It is not a build drawing.

## Object record fields (`globedesk.object/1`)

Schema: [schema/globedesk-object.schema.json](../schema/globedesk-object.schema.json). Extra keys are refused. A fact you do not have is the string `[UNKNOWN]`.

**Required on the record**

| Field | What to put |
| --- | --- |
| `schema` | `globedesk.object/1` |
| `id` | Slug, same as the entry and model, `^[a-z0-9][a-z0-9-]{0,79}$` |
| `kind` | `energy-kit`, `tool`, `shelter`, `water` or `other` |
| `name` | Display name |
| `summary` | Short cited description |
| `license` | Must start with `CC BY 4.0` |
| `checked` | Day you last checked the record, `YYYY-MM-DD` |
| `confidence_level` | `high`, `medium` or `low` |
| `options` | At least one size (see below) |
| `parts` | At least one part (see below) |
| `safety` | At least one safety rule (see below) |
| `model` | 3D model pointer (see below) |
| `citations` | At least one cited page (see below) |

**Optional on the record**

| Field | What to put |
| --- | --- |
| `status` | `draft`, `reviewed` or `built-and-tested` |
| `assumptions` | Free object for design assumptions, not source claims |
| `blocks` | Functional groups: `id`, `label`, `to` (other block ids), optional `parts` |
| `chemistry` | Slugs of chemistry entries this object uses |
| `facts` | Key/value table shown on the Object tab |

**Each option** (required keys: `id`, `name`, `config`, `wh`, `air_rule`)

| Field | What to put |
| --- | --- |
| `id` | One letter, `A`–`Z` (the sample uses `S`, `M`, `L`) |
| `name` | Size name |
| `config` | Battery-pack shape `4S1P`, `1S1P`, and so on. The schema still uses this form for every object; a non-battery object can use `1S1P` |
| `wh` | Watt-hours, or `0` if this is not an energy pack |
| `air_rule` | Air-travel note, or `[UNKNOWN]` if it does not apply |
| `outputs` | Optional free object |
| `derived` | Optional free object of calculated figures |

**Each part** (required keys: `id`, `class`, `role`, `spec`, `qty`, `ease`, `citations`)

| Field | What to put |
| --- | --- |
| `id` | Slug |
| `class` | Part class, not a shop SKU |
| `role` | What it does |
| `spec` | Free object of measurable properties; use `[UNKNOWN]` for gaps |
| `qty` | Counts per option id, for example `{ "S": 1 }`. A value may be `[UNKNOWN]` or `0` |
| `ease` | `hardware-store`, `electronics-retail`, `online-common`, `specialist` or `[UNKNOWN]` |
| `citations` | Citation ids from this record (empty list is allowed) |
| `example_items` | Optional example product names |
| `model_node` | Optional name of a node in the 3D layout |
| `notes` | Optional note, max 2000 characters |

**Each safety rule** (required keys: `id`, `topic`, `rule`, `citations`)

`topic` must be one of: `fusing`, `bms`, `thermal`, `transport`, `wiring`, `charging`, `assembly`. Pick the closest topic (for example `wiring` or `assembly` on a non-battery object).

**`model`** (required keys: `kind`, `generator`, `units`)

| Field | What to put |
| --- | --- |
| `kind` | `parametric` or `gltf` |
| `generator` | `js/atlas/models/<id>.js` |
| `units` | `mm` only |
| `gltf` | Optional `data/atlas/models/<id>.glb` when `kind` is `gltf` |
| `note` | Optional |

The shipped workshop draws the parametric layout. A `.glb` path is reserved; there is no bundled glTF loader in this draft.

**Each citation** (required keys: `id`, `title`, `url`, `checked`; optional `note`). `url` must be `https://`.

## Atlas entry fields you need

Schema: [schema/atlas-entry.schema.json](../schema/atlas-entry.schema.json). Required: `id`, `title`, `kind` (`object`), `category_path` (category and subcategory, never `now`), `tier` (`kids`, `everyday`, `student` or `professional`), `summary`, `places`, `dates`, `sources` (at least one unless the entry is a placeholder), `related`, `pack`, `status`, `confidence`, `license` (starts with `CC BY 4.0`), `checked`, `current` (false unless it also has `now_until`), `subject_person_living` (must be `false`). Set `record` to `data/atlas/objects/<id>.json`.

## Price rows (`globedesk.prices/1`)

Schema: [schema/globedesk-prices.schema.json](../schema/globedesk-prices.schema.json). Each region file has `schema`, `region` (ISO 3166-1, optional subdivision), `currency` and `rows`. A row always needs `object`, `part` and `status`. For `"status": "unknown"` that is enough — no price figures. For `"status": "checked"` you also need `item`, `seller`, `url`, `low`, `unit`, `checked` and `method`. Do not invent `low` or `high`.

## Rules that will fail a check

- No entry about a living person. Officials only by public role inside an event entry, not an object.
- No personal data, home paths or secrets in the JSON.
- Owner repos and Learning Lab cards are experimental references only; they cannot back a claim.
- Every pack stays under 50 MB.
- After you edit Atlas JSON, rebuild `atlas-data.js` before you load the app (`build-packs.mjs` then `build-js.mjs`).

See also [atlas/README.md](../atlas/README.md), [CONTRIBUTING.md](../CONTRIBUTING.md) and [USER-GUIDE.md](../USER-GUIDE.md).
