// Ancient World source registry (authoring input for tools/atlas/build-ancient.mjs).
// Every URL was opened on 2026-11-26 (direct fetch, HTTP 200, unless "verified" says otherwise).
// Official pin coordinates and In Danger status for the 12 owner-approved sites were re-read from each
// property page and its maps table, and from https://whc.unesco.org/en/list/?danger=1, on 2026-11-27 (HTTP 200).
// Our entry text is our own wording (CC BY 4.0). UNESCO, UNITAR, Perseus and Banco de la República pages are
// cited and linked, never copied. Official UNESCO World Heritage points are cited (DMS as published). Pleiades
// (CC BY 3.0) is still used for the Pompeii pin, with credit.
const CHECKED = "2026-11-26";
const OPENED = "opened directly (HTTP 200)";
const s = (id, title, url, cls, publisher, license, description, extra) => ({ id, title, url, checked: CHECKED, class: cls, publisher, license, verified: OPENED, description, ...(extra || {}) });
const UNESCO_LIC = "UNESCO World Heritage Centre page: text under CC BY-SA 3.0 IGO plus the UNESCO terms of use. Cited and linked only; our wording, nothing copied.";
const NEWS_LIC = "UNESCO terms of use (news item); cited and linked only, our wording, nothing copied.";
const PLEIADES_LIC = "CC BY 3.0 (Pleiades). Coordinates and dates reused with credit; descriptions summarised in our words.";
const whc = (n, name, note) => s(`unesco-whc-${n}`, `${name} (World Heritage List ${n})`, `https://whc.unesco.org/en/list/${n}/`, "official", "UNESCO World Heritage Centre", UNESCO_LIC,
  `UNESCO's official World Heritage List page for ${name}: inscription year, brief synthesis and criteria. ${note}`, { terms_url: "https://www.unesco.org/en/terms-use" });
const ple = (n, name) => s(`pleiades-${n}`, `${name} (Pleiades place ${n})`, `https://pleiades.stoa.org/places/${n}`, "reference", "Pleiades (Institute for the Study of the Ancient World, NYU, and Ancient World Mapping Center)", PLEIADES_LIC,
  `Pleiades gazetteer record for ${name}: representative point, attested periods and a short scholarly description.`);

export const ANCIENT_SOURCES = [
  // ---- UNESCO World Heritage List pages (official) ----
  whc(1481, "The Ahwar of Southern Iraq: Refuge of Biodiversity and the Relict Landscape of the Mesopotamian Cities", "Ur is one of its three cultural components (inscribed 2016)."),
  whc(86, "Memphis and its Necropolis – the Pyramid Fields from Giza to Dahshur", "Includes the Giza pyramid fields (inscribed 1979)."),
  whc(138, "Archaeological Ruins at Moenjodaro", "Inscribed 1980."),
  whc(849, "Archaeological Site of Troy", "Inscribed 1998."),
  whc(829, "Archaeological Areas of Pompei, Herculaneum and Torre Annunziata", "Inscribed 1997."),
  whc(1572, "Göbekli Tepe", "Inscribed 2018."),
  whc(326, "Petra", "Inscribed 1985."),
  whc(414, "Pre-Hispanic City of Teotihuacan", "Inscribed 1987."),
  whc(1269, "Sacred City of Caral-Supe", "Inscribed 2009."),
  whc(441, "Mausoleum of the First Qin Emperor", "Inscribed 1987."),
  whc(364, "Great Zimbabwe National Monument", "Inscribed 1986."),
  whc(886, "State Historical and Cultural Park “Ancient Merv”", "Inscribed 1999."),
  whc(23, "Site of Palmyra", "Inscribed 1980; on the List of World Heritage in Danger since 2013 (property page and https://whc.unesco.org/en/list/?danger=1 read 2026-11-27)."),
  // ---- Palmyra damage (official, UN bodies) ----
  s("unesco-news-1341", "UNESCO news 1341: Temple of Bel, Palmyra (1 September 2015)", "https://whc.unesco.org/en/news/1341", "official", "UNESCO World Heritage Centre", NEWS_LIC,
    "UNESCO statement of 1 September 2015: UNOSAT satellite images confirm the Temple of Bel was destroyed by explosives on 30 August 2015."),
  s("unesco-news-1471", "UNESCO news 1471: statement on Palmyra (25 March 2016)", "https://whc.unesco.org/en/news/1471", "official", "UNESCO World Heritage Centre", NEWS_LIC,
    "UNESCO statement of 25 March 2016 listing destroyed monuments at Palmyra (temples of Baalshamin and Bel, funerary towers, the Triumphal Arch) and offering an assessment mission."),
  s("unosat-1015", "Temple of Bel, Palmyra: damage assessment (UNOSAT product 1015, 31 August 2015)", "https://unosat.org/products/1015", "official", "UNITAR-UNOSAT (United Nations Satellite Centre)", "[UNKNOWN] reuse terms for the map product; cited and linked only, nothing copied.",
    "UN satellite damage assessment comparing imagery of 27 and 31 August 2015: the Temple of Bel is destroyed."),
  s("unitar-chs-2016", "Satellite-based damage assessment to cultural heritage sites in Syria (UNITAR-UNOSAT report, 2016, PDF)", "https://unitar.org/sites/default/files/media/file/Full_CHS_Report_0.pdf", "official", "UNITAR-UNOSAT (United Nations Satellite Centre)", "[UNKNOWN] reuse terms; cited and linked only, nothing copied.",
    "UN report with dated damage at Palmyra: Baalshamin Temple destroyed between 25 and 27 August 2015, Temple of Bel on 30 August 2015, Arch of Triumph on 5 October 2015."),
  // ---- Pleiades gazetteer (reference, CC BY 3.0) ----
  ple(912985, "Ur"), ple(442962448, "Giza"), ple(902113570, "Moenjodaro"), ple(550595, "Ilion/Troia"), ple(433032, "Pompeii"),
  ple(245438984, "Göbekli Tepe"), ple(697725, "Petra"), ple(117715281, "Qin Shihuang Mausoleum"), ple(322739224, "Great Zimbabwe"),
  ple(961873, "Merv"), ple(668331, "Palmyra"),
  s("pleiades-period-old-kingdom-egypt", "Old Kingdom Egypt time period (Pleiades vocabulary)", "https://pleiades.stoa.org/vocabularies/time-periods/old-kingdom-egypt", "reference", "Pleiades (Institute for the Study of the Ancient World, NYU, and Ancient World Mapping Center)", PLEIADES_LIC,
    "Pleiades definition of the Old Kingdom period: 2670 to 2168 BC, following the UCLA Encyclopedia of Egyptology chronology."),
  // ---- Coordinates ----
  s("wikidata-p625", "Wikidata coordinate location (property P625)", "https://www.wikidata.org/wiki/Property:P625", "reference", "Wikidata (Wikimedia Foundation)", "CC0 1.0 (Wikidata structured data)",
    "Wikidata coordinate statements, read per site by item id (listed in each record) on 2026-11-26 through the Wikidata Query Service."),
  // ---- Polity outlines (extents branch) ----
  s("cliopatria", "Cliopatria: polity outlines 3400 BCE to 2024 CE (Seshat Global History Databank)", "https://github.com/Seshat-Global-History-Databank/cliopatria", "reference", "Seshat Global History Databank",
    "CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/), per LICENSE.md in the repository; also on Zenodo record 13363121. Authors [UNKNOWN] (no author list in the repository files).",
    "Open geospatial dataset of past polities. We bundle a subset from commit 04b4e06 (2026-11-24 PT): polity outlines only, 14 snapshot years, simplified; the project says its maps are one version of past territory and border uncertainties are common.",
    { attribution: "Polity borders: Cliopatria, Seshat Global History Databank (https://github.com/Seshat-Global-History-Databank/cliopatria), CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Subset; borders simplified and approximate; changes by GlobeDesk.", license_url: "https://creativecommons.org/licenses/by/4.0/" }),
  // ---- Myths ----
  s("perseus-plato-critias-108e", "Plato, Critias 108e (Lamb translation, 1925; Perseus Digital Library)", "https://www.perseus.tufts.edu/hopper/text?doc=Perseus%3Atext%3A1999.01.0180%3Atext%3DCriti.%3Asection%3D108e", "reference", "Perseus Digital Library, Tufts University", "CC BY-SA 3.0 US (Perseus text page). Cited and linked only; our wording, nothing copied.",
    "Plato's dialogue Critias, where the speaker describes Atlantis as a great island that later sank in earthquakes; the notes point back to Plato's Timaeus 23e-24e."),
  s("gutenberg-1571", "Critias, by Plato, translated by Benjamin Jowett (Project Gutenberg eBook 1571)", "https://www.gutenberg.org/ebooks/1571", "reference", "Project Gutenberg", "Public domain in the USA (Project Gutenberg catalog page). Linked; nothing copied.",
    "Free public-domain English translation of Plato's Critias (Jowett).", { verified: "opened directly (HTTP 200) on 2026-11-26; a later re-check the same day returned HTTP 503 (site busy)" }),
  s("banrep-balsa-muisca", "Balsa muisca (Enciclopedia, Banco de la República)", "https://enciclopedia.banrepcultural.org/Balsa_muisca", "official", "Banco de la República de Colombia (Red Cultural / Museo del Oro)", "[UNKNOWN] reuse terms; cited and linked only, our wording.",
    "Spanish-language encyclopedia article on the gold Muisca raft found in 1969 in a cave near Pasca, which is linked to the ceremony Spanish chroniclers called El Dorado."),
  s("banrep-creacion-mito", "La creación de un mito (exhibition text, Banco de la República)", "https://www.banrepcultural.org/exposiciones/ofrendas-para-cuidar-el-mundo/la-creacion-de-un-mito", "official", "Banco de la República de Colombia (Red Cultural / Museo del Oro)", "[UNKNOWN] reuse terms; cited and linked only, our wording.",
    "Spanish-language exhibition text on how a Muisca offering ceremony told to Europeans in the 16th century grew into the El Dorado legend."),
  s("lion-lost-horizon", "Lost horizon, by James Hilton (library catalog record, Essex Library Association)", "https://ex.catalog.lionlibraries.org/Record/.b16017894", "reference", "Essex Library Association (LION libraries catalog)", "Catalog facts only (title, author, publisher, year, summary); nothing copied.",
    "Library catalog record: Lost horizon by James Hilton (1900-1954), New York, William Morrow & Co., 1933; summary says the story is set in Shangri-La in the Himalayas."),
  s("loc-hilton-authority", "Hilton, James, 1900-1954 (Library of Congress name authority)", "https://id.loc.gov/authorities/names/n81004128.html", "official", "US Library of Congress", "Catalog facts only; nothing copied.",
    "Library of Congress authority record for the novelist James Hilton: born 9 September 1900, died 20 December 1954."),
];
