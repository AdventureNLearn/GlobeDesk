// Sources for the disasters layer (Volcanoes, earthquakes and disasters). Merged by id into
// atlas/packs/core/sources.json by build-disasters.mjs. Every page was opened on 2026-11-26.
// Smithsonian GVP is deliberately not used: its reuse terms are [UNKNOWN] (the site returned a
// verification wall), so it is neither bundled nor linked.
const CHECKED = "2026-11-26";
const USGS_PD = "US federal government work: public domain in the US (17 U.S.C. 105); individual images may carry other rights";
const NCEI_TERMS = "NOAA metadata says access is unrestricted and free online; no Creative Commons licence is printed. Treated as a US federal government work (17 U.S.C. 105). NOAA asks for the dataset citation with the access date. Only a few curated values are used, each named in the record.";
const VIA_FETCH = "opened via a fetch service (direct fetch blocked by the site)";
const DIRECT = "opened directly (HTTP 200)";

export const DISASTER_SOURCES = [
  { id: "ncei-sig-volcanoes", title: "NCEI/WDS Global Significant Volcanic Eruptions Database (doi:10.7289/V5JW8BSH)",
    url: "https://doi.org/10.7289/V5JW8BSH", checked: CHECKED, class: "official", publisher: "NOAA National Centers for Environmental Information",
    license: NCEI_TERMS, verified: DIRECT,
    cite_as: "National Geophysical Data Center / World Data Service (NGDC/WDS): NCEI/WDS Global Significant Volcanic Eruptions Database. NOAA National Centers for Environmental Information. doi:10.7289/V5JW8BSH. Accessed 2026-11-26." },
  { id: "ncei-sig-earthquakes", title: "NCEI/WDS Global Significant Earthquake Database (doi:10.7289/V5TD9V7K)",
    url: "https://doi.org/10.7289/V5TD9V7K", checked: CHECKED, class: "official", publisher: "NOAA National Centers for Environmental Information",
    license: NCEI_TERMS, verified: DIRECT,
    cite_as: "National Geophysical Data Center / World Data Service (NGDC/WDS): NCEI/WDS Global Significant Earthquake Database. NOAA National Centers for Environmental Information. doi:10.7289/V5TD9V7K. Accessed 2026-11-26." },
  { id: "usgs-deadliest-eruptions", title: "USGS FAQ: Which volcanic eruptions were the deadliest?",
    url: "https://www.usgs.gov/faqs/which-volcanic-eruptions-were-deadliest", checked: CHECKED, class: "official", publisher: "US Geological Survey",
    license: USGS_PD, verified: VIA_FETCH },
  { id: "usgs-volcanoes-climate", title: "USGS Volcano Hazards Program: Volcanoes can affect the Earth's climate",
    url: "https://www.usgs.gov/programs/VHP/volcanoes-can-affect-climate", checked: CHECKED, class: "official", publisher: "US Geological Survey",
    license: USGS_PD, verified: VIA_FETCH },
  { id: "usgs-hvo-krakatau", title: "USGS Volcano Watch (Hawaiian Volcano Observatory): Mixing magmas at Krakatau (2003)",
    url: "https://www.usgs.gov/news/volcano-watch-mixing-magmas-krakatau", checked: CHECKED, class: "official", publisher: "US Geological Survey",
    license: USGS_PD, verified: VIA_FETCH },
  { id: "usgs-yvo-naples", title: "USGS Yellowstone Volcano Observatory: Living with active volcanoes in the back yard, Naples metropolitan area, Italy (2023)",
    url: "https://www.usgs.gov/observatories/yvo/news/living-active-volcanoes-back-yard-naples-metropolitan-area-italy", checked: CHECKED, class: "official", publisher: "US Geological Survey",
    license: USGS_PD, verified: VIA_FETCH },
  { id: "usgs-pubs-lisbon-farfield", title: "USGS Publications Warehouse: Far field tsunami simulations of the 1755 Lisbon earthquake (Marine Geology, 2009)",
    url: "https://pubs.usgs.gov/publication/70036556", checked: CHECKED, class: "reference", publisher: "US Geological Survey (record); Elsevier (journal)",
    license: "Catalogue record by USGS; the journal abstract is © Elsevier. Summarised in our own words and linked only. The longest run of words shared with the abstract is 4 (checked 2026-11-26), so no sentence or passage is copied; numbers and place names are facts.", verified: VIA_FETCH },
  { id: "usgs-pubs-lisbon-source", title: "USGS Publications: Can modeling the geologic record contribute to constraining the tectonic source of the 1755 great Lisbon earthquake? (Earth and Space Science, 2021, doi:10.1029/2020EA001109)",
    url: "https://www.usgs.gov/publications/can-modeling-geologic-record-contribute-constraining-tectonic-source-ad-1755-great", checked: CHECKED, class: "reference", publisher: "US Geological Survey (record); AGU (journal)",
    license: "Catalogue record by USGS; article terms [UNKNOWN]. Summarised in our own words and linked only.", verified: VIA_FETCH },
];
