// Sources for the Space race and launch sites layer. Merged by id into atlas/packs/core/sources.json by
// build-space.mjs. Every page was opened on 2026-11-26 (see "verified"). Roscosmos could not be opened
// (HTTP 500), so it is not used. Pages with reuse terms that are not open (ESA, CNSA, Vandenberg) are
// linked and their facts are restated in our own words; no text or image is copied.
const CHECKED = "2026-11-26";
const DIRECT = "opened directly (HTTP 200)";
const VIA_FETCH = "opened via a fetch service (direct fetch blocked by the site)";
const NASA_TERMS = "NASA content is generally not subject to copyright in the United States (NASA Images and Media Usage Guidelines). Credit NASA; no NASA insignia; no implied endorsement. Facts restated in our own words; no image copied.";
const NASA_URL = "https://www.nasa.gov/nasa-brand-center/images-and-media/";
const ESA_TERMS = "(c) ESA: all material on esa.int is protected by copyright; ESA allows personal non-commercial copying only and no redistribution or derivative works (esa.int Terms and conditions, opened 2026-11-26). Linked only; dates and figures restated as facts in our own words; no text or image copied.";
const CNSA_TERMS = "Chinese National Space Administration site: the page carries a copyright line (all rights reserved, 国家航天局) and the English site asks for written permission to mirror or copy. Linked only; dates and figures restated as facts in our own words; no text or image copied.";
const WD = (q, name) => ({ id: `wd-${q.toLowerCase()}`, title: `Wikidata item for ${name} (coordinate property)`, url: `https://www.wikidata.org/wiki/${q}`, checked: CHECKED, class: "reference",
  publisher: "Wikimedia Foundation (Wikidata)", license: "CC0 1.0: Wikidata structured data is released into the public domain (Wikidata:Licensing). Used for the one published coordinate point only.", terms_url: "https://www.wikidata.org/wiki/Wikidata:Licensing", verified: DIRECT });

export const SPACE_SOURCES = [
  { id: "nssdca-apollo-landings", title: "NASA NSSDCA: Apollo Lunar Landings (1969-1972) table", url: "https://nssdc.gsfc.nasa.gov/planetary/lunar/apolloland.html", checked: CHECKED,
    class: "official", publisher: "NASA Space Science Data Coordinated Archive (NSSDCA)", license: NASA_TERMS, terms_url: NASA_URL, verified: DIRECT,
    description: "Table of the six Apollo landings: launch and landing dates, landing site, latitude and longitude (DE421 Mean Earth/Polar Axis frame), EVA time, traverse and sample return. Page last updated 06 March 2017." },
  { id: "nssdca-luna-zond", title: "NASA NSSDCA: Soviet Missions to the Moon (Luna and Zond series)", url: "https://nssdc.gsfc.nasa.gov/planetary/lunar/lunarussr.html", checked: CHECKED,
    class: "official", publisher: "NASA Space Science Data Coordinated Archive (NSSDCA)", license: NASA_TERMS, terms_url: NASA_URL, verified: DIRECT,
    description: "Luna series table with launch dates, landing dates and times, latitude and longitude and the landing region. Page last updated 27 September 2005." },
  { id: "nssdca-apollo-11-lm", title: "NASA NSSDCA Master Catalog: Apollo 11 Lunar Module / EASEP", url: "https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1969-059C", checked: CHECKED,
    class: "official", publisher: "NASA Space Science Data Coordinated Archive (NSSDCA)", license: NASA_TERMS, terms_url: NASA_URL, verified: DIRECT,
    description: "Spacecraft record: launch date 1969-07-16, launch vehicle Saturn 5, launch site listed as Cape Canaveral, United States." },
  { id: "iau-statio-tranquillitatis", title: "IAU Gazetteer of Planetary Nomenclature: Statio Tranquillitatis (Moon, feature 5684)", url: "https://planetarynames.wr.usgs.gov/Feature/5684", checked: CHECKED,
    class: "official", publisher: "IAU Working Group for Planetary System Nomenclature (hosted by the USGS Astrogeology Science Center)",
    license: "Everything in the Gazetteer of Planetary Nomenclature is in the public domain (Gazetteer FAQ). Suggested citation: International Astronomical Union Working Group for Planetary System Nomenclature, 'Gazetteer of Planetary Nomenclature', accessed 2026-11-26, http://planetarynames.wr.usgs.gov/.",
    terms_url: "https://planetarynames.wr.usgs.gov/Page/FAQ", verified: DIRECT,
    description: "Landing-site name 'Statio Tranquillitatis' ('Tranquility Base', Apollo 11): centre 0.67 N, 23.47 E, planetographic +East, approved 1970." },
  { id: "nasa-sputnik-1957", title: "NASA: Oct. 4, 1957 - Sputnik, the Dawn of the Space Age", url: "https://www.nasa.gov/image-article/oct-4-1957-sputnik-dawn-of-space-age/", checked: CHECKED,
    class: "official", publisher: "NASA", license: NASA_TERMS, terms_url: NASA_URL, verified: DIRECT },
  { id: "esa-baikonur-steppes", title: "ESA: Baikonur: from the steppes of Kazakhstan to space (2002)", url: "https://www.esa.int/articles/baikonur-from-the-steppes-of-kazakhstan-to-space", checked: CHECKED,
    class: "official", publisher: "European Space Agency", license: ESA_TERMS, terms_url: "https://www.esa.int/Services/Terms_and_conditions", verified: DIRECT },
  { id: "esa-baikonur-cosmodrome", title: "ESA: Baikonur Cosmodrome", url: "https://www.esa.int/articles/about-us/directorates/science/baikonur-cosmodrome", checked: CHECKED,
    class: "official", publisher: "European Space Agency", license: ESA_TERMS, terms_url: "https://www.esa.int/Services/Terms_and_conditions", verified: VIA_FETCH },
  { id: "esa-europes-spaceport", title: "ESA: Europe's Spaceport in French Guiana", url: "https://www.esa.int/establishment/about-us/directorates/space-transportation/europe-s-spaceport/europe-s-spaceport", checked: CHECKED,
    class: "official", publisher: "European Space Agency", license: ESA_TERMS, terms_url: "https://www.esa.int/Services/Terms_and_conditions", verified: DIRECT },
  { id: "cnsa-dongfanghong-1", title: "CNSA (Chinese): Long March 1 launches Dongfanghong-1, China's first satellite (2020)", url: "https://www.cnsa.gov.cn/n6758823/n6758844/n6760209/n6760215/c6809206/content.html", checked: CHECKED,
    class: "official", publisher: "China National Space Administration (CNSA)", license: CNSA_TERMS, verified: DIRECT },
  { id: "cnsa-launch-centres", title: "CNSA (Chinese): China's space launch centres (2013, republished from Xinhua)", url: "https://www.cnsa.gov.cn/n6758968/n6758973/c6771580/content.html", checked: CHECKED,
    class: "official", publisher: "China National Space Administration (CNSA), republishing Xinhua", license: CNSA_TERMS, verified: DIRECT },
  { id: "vsfb-history", title: "Vandenberg Space Force Base: History", url: "https://www.vandenberg.spaceforce.mil/About-Us/History/", checked: CHECKED,
    class: "official", publisher: "Vandenberg Space Force Base (US Space Force)",
    license: "US federal government (Department of Defense) public-affairs page. The site's own reuse notice could not be opened (direct fetch returned 403; the privacy page returned 404), so its exact terms are [UNKNOWN]. Linked only; facts restated in our own words; no image copied.", verified: VIA_FETCH },
  WD("Q177477", "Baikonur Cosmodrome"), WD("Q308987", "Guiana Space Centre"), WD("Q692677", "Jiuquan Satellite Launch Center"),
  WD("Q461492", "Vandenberg Space Force Base"), WD("Q334465", "Cape Canaveral Space Force Station"),
];
