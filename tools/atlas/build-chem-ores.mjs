// Chemistry index (C4): which countries produce an element's ore or metal, from the USGS Mineral
// Commodity Summaries 2026 data release (CC0 / U.S. public domain). Local only, no network.
// Reads source-cache/usgs-mcs/MCS2026_Commodities_Data.csv and data/world.js (Natural Earth, public
// domain) and writes data/atlas/chemistry/element-ores-by-country.json.
// Only commodities that map plainly to one element are used (explicit table below); mixed products
// (rare earths, salt, boron forms, ammonia) are left out rather than split. A country pin is a
// reference point inside the country (Natural Earth), never a mine or deposit location.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CHECKED = "2026-11-26";
const OUT_REL = "data/atlas/chemistry/element-ores-by-country.json";
const U = "[UNKNOWN]";

// element id -> [MCS commodity, exact Statistics_detail, short label]
export const MAP = {
  "aluminium-element": ["Bauxite", "Bauxite, mine production", "Bauxite (aluminium ore), mine production"],
  "antimony-element": ["Antimony", "Mine production", "Mine production"],
  "arsenic-element": ["Arsenic", "Production (arsenic trioxide, gross weight)", "Arsenic trioxide production (gross weight)"],
  "beryllium-element": ["Beryllium", "Mine production", "Mine production"],
  "bismuth-element": ["Bismuth", "Refinery production", "Refinery production"],
  "bromine-element": ["Bromine", "Production", "Production"],
  "cadmium-element": ["Cadmium", "Refinery production", "Refinery production"],
  "carbon-element": ["Graphite (Natural)", "Mine production", "Natural graphite, mine production"],
  "chromium-element": ["Chromium", "Mine production", "Mine production"],
  "cobalt-element": ["Cobalt", "Mine production", "Mine production"],
  "copper-element": ["Copper", "Mine production", "Mine production"],
  "fluorine-element": ["Fluorspar", "Mine production", "Fluorspar, mine production"],
  "gallium-element": ["Gallium", "Primary production", "Primary production"],
  "gold-element": ["Gold", "Mine production", "Mine production"],
  "helium-element": ["Helium", "Helium Production", "Helium production"],
  "indium-element": ["Indium", "Refinery production", "Refinery production"],
  "iodine-element": ["Iodine", "Mine production", "Mine production"],
  "iron-element": ["Iron Ore", "Mine production: Iron content", "Iron ore, mine production (iron content)"],
  "krypton-element": ["Krypton", "Rare gases production, (million liters)", "Rare-gas production"],
  "lead-element": ["Lead", "Mine production", "Mine production"],
  "lithium-element": ["Lithium", "Mine production", "Mine production"],
  "magnesium-element": ["Magnesium Metal", "Smelter production", "Magnesium metal, smelter production"],
  "manganese-element": ["Manganese", "Mine production", "Mine production"],
  "mercury-element": ["Mercury", "Mine production", "Mine production"],
  "molybdenum-element": ["Molybdenum", "Mine production", "Mine production"],
  "neon-element": ["Neon", "Rare gases production, (million liters)", "Rare-gas production"],
  "nickel-element": ["Nickel", "Mine production", "Mine production"],
  "niobium-element": ["Niobium (Columbium)", "Mine production", "Mine production"],
  "palladium-element": ["Palladium", "Mine production: Palladium", "Mine production"],
  "phosphorus-element": ["Phosphate Rock", "Mine production", "Phosphate rock, mine production (gross weight)"],
  "platinum-element": ["Platinum", "Mine production: Platinum", "Mine production"],
  "potassium-element": ["Potash", "Mine production", "Potash, mine production"],
  "rhenium-element": ["Rhenium", "Mine production", "Mine production"],
  "selenium-element": ["Selenium", "Refinery production", "Refinery production"],
  "silicon-element": ["Silicon", "Silicon metal", "Silicon metal production"],
  "silver-element": ["Silver", "Mine production", "Mine production"],
  "strontium-element": ["Strontium", "Mine production", "Mine production (celestite)"],
  "sulfur-element": ["Sulfur", "Production, all forms", "Production, all forms"],
  "tantalum-element": ["Tantalum", "Mine production", "Mine production"],
  "tellurium-element": ["Tellurium", "Refinery production", "Refinery production"],
  "tin-element": ["Tin", "Mine production", "Mine production"],
  "titanium-element": ["Titanium Sponge Metal", "Titanium sponge metal production", "Titanium sponge metal production"],
  "tungsten-element": ["Tungsten", "Mine production", "Mine production"],
  "vanadium-element": ["Vanadium", "Mine production", "Mine production"],
  "xenon-element": ["Xenon", "Rare gases production, (million liters)", "Rare-gas production"],
  "zinc-element": ["Zinc", "Mine production", "Mine production"],
  "zirconium-element": ["Zirconium", "Zirconium mineral concentrates, mine production (thousand metric tons, gross weight)", "Zirconium mineral concentrates (gross weight)"],
};
const LEFT_OUT = ["Rare Earths (mixed elements)", "Salt (sodium chloride)", "Boron (several reported forms)", "Nitrogen (fixed)—ammonia (a compound)", "Yttrium (reported as Y2O3 equivalent)", "Scandium (global figure only)"];
const ALIAS = { "Burma": "Myanmar", "Congo (Kinshasa)": "Dem. Rep. Congo", "Côte d’Ivoire": "Côte d'Ivoire", "Korea, North": "North Korea", "Korea, Republic of": "South Korea", "United States": "United States of America" };

function cacheDir() {
  if (process.env.GLOBEDESK_ELEMENTS_CACHE) return path.resolve(process.env.GLOBEDESK_ELEMENTS_CACHE);
  return path.resolve(ROOT, ".cache/sources");
}
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const save = (p, obj) => writeFileSync(p, JSON.stringify(obj, null, 2) + "\n");

export function parseCsv(text) {
  const rows = []; let row = []; let cell = ""; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  const head = rows.shift();
  return rows.filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}
// The CSV is Windows-1252: decode it so names like Côte d’Ivoire survive.
function readCp1252(p) { return new TextDecoder("windows-1252").decode(readFileSync(p)); }

// Planar polygon area and centroid in lon/lat (fine for a reference point).
function ringCentroid(ring) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    a += f; cx += (ring[j][0] + ring[i][0]) * f; cy += (ring[j][1] + ring[i][1]) * f;
  }
  a /= 2;
  return a ? { area: Math.abs(a), lng: cx / (6 * a), lat: cy / (6 * a) } : { area: 0, lng: ring[0][0], lat: ring[0][1] };
}
function inRing(pt, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if ((yi > pt.lat) !== (yj > pt.lat) && pt.lng < (xj - xi) * (pt.lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function countryPoints() {
  const ctx = { window: {} }; vm.createContext(ctx);
  vm.runInContext(readFileSync(path.join(ROOT, "data/world.js"), "utf8"), ctx);
  vm.runInContext(readFileSync(path.join(ROOT, "data/towns.js"), "utf8"), ctx);
  const world = ctx.window.GD_REGIONS.world.countries;
  const towns = ctx.window.GD_REGIONS["towns-index"].towns;
  const out = new Map();
  for (const c of world) {
    let best = null;
    for (const poly of c.polys) { const g = ringCentroid(poly[0]); if (!best || g.area > best.area) best = Object.assign(g, { ring: poly[0] }); }
    if (!best) continue;
    let pt = { lat: best.lat, lng: best.lng, method: "centroid of the largest Natural Earth polygon" };
    if (!inRing(pt, best.ring)) {
      const cap = towns.find((t) => t[1] === c.a3 && /Admin-0 capital$/.test(t[5]));
      pt = cap ? { lat: cap[3], lng: cap[4], method: "Natural Earth capital (the polygon centroid fell outside the country)" } : null;
    }
    if (pt) out.set(c.name, { a3: c.a3, lat: Number(pt.lat.toFixed(3)), lng: Number(pt.lng.toFixed(3)), method: pt.method });
  }
  return out;
}

const dir = cacheDir();
const csvPath = path.join(dir, "usgs-mcs/MCS2026_Commodities_Data.csv");
if (!existsSync(csvPath)) throw new Error("Missing " + csvPath);
const all = parseCsv(readCp1252(csvPath)).filter((r) => /^World/.test(r.Section) && r.Statistics === "Production");
const pts = countryPoints();
const num = (v) => { const s = String(v || "").replace(/,/g, "").trim(); return /^\d+(\.\d+)?$/.test(s) ? Number(s) : null; };

const byElement = {};
const noPoint = new Set();
for (const [id, [commodity, detail, label]] of Object.entries(MAP)) {
  // USGS prints some rows (often the World total) under a "<detail>: rounded" or "<detail>, rounded" label.
  const isRounded = (d) => d === detail + ": rounded" || d === detail + ", rounded";
  const raw = all.filter((r) => r.Commodity === commodity && (r.Statistics_detail === detail || isRounded(r.Statistics_detail)));
  const seen = new Set();
  const rows = raw.slice().sort((a, b) => (isRounded(a.Statistics_detail) ? 1 : 0) - (isRounded(b.Statistics_detail) ? 1 : 0))
    .filter((r) => { const k = r.Year + "|" + r.Country; if (seen.has(k)) return false; seen.add(k); return true; });
  if (!rows.length) throw new Error("No MCS rows for " + id + " (" + commodity + " / " + detail + ")");
  const year = rows.map((r) => r.Year).sort().pop();
  const yr = rows.filter((r) => r.Year === year);
  const total = yr.find((r) => r.Country === "World total");
  const countries = yr.filter((r) => r.Country !== "World total" && r.Country !== "Other countries" && r.Value.trim() !== "—")
    .map((r) => {
      const name = ALIAS[r.Country] || r.Country;
      const p = pts.get(name);
      if (!p) noPoint.add(r.Country);
      const row = { country: r.Country, value: r.Value.trim(), n: num(r.Value) };
      if (p) Object.assign(row, { a3: p.a3, lat: p.lat, lng: p.lng });
      return row;
    })
    .sort((a, b) => (b.n == null ? -1 : b.n) - (a.n == null ? -1 : a.n) || a.country.localeCompare(b.country));
  byElement[id] = { commodity, measure: label, unit: yr[0].Unit.trim(), year, world_total: total ? total.Value.trim() : U, countries };
}

const doc = {
  schema: "globedesk.chem/0-draft",
  id: "element-ores-by-country",
  title: "Where each element's ore or metal is produced, by country (USGS MCS 2026)",
  status: "draft",
  checked: CHECKED,
  source: "usgs-mcs-2026-data",
  licence: "CC0 1.0 / U.S. public domain (USGS Mineral Commodity Summaries 2026 data release)",
  note: "Country totals as USGS reports them (latest year in the release; USGS marks many as estimates). Values are copied as printed, including USGS symbols such as W or NA; their meaning is in the MCS 2026 notes. A pin is a reference point inside the country, not a mine or deposit. 'Other countries' and dash (no production) rows are not pinned.",
  left_out: LEFT_OUT,
  no_point: Array.from(noPoint).sort(),
  byElement,
};
save(path.join(ROOT, OUT_REL), doc);

const sourcesPath = path.join(ROOT, "atlas/packs/core/sources.json");
const sourcesDoc = readJson(sourcesPath);
const catalog = [
  {
    id: "usgs-mcs-2026-data",
    title: "USGS Mineral Commodity Summaries 2026 Data Release (world production by country)",
    url: "https://doi.org/10.5066/P1WKQ63T",
    checked: CHECKED,
    class: "official",
    publisher: "U.S. Geological Survey (USGS), National Minerals Information Center",
    license: "Metadata Use_Constraints: \"These data are marked with a Creative Common CC0 1.0 Universal License. These data are in the public domain and do not have any use constraints.\"",
    terms_url: "https://data.usgs.gov/datacatalog/metadata/USGS.69837e43b66b01367d7ec7c7.xml",
    description: "MCS2026_Commodities_Data.csv, World production rows. Publication: https://doi.org/10.3133/mcs2026",
  },
];
for (const s of catalog) {
  const i = sourcesDoc.sources.findIndex((x) => x.id === s.id);
  if (i >= 0) Object.assign(sourcesDoc.sources[i], s); else sourcesDoc.sources.push(s);
}
save(sourcesPath, sourcesDoc);
const n = Object.values(byElement).reduce((a, e) => a + e.countries.length, 0);
console.log("element-ores-by-country: " + Object.keys(byElement).length + " elements, " + n + " country rows; no point for: " + (doc.no_point.join(", ") || "none"));
