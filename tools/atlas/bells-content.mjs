// Bells layer content (authoring input for tools/atlas/build-bells.mjs). Our own summaries of the cited
// pages, CC BY 4.0. Rules: every fact names a source id from bells-sources.mjs; gaps are "[UNKNOWN]";
// no living people are subjects or named. Coordinates: OpenStreetMap Nominatim (ODbL) lookups of the
// named site, kept in GEO below; approximate: true where the pin is a stand-in (findspot, home town,
// last-known place, or a building rather than the bell itself).
// Timeline rows: [date, label, source, opts]; date is astronomical (1 BCE = 0), precision from its form.

const LB = 0.45359237; // kg per lb
export const kgFromLb = (lb) => Math.round(lb * LB);
export const IN = 0.0254;

export const GEO = {
  "tsar-bell": [55.75077, 37.61844], "bolshoy-uspensky-bell": [55.75072, 37.61821], "sysoy-bell": [57.18488, 39.41524],
  "uglich-exile-bell": [57.52869, 38.31733], "big-ben-great-bell": [51.50069, -0.12457], "great-paul": [51.51379, -0.09845],
  "great-tom-oxford": [51.7502, -1.25655], "bow-bells": [51.51373, -0.09353], "liverpool-great-george": [53.39732, -2.97318],
  "lutine-bell": [51.51296, -0.08241], "hms-hood-bell": [50.80047, -1.10948], "pummerin": [48.20849, 16.37313],
  "emmanuel-notre-dame": [48.85294, 2.35005], "savoyarde": [48.88681, 2.34302], "gloriosa-erfurt": [50.97571, 11.02291],
  "petersglocke-cologne": [50.9413, 6.95814], "freedom-bell-berlin": [52.48483, 13.3441], "zygmunt-bell": [50.05465, 19.93546],
  "campanone-st-peters": [41.90216, 12.45371], "mechelen-carillons": [51.02881, 4.4783], "bruges-belfry-carillon": [51.20823, 3.22479],
  "bianzhong-marquis-yi": [30.56401, 114.35998], "yongle-bell": [39.96783, 116.33199], "seongdeok-bell": [35.82899, 129.22797],
  "sangwonsa-bell": [37.78637, 128.56396], "todaiji-bell": [34.68824, 135.83976], "chion-in-bell": [35.00562, 135.78354],
  "byodoin-bell": [34.8895, 135.80745], "hiroshima-peace-bell": [34.39487, 132.45241], "mingun-bell": [22.053, 96.0178],
  "dhammazedi-bell": [16.76851, 96.172], "balangiga-bells": [11.10745, 125.38745], "panaji-church-bell": [15.49853, 73.82974],
  "nimrud-bronze-bell": [36.0982, 43.32886], "liberty-bell": [39.94995, -75.15021], "centennial-bell": [39.94889, -75.15003], "wilbank-bell": [40.03827, -75.17746],
  "justice-bell": [40.10476, -75.43784], "bicentennial-bell": [39.94743, -75.14657], "old-north-bells": [42.36632, -71.05445],
  "world-peace-bell": [39.09495, -84.49601], "un-japanese-peace-bell": [40.74963, -73.96739], "netherlands-carillon": [38.88822, -77.0695],
  "bok-tower-carillon": [27.93603, -81.57582], "uss-arizona-bell": [32.23262, -110.95182], "edmund-fitzgerald-bell": [46.7706, -84.95818],
  "peace-tower-carillon": [45.42479, -75.69964], "dolores-bell": [19.43255, -99.13127], "maria-angola-cusco": [-13.51628, -71.97787],
  "national-carillon-canberra": [-35.29849, 149.14174], "swan-bells-perth": [-31.95896, 115.85823], "anzac-bell-perth": [-31.95896, 115.85823],
  "wellington-carillon": [-41.29899, 174.77715], "cape-town-st-georges-bells": [-33.92487, 18.41942], "amedzofe-bell": [6.84739, 0.4355],
};

// Region (continent) for the filter, from the bell's country.
export const REGION_OF = { RU: "Europe", GB: "Europe", AT: "Europe", FR: "Europe", DE: "Europe", PL: "Europe", VA: "Europe", BE: "Europe",
  CN: "Asia", KR: "Asia", JP: "Asia", MM: "Asia", PH: "Asia", IN: "Asia", IQ: "Asia", US: "North America", CA: "North America", MX: "North America",
  PE: "South America", AU: "Oceania", NZ: "Oceania", ZA: "Africa", GH: "Africa" };

import { EUROPE } from "./bells-content-europe.mjs";
import { ASIA } from "./bells-content-asia.mjs";
import { AMERICAS } from "./bells-content-americas.mjs";
import { SOUTH } from "./bells-content-south.mjs";
// Fields: id, title, aliases, kind (bell|ring|carillon|chime-set|ship-bell), country (ISO 3166-1 alpha-2),
// place {label, approximate, basis: current|findspot|last-known|home-town|building}, status
// (in-place|museum|lost|in-storage|[UNKNOWN]), status_note, maker, mass_kg, mass_note, diameter_m,
// height_m, thickness_m, note, alloy_note, bells_count, timeline, everyday, student, sources,
// see_also (extra category paths), related (extra), confidence, unknowns, model (false = not modelled).
export const BELLS = [...EUROPE, ...ASIA, ...AMERICAS, ...SOUTH];
