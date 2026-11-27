// Ancient World layer content (authoring input for tools/atlas/build-ancient.mjs). Our own wording, CC BY 4.0.
// Dates are astronomical years (1 BCE = 0, so N BCE = -(N-1)); "label" keeps the source's own era wording.
// Rows: [date, event, sourceId, { end, approximate }]. Facts: [label, value, sourceId]. Gaps say [UNKNOWN].
// Pins (owner YES 2026-11-27): all 13 sites are shown. Twelve sacred, Indigenous, burial or ritual sites use
// the official UNESCO World Heritage Centre point published in that property's maps table
// (https://whc.unesco.org/en/list/<id>/maps/), cited with the official DMS; a serial or multi-component
// property uses the named component point and says so. Pompeii keeps its Pleiades representative point
// (CC BY 3.0). Every pin is approximate, not a boundary. Myths have no pins. A future "hold" still ships
// no coordinates until a site-by-site YES.
const U = "[UNKNOWN]";
const A = { approximate: true };
const R = (end) => ({ end, approximate: true });

export const SITES = [
  { id: "ancient-goebekli-tepe", title: "Göbekli Tepe", aliases: ["Gobekli Tepe"], country: "TR", label: "Göbekli Tepe, Şanlıurfa Province, Türkiye",
    pin: { from: "unesco", lat: 37.223242, lng: 38.922364, dms: "N37 13 23.671 E38 55 20.51", list: 1572, property: "Göbekli Tepe", pleiades: 245438984, wikidata: "Q214944" },
    everyday: "Göbekli Tepe in southeast Türkiye is a hilltop with huge carved stone pillars set up by hunter-gatherers around 9600 to 8200 BC, thousands of years before writing or cities.",
    student: "UNESCO describes monumental enclosures built by hunter-gatherer groups in the Pre-Pottery Neolithic (10th-9th millennia BC), with T-shaped limestone pillars up to 5.5 m tall, some carved as stylised human figures and with wild animals. Pleiades dates the sanctuary to about 9600-8200 BC. It was inscribed on the World Heritage List in 2018.",
    timeline: [["-9599", "Pre-Pottery Neolithic hilltop sanctuary in use (about 9600-8200 BC)", "pleiades-245438984", R("-8199")], ["2018", "Inscribed on the World Heritage List", "unesco-whc-1572"]],
    facts: [["Builders", "Hunter-gatherer groups of the Pre-Pottery Neolithic", "unesco-whc-1572"], ["Pillars", "T-shaped limestone pillars, some up to 5.50 m tall", "unesco-whc-1572"]],
    status: "World Heritage site", sources: ["unesco-whc-1572", "pleiades-245438984", "wikidata-p625"],
    unknowns: ["what the enclosures were used for is an interpretation (UNESCO says 'probably' social events and rituals)"], confidence: "high" },

  { id: "ancient-ur", title: "Ur", aliases: ["Tell el-Muqayyar"], country: "IQ", label: "Ur, Dhi Qar Governorate, Iraq",
    pin: { from: "unesco", lat: 30.963056, lng: 46.103056, dms: "N30 57 47 E46 6 11", list: 1481, component: "1481-006", component_name: "Ur Archaeological City", property: "The Ahwar of Southern Iraq: Refuge of Biodiversity and the Relict Landscape of the Mesopotamian Cities", pleiades: 912985, wikidata: "Q5699" },
    everyday: "Ur in southern Iraq was one of the first big cities. It was founded around 3800 BC and is known for its ziggurat temple tower and its Royal Cemetery.",
    student: "Pleiades describes Ur as a major Sumerian city-state founded in the Ubaid period (about 3800 BC), known for the Royal Cemetery and the ziggurat, and later the capital of the Ur III dynasty. UNESCO lists Ur, with Uruk and Eridu, as the Ahwar of Southern Iraq's three cultural parts (inscribed 2016): cities on the edge of freshwater marshes where writing and monumental mud-brick temples first appeared. The pin is UNESCO's official point for the Ur Archaeological City component of that property.",
    timeline: [["-3799", "Founded in the Ubaid period (about 3800 BC)", "pleiades-912985", A], ["2016", "Inscribed as part of the Ahwar of Southern Iraq", "unesco-whc-1481"]],
    facts: [["Known for", "Royal Cemetery and the ziggurat", "pleiades-912985"], ["Later role", "Capital of the Ur III dynasty (dates [UNKNOWN] in our sources)", "pleiades-912985"], ["Landscape", "Built at the margin of freshwater marshes", "unesco-whc-1481"]],
    status: "World Heritage site (component of a mixed property)", sources: ["pleiades-912985", "unesco-whc-1481", "wikidata-p625"],
    unknowns: ["dates of the Ur III dynasty", "when the city was abandoned"], confidence: "high" },

  { id: "ancient-caral", title: "Caral", aliases: ["Sacred City of Caral-Supe"], country: "PE", label: "Caral, Supe valley, Lima Region, Peru",
    pin: { from: "unesco", lat: -10.891667, lng: -77.521389, dms: "S10 53 30 W77 31 17", list: 1269, property: "Sacred City of Caral-Supe", pleiades: null, wikidata: "Q219279" },
    everyday: "Caral in Peru's Supe valley is a 5,000-year-old city with large stone pyramid platforms. UNESCO regards it as the Americas' oldest civilisation centre.",
    student: "UNESCO dates Caral by radiocarbon to between 3000 and 1800 BC, in the Late Archaic period. The 626 ha site has six pyramidal structures, and a quipu (knotted-cord record) was found there. UNESCO regards it as the Americas' oldest civilisation centre. It was inscribed in 2009.",
    timeline: [["-2999", "Occupied in the Late Archaic period (radiocarbon dates 3000-1800 BC)", "unesco-whc-1269", R("-1799")], ["2009", "Inscribed on the World Heritage List", "unesco-whc-1269"]],
    facts: [["Area", "626 ha", "unesco-whc-1269"], ["Monuments", "Six pyramidal structures", "unesco-whc-1269"], ["Find", "A quipu (knotted-cord record)", "unesco-whc-1269"]],
    status: "World Heritage site", sources: ["unesco-whc-1269", "wikidata-p625"],
    unknowns: [], confidence: "high" },

  { id: "ancient-giza", title: "Giza pyramids", aliases: ["Giza Necropolis", "Giza pyramid complex"], country: "EG", label: "Giza plateau, Giza Governorate, Egypt",
    pin: { from: "unesco", lat: 29.976040, lng: 31.130410, dms: "N29 58 33.744 E31 7 49.476", list: 86, component: "86-002", component_name: "Pyramid fields from Giza to Dahshur", property: "Memphis and its Necropolis – the Pyramid Fields from Giza to Dahshur", pleiades: 442962448, wikidata: "Q12508" },
    everyday: "The pyramids of Giza in Egypt are royal tombs from the Old Kingdom. Of the ancient Seven Wonders, only Khufu's Great Pyramid still stands.",
    student: "Pleiades records the Giza Necropolis, with its pyramid complexes, in the Old Kingdom period, which it dates to 2670-2168 BC. UNESCO lists the Giza pyramid fields within Memphis and its Necropolis, the Old Kingdom capital, inscribed in 1979, and notes that, of the ancient world's wonders, only Khufu's Great Pyramid still stands. The pin is UNESCO's official point for the Giza-to-Dahshur pyramid-fields component of that property, which also includes the Site of Memphis.",
    timeline: [["-2669", "Old Kingdom period (2670-2168 BC in the Pleiades chronology), when the pyramid complexes were built", "pleiades-period-old-kingdom-egypt", R("-2167")], ["1979", "Inscribed as part of Memphis and its Necropolis", "unesco-whc-86"]],
    facts: [["Wonder", "Of the ancient world's wonders, only Khufu's Great Pyramid still stands", "unesco-whc-86"], ["Setting", "Necropolis of Memphis, the Old Kingdom capital", "unesco-whc-86"]],
    status: "World Heritage site", sources: ["pleiades-442962448", "pleiades-period-old-kingdom-egypt", "unesco-whc-86", "wikidata-p625"],
    unknowns: ["exact build years of each pyramid are not in our cited sources"], confidence: "high" },

  { id: "ancient-mohenjo-daro", title: "Mohenjo-daro", aliases: ["Moenjodaro", "Mohenjodaro"], country: "PK", label: "Mohenjo-daro, Larkana District, Sindh, Pakistan",
    pin: { from: "unesco", lat: 27.329167, lng: 68.138889, dms: "N27 19 45 E68 8 20", list: 138, property: "Archaeological Ruins at Moenjodaro", pleiades: 902113570, wikidata: "Q5725" },
    everyday: "Mohenjo-daro in Pakistan was a large planned city of the Indus civilization, with straight streets, baked-brick houses and covered drains, more than 4,000 years ago.",
    student: "UNESCO describes Mohenjo-daro as South Asia's most intact city site, from the early third millennium BC, and as the Indus civilisation's main metropolis, which flourished about 2500-1500 BC. Streets cross at right angles and it has a drainage system, wells and public baths. The ruins were found in 1922 and inscribed in 1980.",
    timeline: [["-2999", "The city dates from the early third millennium BC", "unesco-whc-138", A], ["-2499", "Indus civilization flourishes (about 2500-1500 BC)", "unesco-whc-138", R("-1499")], ["1922", "Discovery of the ruins", "unesco-whc-138"], ["1980", "Inscribed on the World Heritage List", "unesco-whc-138"]],
    facts: [["Plan", "Streets laid out at right angles, with an elaborate drainage system", "unesco-whc-138"], ["Location", "Right bank of the Indus, 28 km from Larkana", "unesco-whc-138"], ["Gazetteer", "A third-millennium-BC Harappan city", "pleiades-902113570"]],
    status: "World Heritage site", sources: ["unesco-whc-138", "pleiades-902113570", "wikidata-p625"],
    unknowns: ["the Indus script: its reading is not covered by our cited sources", "when and why the city was abandoned"], confidence: "high" },

  { id: "ancient-troy", title: "Troy (Hisarlık)", aliases: ["Troia", "Ilion", "Hisarlik"], country: "TR", label: "Hisarlık mound, Çanakkale Province, Türkiye",
    pin: { from: "unesco", lat: 39.956440, lng: 26.239000, dms: "N39 57 23.184 E26 14 20.4", list: 849, property: "Archaeological Site of Troy", pleiades: 550595, wikidata: "Q22647" },
    everyday: "Troy is a mound of many cities built on top of each other in northwest Türkiye. It is generally believed to be the Troy of Homer's Iliad.",
    student: "Pleiades records occupation at Ilion/Troia from an Early Bronze Age citadel in the 3rd millennium BC to the Roman period, and says the Hisarlık mound is generally believed to be Homer's Troy. UNESCO counts about 4,000 years of history, notes first excavations in 1870 and 24 excavation campaigns, and inscribed the site in 1998.",
    timeline: [["-2999", "Early Bronze Age citadel (3rd millennium BC) begins the settlement", "pleiades-550595", A], ["1870", "First excavations at the site", "unesco-whc-849"], ["1998", "Inscribed on the World Heritage List", "unesco-whc-849"]],
    facts: [["Identification", "Generally believed to be Homer's Troy (Pleiades wording)", "pleiades-550595"], ["Location", "Some 4.8 km off the Dardanelles' south mouth", "unesco-whc-849"]],
    status: "World Heritage site", sources: ["pleiades-550595", "unesco-whc-849", "wikidata-p625"],
    unknowns: ["whether a Trojan War happened as told in the Iliad is not settled by our cited sources"], confidence: "high" },

  { id: "ancient-merv", title: "Merv", aliases: ["Ancient Merv", "Marv"], country: "TM", label: "Ancient Merv, Mary Province, Turkmenistan",
    pin: { from: "unesco", lat: 37.664831, lng: 62.174892, dms: "N37 39 53.39 E62 10 29.61", list: 886, component: "886-001", component_name: "Historic urban centre of the Merv oasis, Erk and Gyaur Kala and Sultan Kala", property: "State Historical and Cultural Park “Ancient Merv”", pleiades: 961873, wikidata: "Q193325" },
    everyday: "Merv in Turkmenistan was a great oasis city on the Silk Roads. Its ruins hold several walled cities built side by side over more than 2,000 years.",
    student: "UNESCO describes Ancient Merv as Central Asia's most intact Silk Road oasis city, and the earliest of those that survive so fully, with towns from the third millennium BC, Bronze Age settlements (2500-1200 BC), and a high point when it served as the Great Seljuks' capital in the 11th and 12th centuries. Pleiades notes walled cities from the 6th century BC to the 18th century. Inscribed 1999. The pin is UNESCO's official point for the historic urban centre of the Merv oasis (Erk and Gyaur Kala and Sultan Kala), one component of this serial property; the property page itself publishes no single coordinate.",
    timeline: [["-2499", "Bronze Age centres in the oasis (2500-1200 BC)", "unesco-whc-886", R("-1199")], ["-599", "Walled cities built from the 6th century BC to the 18th century", "pleiades-961873", R("1799")], ["1999", "Inscribed on the World Heritage List", "unesco-whc-886"]],
    facts: [["Role", "Oasis city on the Silk Roads", "unesco-whc-886"], ["Peak", "Capital of the Great Seljuks, 11th-12th centuries", "unesco-whc-886"], ["Area", "353 ha inscribed, 883 ha buffer zone", "unesco-whc-886"]],
    status: "World Heritage site", sources: ["unesco-whc-886", "pleiades-961873", "wikidata-p625"],
    unknowns: ["population at its peak"], confidence: "high" },

  { id: "ancient-palmyra", title: "Palmyra", aliases: ["Tadmor"], country: "SY", label: "Palmyra, Homs Governorate, Syria",
    pin: { from: "unesco", lat: 34.554167, lng: 38.266667, dms: "N34 33 15 E38 16 0", list: 23, property: "Site of Palmyra", pleiades: 668331, wikidata: "Q5747" },
    everyday: "Palmyra was a desert oasis city in Syria on caravan routes. UNESCO has listed it as World Heritage in Danger since 2013. Several of its best-known monuments were destroyed in 2015.",
    student: "UNESCO notes Palmyra is first mentioned in the Mari archives in the 2nd millennium BC, passed into Roman hands around the middle of the first century AD, and is known for 1st-2nd century art and architecture, including a 1,100 m colonnaded street. Pleiades notes it was the capital of the Palmyrene Empire under Zenobia. UN satellite analysis (UNITAR-UNOSAT) dates the destruction of the Baalshamin Temple to 25-27 August 2015, the Temple of Bel to 30 August 2015 and the Arch of Triumph to 5 October 2015. Its present condition and any restoration are [UNKNOWN] in our sources; see the UNESCO page.",
    timeline: [["-1999", "First mentioned in the Mari archives (2nd millennium BC)", "unesco-whc-23", A], ["50", "Comes under Roman control (mid-1st century AD)", "unesco-whc-23", A], ["1980", "Inscribed on the World Heritage List", "unesco-whc-23"], ["2013", "Added to UNESCO's In Danger listing", "unesco-whc-23"],
      ["2015-08", "Baalshamin Temple destroyed (between 25 and 27 August 2015)", "unitar-chs-2016"], ["2015-08-30", "Temple of Bel destroyed with explosives", "unesco-news-1341"], ["2015-10-05", "Arch of Triumph destroyed", "unitar-chs-2016"], ["2016-03-25", "UNESCO statement listing the destroyed monuments and offering an assessment mission", "unesco-news-1471"]],
    facts: [["Danger listing", "UNESCO has classed the site as In Danger from 2013 to the present (UNESCO property page and In Danger listing, read 2026-11-27)", "unesco-whc-23"], ["Satellite check", "UNOSAT images of 27 and 31 August 2015 show the Temple of Bel destroyed", "unosat-1015"], ["Colonnaded street", "1,100 m long", "unesco-whc-23"], ["Later history", "Capital of the Palmyrene Empire under Zenobia; razed by Aurelian", "pleiades-668331"]],
    status: "World Heritage in Danger", status_note: "Damage and Danger-list status are from UNESCO and UN satellite sources, linked. We show no damage images and no conflict detail beyond the dated losses.",
    sources: ["unesco-whc-23", "unesco-news-1341", "unesco-news-1471", "unosat-1015", "unitar-chs-2016", "pleiades-668331", "wikidata-p625"],
    unknowns: ["current condition of the site after 2016", "status of any restoration work"], confidence: "high", sensitive: true },

  { id: "ancient-petra", title: "Petra", aliases: ["Raqmu"], country: "JO", label: "Petra, Ma'an Governorate, Jordan",
    pin: { from: "unesco", lat: 30.330560, lng: 35.443330, dms: "N30 19 50.016 E35 26 35.988", list: 326, property: "Petra", pleiades: 697725, wikidata: "Q5788" },
    everyday: "Petra in Jordan was the rock-cut capital of the Nabataeans, a trading people known for tombs and temples cut into sandstone.",
    student: "UNESCO links Petra to the Nabataean civilization of the 4th century BC to the 1st century AD, notes the area was inhabited since prehistoric times, and describes it as a caravan centre in Hellenistic and Roman times. Pleiades calls it the Nabataean capital. Inscribed 1985.",
    timeline: [["-399", "Nabataean civilization (4th century BC to 1st century AD)", "unesco-whc-326", R("100")], ["1985", "Inscribed on the World Heritage List", "unesco-whc-326"]],
    facts: [["Role", "Capital of the Nabataeans", "pleiades-697725"], ["Architecture", "Elaborate tomb and temple architecture and religious high places", "unesco-whc-326"], ["Trade", "Caravan centre in Hellenistic and Roman times", "unesco-whc-326"]],
    status: "World Heritage site", sources: ["unesco-whc-326", "pleiades-697725", "wikidata-p625"],
    unknowns: [], confidence: "high" },

  { id: "ancient-qin-mausoleum", title: "Mausoleum of the First Qin Emperor", aliases: ["Terracotta Army", "Qin Shihuang Mausoleum"], country: "CN", label: "Lintong District, near Xi'an, Shaanxi, China",
    pin: { from: "unesco", lat: 34.381417, lng: 109.253667, dms: "N34 22 53.1 E109 15 13.2", list: 441, component: "441-001", component_name: "Mausoleum of the First Qin Emperor", property: "Mausoleum of the First Qin Emperor", pleiades: 117715281, wikidata: "Q910180" },
    everyday: "Near Xi'an in China, the tomb of the first Qin emperor is guarded by thousands of life-size clay soldiers. Work began in 246 BCE and the army was found in 1974.",
    student: "UNESCO says the mausoleum of Qin Shihuang, who first unified China into one empire, was begun in 246 BCE; the mound still stands 51.3 m high, and nearly 200 pits hold thousands of life-size terracotta soldiers and horses and bronze chariots. Pleiades gives construction as 246-208 BCE and the discovery of the terracotta army as 1974. Inscribed 1987. The pin is UNESCO's official point for the mausoleum component; the property also includes the pits of the terracotta army at a separate official point.",
    timeline: [["-245", "Construction begins (246 BCE)", "unesco-whc-441", R("-207")], ["1974", "Terracotta army discovered", "pleiades-117715281"], ["1987", "Inscribed on the World Heritage List", "unesco-whc-441"]],
    facts: [["Mound height", "51.3 m", "unesco-whc-441"], ["Pits", "Nearly 200 accompanying pits", "unesco-whc-441"], ["Area", "56.25 square kilometres", "unesco-whc-441"]],
    status: "World Heritage site", sources: ["unesco-whc-441", "pleiades-117715281", "wikidata-p625"],
    unknowns: ["the inside of the main burial mound (not described in our cited sources)"], confidence: "high" },

  { id: "ancient-pompeii", title: "Pompeii", aliases: ["Pompei"], country: "IT", label: "Pompei, Campania, Italy",
    pin: { from: "pleiades", lat: 40.7494, lng: 14.4854, pleiades: 433032, wikidata: "Q43332", gap_km: 0.38 },
    everyday: "Pompeii was a Roman town in Italy buried by ash when Mount Vesuvius erupted in AD 79. It has been dug out bit by bit since the mid-1700s.",
    student: "UNESCO says the eruption of Vesuvius in AD 79 buried Pompeii mostly under volcanic ash and lapilli, while nearby Herculaneum vanished under pyroclastic flows; both have been progressively excavated since the mid-18th century. Inscribed 1997 with Herculaneum and Torre Annunziata.",
    timeline: [["79", "Buried by the eruption of Vesuvius", "unesco-whc-829"], ["1750", "Progressive excavation begins (mid-18th century)", "unesco-whc-829", A], ["1997", "Inscribed on the World Heritage List", "unesco-whc-829"]],
    facts: [["Buried by", "Volcanic ash and lapilli", "unesco-whc-829"], ["Gazetteer", "Destroyed by the Vesuvius eruption of AD 79", "pleiades-433032"]],
    status: "World Heritage site", sources: ["unesco-whc-829", "pleiades-433032", "wikidata-p625"],
    related: [["see-also", "disasters-overview"]],
    unknowns: ["founding date of the town (not in our cited sources)"], confidence: "high" },

  { id: "ancient-teotihuacan", title: "Teotihuacan", aliases: ["Pre-Hispanic City of Teotihuacan"], country: "MX", label: "Teotihuacan, State of Mexico, Mexico",
    pin: { from: "unesco", lat: 19.691670, lng: -98.841670, dms: "N19 41 30.012 W98 50 30.012", list: 414, property: "Pre-Hispanic City of Teotihuacan", pleiades: null, wikidata: "Q172613" },
    everyday: "Teotihuacan near Mexico City was a huge planned city with the Sun and Moon pyramids. It rose during the 1st through 7th centuries AD.",
    student: "UNESCO says Teotihuacan, about 50 km from Mexico City to the north-east, rose during the 1st through 7th centuries AD and is known for the Sun and Moon pyramids and the Temple of Quetzalcoatl. Inscribed 1987.",
    timeline: [["1", "The city rose during the 1st through 7th centuries AD", "unesco-whc-414", R("699")], ["1987", "Inscribed on the World Heritage List", "unesco-whc-414"]],
    facts: [["Monuments", "Pyramids of the Sun and Moon, Temple of Quetzalcoatl", "unesco-whc-414"], ["Location", "About 50 km from Mexico City, to the north-east", "unesco-whc-414"]],
    status: "World Heritage site", sources: ["unesco-whc-414", "wikidata-p625"],
    unknowns: [], confidence: "high" },

  { id: "ancient-great-zimbabwe", title: "Great Zimbabwe", aliases: ["Great Zimbabwe National Monument"], country: "ZW", label: "Great Zimbabwe, Masvingo Province, Zimbabwe",
    pin: { from: "unesco", lat: -20.271170, lng: 30.933269, dms: "S20 16 16.212 E30 55 59.768", list: 364, property: "Great Zimbabwe National Monument", pleiades: 322739224, wikidata: "Q209217" },
    everyday: "Great Zimbabwe is a stone-walled city in southern Africa built by Shona people between about AD 1100 and 1450. Its traders were linked to goods from China and Persia.",
    student: "UNESCO says Great Zimbabwe was built between AD 1100 and 1450 and founded in the 11th century by Bantu-speaking Shona people of the Iron Age; it held over 10,000 people in the 14th century and was abandoned around 1450. Beads of glass, and porcelain traced to China and to Persia, were found there. UNESCO states the site is unquestionably of Bantu origin; older stories giving it a foreign origin are legends. Inscribed 1986.",
    timeline: [["1100", "Built between AD 1100 and 1450", "unesco-whc-364", R("1450")], ["1450", "Abandoned (around 1450)", "unesco-whc-364", A], ["1986", "Inscribed on the World Heritage List", "unesco-whc-364"]],
    facts: [["Builders", "Shona people (Bantu, Iron Age); UNESCO: unquestionably of Bantu origin", "unesco-whc-364"], ["Population", "Over 10,000 in the 14th century", "unesco-whc-364"], ["Trade", "Beads of glass, and porcelain traced to China and to Persia, were found at the site", "unesco-whc-364"], ["Size", "About 80 ha", "pleiades-322739224"]],
    status: "World Heritage site", sources: ["unesco-whc-364", "pleiades-322739224", "wikidata-p625"],
    unknowns: ["why the city was abandoned (not settled in our cited sources)"], confidence: "high" },
];

// Myths and legends: no pins. Claims use the claim-status words of globedesk.claims/1.
export const MYTHS = [
  { id: "myth-atlantis", title: "Myth: Atlantis", aliases: ["Atlantis"],
    everyday: "Atlantis is an island in a story told by the Greek philosopher Plato. In the story it sank in earthquakes. No real site has been shown to be Atlantis.",
    student: "In Plato's dialogue Critias (108e), the speaker describes Atlantis as an island larger than Libya and Asia that later sank in earthquakes, and the notes point back to the Timaeus (23e-24e). The story's source is the text; a real island at a known place is not proven.",
    claims: [{ text: "The Atlantis story is told in Plato's dialogue Critias", status: "supported", sources: ["perseus-plato-critias-108e", "gutenberg-1571"] },
      { text: "Atlantis was a real place at a known location", status: "not-proven", sources: [], note: "No cited source places it; we draw no pin." }],
    dates: [], sources: ["perseus-plato-critias-108e", "gutenberg-1571"], unknowns: ["the date Plato wrote the Critias is not in our cited sources"] },
  { id: "myth-el-dorado", title: "Myth: El Dorado", aliases: ["El Dorado"],
    everyday: "El Dorado began as Spanish retellings of a Muisca ceremony in what is now Colombia, where a leader offered gold on a lake. It grew into a legend of a city of gold that was never found.",
    student: "Banco de la República (Museo del Oro) explains that a Muisca offering ceremony was told to Europeans in the 16th century and grew into the El Dorado legend. A gold Muisca raft found in 1969 in a cave near Pasca is linked to the ceremony Spanish chroniclers described. The ceremony is documented; a city of gold is not proven.",
    claims: [{ text: "Spanish chroniclers described a Muisca offering ceremony that became the El Dorado story", status: "supported", sources: ["banrep-creacion-mito", "banrep-balsa-muisca"] },
      { text: "A gold Muisca raft linked to the ceremony was found in 1969 near Pasca", status: "supported", sources: ["banrep-balsa-muisca"] },
      { text: "A city of gold existed at a known location", status: "not-proven", sources: [], note: "No cited source places one; we draw no pin." }],
    dates: [["1500", "Ceremony story told to Europeans (16th century)", "banrep-creacion-mito", R("1599")], ["1969", "Muisca gold raft found in a cave near Pasca", "banrep-balsa-muisca"]],
    sources: ["banrep-creacion-mito", "banrep-balsa-muisca"], unknowns: ["the exact year of the first written account is not in our cited sources"] },
  { id: "myth-shangri-la", title: "Myth: Shangri-La", aliases: ["Shangri-La"],
    everyday: "Shangri-La is a made-up valley in the Himalayas from James Hilton's 1933 novel Lost Horizon. It is fiction, not a lost city.",
    student: "A library catalog record of Lost horizon (New York: William Morrow & Co., 1933) by James Hilton (1900-1954, per the Library of Congress) summarises the novel as set in Shangri-La, a Himalayan place where time has almost stopped. The story's source is the novel; a real Shangri-La at a known place is not proven.",
    claims: [{ text: "Shangri-La comes from James Hilton's novel Lost Horizon (1933)", status: "supported", sources: ["lion-lost-horizon", "loc-hilton-authority"] },
      { text: "Shangri-La is a real place at a known location", status: "not-proven", sources: [], note: "No cited source places it; we draw no pin." }],
    dates: [["1933", "Lost Horizon published (William Morrow & Co.)", "lion-lost-horizon"]],
    sources: ["lion-lost-horizon", "loc-hilton-authority"], unknowns: ["the copyright status of the novel; we quote nothing from it"] },
];

export const OVERVIEW = {
  id: "ancient-world-overview", title: "Ancient World: sites, lost cities and myths", aliases: ["Ancient World", "Ancient civilizations", "Lost cities"],
  everyday: "A layer of 13 ancient sites, from Göbekli Tepe (about 9600 BC) to Great Zimbabwe, plus three myths with no pins. Every site pin is approximate. Optional approximate polity outlines come from Cliopatria.",
  student: "Twelve site pins are official UNESCO World Heritage Centre points, cited from each property's maps table with the official DMS (a named component point where the property is serial or mixed). Pompeii keeps its Pleiades representative point (CC BY 3.0). Dates come from UNESCO World Heritage pages and Pleiades and keep the sources' own era wording. Myths carry claim labels (supported or not-proven) and no coordinates. Polity outlines come from Cliopatria (Seshat Global History Databank, CC BY 4.0), a subset of 14 snapshot years from 3000 BCE to 1400 CE, simplified; borders are approximate. Cliopatria starts in 3400 BCE, so outlines for earlier sites are [UNKNOWN], and it has no outline at Caral, Great Zimbabwe, or Teotihuacan before 1000 CE.",
};
