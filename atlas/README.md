# GlobeDesk Atlas (v1.4.0-draft, not released)

GlobeDesk's own encyclopedia: 12 categories, an index entry schema, packs with manifests, and the views in the Atlas panel. All entries are our own cited text (CC BY 4.0). Draft only.

    categories.json                       12 categories with subcategories, scope, pack and refresh
    views.json                            A-Z, by place, by year (years, then months and weeks in the current year, This week)
    packs/core/                           index, categories, places, years, sources (each with a class) + manifest
    packs/energy|objects|chemistry|economics/  entries.json + manifest.json
    community/community.json              reviewed contributor cards, community links and pins (empty until review)
    OPEN-ITEMS.md                         open owner questions (all OPEN)
    ../schema/atlas-entry.schema.json, atlas-pack-manifest.schema.json, globedesk-object, globedesk-prices,
      globedesk-contributor-card, globedesk-community, globedesk-personal-layer, globedesk-work-desks
    ../data/atlas/                        object, chemistry and price records referenced by entries
    ../tools/atlas/                       build-object, build-packs, build-js (generated js/atlas/atlas-data.js), validate
    ../desks/work-desks.json              the ten desks

Rebuild and check from the repo root:

    node tools/atlas/build-object.mjs && node tools/atlas/build-packs.mjs && node tools/atlas/build-js.mjs
    node tools/atlas/validate.mjs

Rules: no entry about a living person (`subject_person_living` must be false; officials only by public role inside an event entry). A current event leaves Now after about 90 days and stays in its home category. Every pack is under 50 MB. Sources carry a class: **official** (government, standards body, dataset with a named licence), **reference**, or **experimental** (the owner's own repos and Learning Lab cards: labelled "Experimental (not an official source)", never a record backing a claim). New pack versions are promoted only with the owner's YES.
