# GlobeDesk Atlas (v1.5.1 Atlas)

GlobeDesk's own encyclopedia: 12 categories, an index entry schema, packs with manifests, and the views in the Atlas panel. All entries are our own cited text (CC BY 4.0). Draft only.

    categories.json                       12 categories with subcategories, scope, pack and refresh
    views.json                            A-Z, by place, by year (years, then months and weeks in the current year, This week)
    packs/core/                           index, categories, places, years, sources (each with a class) + manifest
    packs/history-places/                 History and places: US history 1775-2026 (76 sourced event entries in date order, draft)
    packs/energy|objects|chemistry|economics/  entries.json + manifest.json
    packs/bells/                          the Bells pack (extra pack of "3D objects and builds"): overview + worldwide bells
    packs/ancient-world/                  the Ancient World pack (extra pack of "History and places"): overview, 13 sites, 3 myths
    community/community.json              reviewed contributor cards, community links and pins (empty until review)
    OPEN-ITEMS.md                         open owner questions (resolved items are marked in the table)
    ../schema/atlas-entry.schema.json, atlas-pack-manifest.schema.json, globedesk-object, globedesk-prices,
      globedesk-contributor-card, globedesk-community, globedesk-personal-layer, globedesk-work-desks, globedesk-artifact, globedesk-bell, globedesk-ancient
    ../data/atlas/                        object, chemistry, price and bell (data/atlas/bells/) records referenced by entries
    ../data/atlas/artifacts/              historic object records (globedesk.artifact/1): facts, parts, materials, dated timeline
    ../tools/atlas/                       build-object, build-bells (bells-*.mjs content and sources), build-disasters (disasters-*.mjs: NOAA NCEI + USGS subset, earth/natural-hazards), build-space (space-*.mjs: NASA NSSDCA, IAU Gazetteer and agency pages, science-history/space-race), build-elements (118 chemistry/elements entries from an external source cache), build-ancient (ancient-*.mjs content and sources), build-packs, build-js (generated js/atlas/atlas-data.js), validate
    ../js/atlas/atlas-model.js, atlas-view.js   Atlas browse views (including Elements 18-column constellation and table fallback)
    ../js/atlas/bells-layer.js, models/bell.js  the Bells layer (pins, clusters, era and region filters) and the parametric 3D bell
    ../js/atlas/disasters-layer.js, disasters-card.js  the disasters layer (NCEI eruption and earthquake pins, hazard filter; reuses the Bells clusters; off by default) and its Atlas card with cited stories
    ../desks/work-desks.json              the eleven desks (11: Ancient World, on the deep-time clock)
    ../js/atlas/ancient-layer.js          the Ancient World layer (approximate pins of the 13 sites; myths listed, never pinned); off by default
    ../js/atlas/ancient-extents-data.js   optional polity outlines (Cliopatria subset, CC BY 4.0), loaded only when switched on; index in ../data/atlas/ancient/extents-index.json
    ../js/atlas/clocks.js                 timeline clocks: America 250 (1775-2026, history-places) and deep time (10000 BCE-2026, ancient-world); shared by app and validator

Rebuild and check from the repo root:

    node tools/atlas/build-object.mjs && node tools/atlas/build-bells.mjs && node tools/atlas/build-disasters.mjs && node tools/atlas/build-space.mjs && node tools/atlas/build-ancient.mjs && node tools/atlas/build-packs.mjs && node tools/atlas/build-js.mjs
    node tools/atlas/validate.mjs

`build-elements.mjs` rebuilds the 118 element entries in the chemistry pack from NIST, IUPAC and Wikidata snapshots kept in `.cache/sources` at the repo root (gitignored), or `GLOBEDESK_ELEMENTS_CACHE`. It merges `lithium-element` and `copper-element` and does not fetch the network. Run it only when refreshing those derived records; the usual pack rebuild below does not need the cache.

`build-object.mjs` only regenerates the bag solar kit sample; skip it when you are adding a different object. To check one object record on its own: `node tools/atlas/validate.mjs data/atlas/objects/<id>.json`. To add your own buildable 3D object or kit layer, copy the bag solar kit sample and follow [docs/BUILD-YOUR-OWN-OBJECT.md](../docs/BUILD-YOUR-OWN-OBJECT.md).

Rules: no entry about a living person (`subject_person_living` must be false; officials only by public role inside an event entry). A current event leaves Now after about 90 days and stays in its home category. Every pack is under 50 MB. Sources carry a class: **official** (government, standards body, dataset with a named licence), **reference**, or **experimental** (the owner's own repos and Learning Lab cards: labelled "Experimental (not an official source)", never a record backing a claim). Each source also has a `license` field: the licence or reuse terms as stated on the source, or `[UNKNOWN]` when that is not confirmed. Never guess a licence. The record format is in [docs/SOURCES.md](../docs/SOURCES.md). New pack versions are promoted only with the owner's YES.

Reading levels: an entry may carry `tiers` (kids, everyday, student, professional). The summary is the text at `tier`; the reading-level switch shows the chosen level, or "not written yet [UNKNOWN]".

Links by id: `see_also_ids` points at entries that may live in another pack or branch (for example the Bells layer). They show as links when present and as "not in this copy" otherwise; they are never duplicated.

History rule: every History entry needs at least one official source (validator). The timeline starts at 1775. No living person is a subject; recent decades use events, laws and places. Picking an entry with a pin flies to the pin (zoom by precision). **Hard history:** include hard history; never leave it out. Do not drop, soften or skip a difficult event to make the timeline more comfortable.

Bells: every bell cites at least one source with publisher and licence (official or primary where one exists; otherwise confidence is low). Wikipedia is only a secondary pointer and never the only source. Approximate pins say so. The Bells pack owns all bell entries; other packs link to them by id (`see_also_ids`).

Ancient World: sites are in the `ancient-world` pack, so the History pack's 1775 start does not apply; dates are astronomical years (1 BCE = 0) and keep the source's era wording. Every site has at least one official source (a UNESCO World Heritage page) and one approximate pin. Twelve site pins are official UNESCO World Heritage Centre points, cited from each property's maps table (a named component point where the property is serial or mixed). Pompeii keeps its Pleiades representative point (CC BY 3.0). The owner approved all 12 previously held pins on 2026-11-27. A future held pin still ships no coordinates until a site-by-site YES. Myths carry no pin, a "Myth: " title, a supported claim for where the story comes from and a not-proven claim that it is a real place; people-disagree needs two sourced groups. Palmyra is marked sensitive: dated losses and its Danger listing come from UNESCO and UNITAR-UNOSAT, linked out.

Clocks: a pack or desk can run on its own year window, listed once in `js/atlas/clocks.js`. The validator checks every dated entry in a clocked pack against its clock (America 250 for history-places is unchanged), and the Atlas year view switches to the clock when a desk opens it. A later topic adds one clock row naming its packs and desks.

Polity outlines: `tools/atlas/build-ancient-extents.py <cliopatria.geojson>` rebuilds the outline file from a local Cliopatria copy (needs shapely; not part of the usual rebuild). The validator checks the approved attribution word for word, the CC BY 4.0 licence link, the change note, the approximate flag, the file hash and a 2 MiB budget. historical-basemaps (GPL-3.0) and CShapes (CC BY-NC-SA) are not bundled; link out only.
