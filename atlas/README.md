# GlobeDesk Atlas (v1.4.0-draft, not released)

GlobeDesk's own encyclopedia: 12 categories, an index entry schema, packs with manifests, and the views in the Atlas panel. All entries are our own cited text (CC BY 4.0). Draft only.

    categories.json                       12 categories with subcategories, scope, pack and refresh
    views.json                            A-Z, by place, by year (years, then months and weeks in the current year, This week)
    packs/core/                           index, categories, places, years, sources (each with a class) + manifest
    packs/history-places/                 History and places: US history 1776-2026 (41 sourced event entries, draft)
    packs/energy|objects|chemistry|economics/  entries.json + manifest.json
    packs/bells/                          the Bells pack (extra pack of "3D objects and builds"): overview + worldwide bells
    community/community.json              reviewed contributor cards, community links and pins (empty until review)
    OPEN-ITEMS.md                         open owner questions (all OPEN)
    ../schema/atlas-entry.schema.json, atlas-pack-manifest.schema.json, globedesk-object, globedesk-prices,
      globedesk-contributor-card, globedesk-community, globedesk-personal-layer, globedesk-work-desks, globedesk-artifact, globedesk-bell
    ../data/atlas/                        object, chemistry, price and bell (data/atlas/bells/) records referenced by entries
    ../data/atlas/artifacts/              historic object records (globedesk.artifact/1): facts, parts, materials, dated timeline
    ../tools/atlas/                       build-object, build-bells (bells-*.mjs content and sources), build-packs, build-js (generated js/atlas/atlas-data.js), validate
    ../js/atlas/bells-layer.js, models/bell.js  the Bells layer (pins, clusters, era and region filters) and the parametric 3D bell
    ../desks/work-desks.json              the ten desks

Rebuild and check from the repo root:

    node tools/atlas/build-object.mjs && node tools/atlas/build-bells.mjs && node tools/atlas/build-packs.mjs && node tools/atlas/build-js.mjs
    node tools/atlas/validate.mjs

Rules: no entry about a living person (`subject_person_living` must be false; officials only by public role inside an event entry). A current event leaves Now after about 90 days and stays in its home category. Every pack is under 50 MB. Sources carry a class: **official** (government, standards body, dataset with a named licence), **reference**, or **experimental** (the owner's own repos and Learning Lab cards: labelled "Experimental (not an official source)", never a record backing a claim). New pack versions are promoted only with the owner's YES.

Reading levels: an entry may carry `tiers` (kids, everyday, student, professional). The summary is the text at `tier`; the reading-level switch shows the chosen level, or "not written yet [UNKNOWN]".

Links by id: `see_also_ids` points at entries that may live in another pack or branch (for example the Bells layer). They show as links when present and as "not in this copy" otherwise; they are never duplicated.

History rule: every History entry needs at least one official source (validator). No living person is a subject; recent decades use events, laws and places. Picking an entry with a pin flies to the pin (zoom by precision).

Bells: every bell cites at least one source with publisher and licence (official or primary where one exists; otherwise confidence is low). Wikipedia is only a secondary pointer and never the only source. Approximate pins say so. The Bells pack owns all bell entries; other packs link to them by id (`see_also_ids`).
