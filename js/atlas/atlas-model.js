/* Atlas browsing model: pure functions over the generated bundle (GD.atlasData).
   A-Z, by place, by year (years, then months and ISO weeks in the current year, This week), reading tiers,
   the category tree and Now timing. No network. window.GD.atlasModel */
(function (root) {
  "use strict";
  const TIERS = ["kids", "everyday", "student", "professional"];
  const TIER_LABEL = { kids: "Kids", everyday: "Everyday", student: "Student", professional: "Professional" };
  const UNKNOWN = "[UNKNOWN]";

  const fold = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const sortTitle = (t) => fold(String(t).replace(/^\[PLACEHOLDER\]\s*/, ""));

  function entryById(data, id) { return (data.entries || []).find((e) => e.id === id) || null; }
  function category(data, id) { return (data.categories || []).find((c) => c.id === id) || null; }

  function matches(e, f) {
    f = f || {};
    if (f.category && e.category_path[0] !== f.category && !(e.see_also_paths || []).some((p) => p[0] === f.category) && !(f.category === "now" && e.current)) return false;
    if (f.tier && f.tier !== "all" && e.tier !== f.tier && !(e.tiers && e.tiers[f.tier])) return false;
    if (f.kind && e.kind !== f.kind) return false;
    if (f.status && e.status !== f.status) return false;
    if (f.pack && e.pack !== f.pack) return false;
    const words = fold(f.q).split(/\s+/).filter(Boolean);
    if (words.length) {
      const hay = fold([e.title, (e.aliases || []).join(" "), e.summary, e.id, e.category_path.join(" ")].join(" "));
      if (!words.every((w) => hay.indexOf(w) >= 0)) return false;
    }
    return true;
  }

  // A-Z rows: every title and alias, with a jump letter. Aliases point at their entry.
  function azRows(data, f) {
    const rows = [];
    (data.entries || []).filter((e) => matches(e, f)).forEach((e) => {
      rows.push({ id: e.id, label: e.title, alias: false, entry: e });
      (e.aliases || []).forEach((a) => rows.push({ id: e.id, label: a, alias: true, entry: e }));
    });
    rows.forEach((r) => { const c = sortTitle(r.label).charAt(0).toUpperCase(); r.letter = /[A-Z]/.test(c) ? c : "#"; });
    return rows.sort((a, b) => sortTitle(a.label).localeCompare(sortTitle(b.label), "en"));
  }
  function letters(rows) { return Array.from(new Set(rows.map((r) => r.letter))); }

  // By place: coarse keys only. Subdivisions roll up to their country for the globe; no invented points.
  function byPlace(data, f) {
    const keep = new Set((data.entries || []).filter((e) => matches(e, f)).map((e) => e.id));
    const out = {};
    ((data.places && data.places.places) || []).forEach((p) => {
      const ids = p.entries.filter((id) => keep.has(id));
      if (!ids.length) return;
      const country = p.parent || p.key;
      const row = (out[country] = out[country] || { key: country, a3: p.parent ? null : p.a3, entries: [], subdivisions: [] });
      if (p.parent) row.subdivisions.push({ key: p.key, precision: p.precision, entries: ids });
      ids.forEach((id) => { if (row.entries.indexOf(id) < 0) row.entries.push(id); });
    });
    const rows = Object.values(out).map((r) => {
      if (!r.a3) { const own = ((data.places && data.places.places) || []).find((p) => p.key === r.key); r.a3 = own ? own.a3 : UNKNOWN; }
      const groups = {};
      r.entries.forEach((id) => { const e = entryById(data, id); const c = e ? e.category_path[0] : UNKNOWN; (groups[c] = groups[c] || []).push(id); });
      return Object.assign(r, { count: r.entries.length, groups });
    }).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
    const noPlace = ((data.places && data.places.no_place) || []).filter((id) => keep.has(id));
    return { rows, noPlace };
  }

  // ---- dates ----
  function parseDay(s) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s)); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN; }
  function isoDay(t) { return new Date(t).toISOString().slice(0, 10); }
  // ISO 8601 week (Monday start). Returns { year, week, start, end } for a YYYY-MM-DD day.
  function isoWeek(day) {
    const t = parseDay(day);
    const d = new Date(t);
    const dow = (d.getUTCDay() + 6) % 7; // Mon=0
    const thursday = t + (3 - dow) * 86400000;
    const y = new Date(thursday).getUTCFullYear();
    const jan4 = Date.UTC(y, 0, 4);
    const jan4dow = (new Date(jan4).getUTCDay() + 6) % 7;
    const week1 = jan4 - jan4dow * 86400000;
    const week = 1 + Math.floor((t - dow * 86400000 - week1) / (7 * 86400000));
    const start = t - dow * 86400000;
    return { year: y, week, start: isoDay(start), end: isoDay(start + 6 * 86400000) };
  }
  function yearOf(date) { return parseInt(String(date), 10); }
  function yearLabel(y) { return y <= 0 ? (1 - y) + " BCE" : String(y); }

  // Timeline rows. zoom: "years" (all dated), "months" or "weeks" (current year only), "this-week".
  function byYear(data, f, opts) {
    opts = opts || {};
    const today = opts.today || isoDay(Date.now());
    const cy = yearOf(today);
    const keep = new Set((data.entries || []).filter((e) => matches(e, f)).map((e) => e.id));
    const all = ((data.years && data.years.dates) || []).filter((d) => keep.has(d.entry)).map((d) => Object.assign({ year: yearOf(d.date) }, d));
    const years = all.map((d) => d.year);
    const range = { min: years.length ? Math.min.apply(null, years) : cy, max: cy };
    const zoom = opts.zoom || "years";
    let rows = all;
    let buckets = null;
    if (zoom === "years") {
      if (opts.year != null) rows = all.filter((d) => d.year === opts.year || (d.end && d.year <= opts.year && yearOf(d.end) >= opts.year));
    } else {
      const inYear = all.filter((d) => d.year === cy && d.precision !== "year");
      const yearOnly = all.filter((d) => d.year === cy && d.precision === "year");
      if (zoom === "months") {
        buckets = Array.from({ length: 12 }, (_, i) => ({ key: cy + "-" + String(i + 1).padStart(2, "0"), month: i + 1, rows: [] }));
        inYear.forEach((d) => { const m = parseInt(d.date.slice(5, 7), 10); buckets[m - 1].rows.push(d); });
        rows = opts.month ? buckets[opts.month - 1].rows : inYear;
      } else if (zoom === "weeks" || zoom === "this-week") {
        const map = {};
        inYear.filter((d) => d.precision === "day").forEach((d) => { const w = isoWeek(d.date); const k = w.year + "-W" + String(w.week).padStart(2, "0"); (map[k] = map[k] || { key: k, week: w.week, start: w.start, end: w.end, rows: [] }).rows.push(d); });
        buckets = Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
        const tw = isoWeek(today);
        const twKey = tw.year + "-W" + String(tw.week).padStart(2, "0");
        if (zoom === "this-week") {
          rows = inYear.filter((d) => d.precision === "day" && d.date >= tw.start && d.date <= tw.end);
          const current = (data.entries || []).filter((e) => e.current && keep.has(e.id) && nowStatus(e, today) !== "left").map((e) => e.id);
          return { zoom, today, year: cy, week: tw, key: twKey, rows, current, range, undated: [], yearOnly: [] };
        }
        rows = opts.week ? ((buckets.find((b) => b.week === opts.week) || {}).rows || []) : inYear.filter((d) => d.precision === "day");
      }
      return { zoom, today, year: cy, rows, buckets, range, yearOnly, undated: [] };
    }
    const undated = ((data.years && data.years.undated) || []).filter((id) => keep.has(id));
    return { zoom, today, year: opts.year == null ? null : opts.year, rows, range, undated };
  }

  // Now: an entry with current: true stays in Now until now_until (about 90 days), then only in its home category.
  function nowStatus(e, today) {
    if (!e || !e.current) return "not-current";
    const t = parseDay(today);
    const days = e.dates.filter((d) => d.precision === "day").map((d) => parseDay(d.date)).sort((a, b) => b - a);
    if (!e.now_until || t > parseDay(e.now_until)) return "left";
    if (parseDay(e.now_until) - t <= 14 * 86400000) return "leaving-soon";
    if (days.length && t - days[0] <= 7 * 86400000) return "this-week";
    return "this-month";
  }

  // Category tree with pack state: bundled packs are "installed"; the rest are "not built yet".
  function tree(data) {
    return (data.categories || []).map((c) => {
      const m = (data.manifests || {})[c.pack];
      const count = (data.entries || []).filter((e) => e.category_path[0] === c.id || (c.id === "now" && e.current)).length;
      return { id: c.id, n: c.n, title: c.title, scope: c.scope, refresh: c.refresh, pack: c.pack, installed: !!m, packStatus: m ? m.status : "not built yet", count, subcategories: c.subcategories };
    });
  }

  // Tier view of an entry: the text is written at e.tier; other tiers are not written yet.
  function tierNote(e, tier) {
    if (!tier || tier === "all" || tier === e.tier || (e.tiers && e.tiers[tier])) return null;
    return "No " + TIER_LABEL[tier] + " version yet " + UNKNOWN + ". Shown at the " + TIER_LABEL[e.tier] + " level.";
  }

  // Text for the chosen reading level: that level's text when written, else the summary (written at e.tier).
  function tierText(e, tier) { return (tier && tier !== "all" && e.tiers && e.tiers[tier]) || e.summary; }
  function tiersWritten(e) { return TIERS.filter((t) => t === e.tier || (e.tiers && e.tiers[t])); }

  function sourcesFor(data, e) { return (e.sources || []).map((id) => (data.sources || []).find((s) => s.id === id) || { id, title: id + " " + UNKNOWN, url: "" }); }


  // Periodic layout from the IUPAC 18-column table (4 May 2022). Period 6 and 7
  // group-3 cells are left empty: La/Lu and Ac/Lr stay in the f-block rows.
  // Family ids are a display grouping, not a new classification.
  const ELEMENT_FAMILIES = [
    { id: "hydrogen", label: "Hydrogen" },
    { id: "alkali-metal", label: "Alkali metals (Group 1)" },
    { id: "alkaline-earth", label: "Alkaline earth metals (Group 2)" },
    { id: "group-3", label: "Group 3" },
    { id: "groups-4-12", label: "Groups 4–12" },
    { id: "groups-13-16", label: "Groups 13–16" },
    { id: "halogen", label: "Halogens (Group 17)" },
    { id: "noble-gas", label: "Noble gases (Group 18)" },
    { id: "lanthanoid", label: "Lanthanoids" },
    { id: "actinoid", label: "Actinoids" }
  ];
  function isElementEntry(e) {
    return !!(e && e.category_path && e.category_path[0] === "chemistry" && e.category_path[1] === "elements" && /-element$/.test(e.id));
  }
  function elementZ(e) {
    const m = /\(element (\d+)\)\s*$/.exec((e && e.title) || "") || /atomic number (\d+)/i.exec(((e && e.aliases) || []).join(" "));
    return m ? parseInt(m[1], 10) : 0;
  }
  function elementSymbol(e) {
    const m = /\(([A-Z][a-z]?), element \d+\)\s*$/.exec((e && e.title) || "");
    return m ? m[1] : "";
  }
  function elementName(e) {
    return String((e && e.title) || "").replace(/\s*\([^)]*\)\s*$/, "") || (e && e.title) || "";
  }
  function elementPos(z) {
    if (z === 1) return { col: 1, row: 1 };
    if (z === 2) return { col: 18, row: 1 };
    if (z >= 3 && z <= 4) return { col: z - 2, row: 2 };
    if (z >= 5 && z <= 10) return { col: z + 8, row: 2 };
    if (z >= 11 && z <= 12) return { col: z - 10, row: 3 };
    if (z >= 13 && z <= 18) return { col: z, row: 3 };
    if (z >= 19 && z <= 36) return { col: z - 18, row: 4 };
    if (z >= 37 && z <= 54) return { col: z - 36, row: 5 };
    if (z >= 55 && z <= 56) return { col: z - 54, row: 6 };
    if (z >= 57 && z <= 71) return { col: z - 54, row: 9 };
    if (z >= 72 && z <= 86) return { col: z - 68, row: 6 };
    if (z >= 87 && z <= 88) return { col: z - 86, row: 7 };
    if (z >= 89 && z <= 103) return { col: z - 86, row: 10 };
    if (z >= 104 && z <= 118) return { col: z - 100, row: 7 };
    return null;
  }
  function elementFamily(z) {
    if (z === 1) return "hydrogen";
    if (z >= 57 && z <= 71) return "lanthanoid";
    if (z >= 89 && z <= 103) return "actinoid";
    const p = elementPos(z);
    if (!p) return null;
    if (p.col === 1) return "alkali-metal";
    if (p.col === 2) return "alkaline-earth";
    if (z === 21 || z === 39) return "group-3";
    if (p.col >= 3 && p.col <= 12) return "groups-4-12";
    if (p.col >= 13 && p.col <= 16) return "groups-13-16";
    if (p.col === 17) return "halogen";
    if (p.col === 18) return "noble-gas";
    return null;
  }
  function familyLabel(id) {
    const f = ELEMENT_FAMILIES.find((x) => x.id === id);
    return f ? f.label : id;
  }
  // Arrow keys: prefer the nearest star on the same row or column in that direction.
  function stepElement(stars, from, key, opts) {
    const pool = ((opts && opts.matchesOnly) ? (stars || []).filter((s) => s.match) : (stars || [])).slice();
    if (!pool.length) return null;
    if (key === "Home") return pool[0];
    if (key === "End") return pool[pool.length - 1];
    if (!from) return pool[0];
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[key];
    if (!dir) return null;
    const dc = dir[0], dr = dir[1];
    let best = null, score = Infinity;
    pool.forEach((s) => {
      if (s.id === from.id) return;
      const dcol = s.col - from.col, drow = s.row - from.row;
      if (dc && dcol * dc <= 0) return;
      if (dr && drow * dr <= 0) return;
      const along = dc ? dcol * dc : drow * dr;
      const off = dc ? Math.abs(drow) : Math.abs(dcol);
      const sc = off * 1000 + along;
      if (sc < score) { score = sc; best = s; }
    });
    return best;
  }
  function elementsView(data, f) {
    const byZ = {};
    const stars = [];
    (data.entries || []).filter(isElementEntry).forEach((e) => {
      const z = elementZ(e);
      const pos = elementPos(z);
      if (!pos) return;
      const family = elementFamily(z);
      const star = { id: e.id, z, symbol: elementSymbol(e), name: elementName(e), title: e.title, col: pos.col, row: pos.row, family, familyLabel: familyLabel(family), match: matches(e, f) };
      stars.push(star);
      byZ[z] = star;
    });
    stars.sort((a, b) => a.z - b.z);
    const lines = ELEMENT_FAMILIES.map((fam) => {
      const points = stars.filter((s) => s.family === fam.id).sort((a, b) => a.row - b.row || a.col - b.col);
      return { family: fam.id, points: points.map((s) => ({ col: s.col, row: s.row, z: s.z, id: s.id })) };
    }).filter((l) => l.points.length >= 2);
    const forks = [];
    if (byZ[21] && byZ[39] && byZ[57] && byZ[71] && byZ[89] && byZ[103]) {
      forks.push({
        kind: "group-3-unresolved",
        label: "Group 3 membership is unresolved",
        paths: [
          [{ col: 3, row: 5 }, { col: 3, row: 6 }],
          [{ col: 3, row: 6 }, { col: 3, row: 7 }],
          [{ col: 3, row: 6 }, { col: 3, row: 9 }],
          [{ col: 3, row: 6 }, { col: 17, row: 9 }],
          [{ col: 3, row: 7 }, { col: 3, row: 10 }],
          [{ col: 3, row: 7 }, { col: 17, row: 10 }]
        ]
      });
    }
    const missing = [];
    for (let z = 1; z <= 118; z++) if (!byZ[z]) missing.push(z);
    return { cols: 18, rows: 10, families: ELEMENT_FAMILIES, stars, lines, forks, missing };
  }

  const api = { TIERS, TIER_LABEL, UNKNOWN, matches, azRows, letters, byPlace, byYear, isoWeek, nowStatus, tree, tierNote, tierText, tiersWritten, sourcesFor, entryById, category, yearLabel, parseDay, ELEMENT_FAMILIES, isElementEntry, elementZ, elementSymbol, elementName, elementPos, elementFamily, familyLabel, stepElement, elementsView };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else { root.GD = root.GD || {}; root.GD.atlasModel = api; }
})(typeof window !== "undefined" ? window : globalThis);
