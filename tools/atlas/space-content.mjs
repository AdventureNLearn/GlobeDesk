// Curated content for the Space race and launch sites layer (first batch). Facts come from NASA NSSDCA pages, the
// IAU Gazetteer of Planetary Nomenclature (Apollo 11 site name) and official agency pages (ESA, CNSA, Vandenberg SFB, NASA).
// Every fact names its source id (tools/atlas/space-sources.mjs). Gaps are [UNKNOWN]. Earth pins use one Wikidata (CC0)
// coordinate per site and are always approximate. Moon landing sites have lunar coordinates in the record and no Earth pin.
// Apollo 11 already exists in the history-places pack (apollo-11-1969): it is cross-linked from the overview, never duplicated.
// Cape Canaveral is deliberately one minimal generic point (owner pick): one fact, no dates, no local detail.
const AL = "nssdca-apollo-landings", LZ = "nssdca-luna-zond", LM = "nssdca-apollo-11-lm", IAU = "iau-statio-tranquillitatis";
const SPU = "nasa-sputnik-1957", EB = "esa-baikonur-steppes", EB2 = "esa-baikonur-cosmodrome", EK = "esa-europes-spaceport";
const CD = "cnsa-dongfanghong-1", CC = "cnsa-launch-centres", VS = "vsfb-history";
const FRAME = "Latitude and longitude as published by NSSDCA, referenced to the DE421 Mean Earth/Polar Axis lunar reference frame";

export const LAUNCH_SITES = [
  { id: "baikonur-cosmodrome", title: "Baikonur Cosmodrome", aliases: ["Baikonur", "Tyuratam"], country: "KZ", region: "Asia", wd: "wd-q177477",
    place: { label: "Baikonur Cosmodrome, Kazakhstan", lat: 45.9648, lng: 63.3051 },
    dates: [{ date: "1957-10-04", precision: "day", label: "Sputnik 1 launched from here (NASA)" }],
    everyday: "Baikonur Cosmodrome in Kazakhstan is where the Soviet Union launched Sputnik, the first artificial satellite, on 4 October 1957. ESA says Yuri Gagarin's first human spaceflight left from here too.",
    student: "NASA says Sputnik was launched from the Baikonur Cosmodrome on 4 October 1957. ESA says construction began in 1955 and that Yuri Gagarin's 12 April 1961 flight left from Launch Pad 1. The name came from a mining town about 370 km away, used to hide the real site.",
    measures: [{ label: "Sputnik 1 launch date", value: "4 October 1957", source: SPU }, { label: "Construction began (ESA)", value: "1955", source: EB }, { label: "First human spaceflight launch (ESA)", value: "12 April 1961", source: EB }],
    facts: [
      { text: "The Soviet Union launched Sputnik, the first artificial satellite, from the Baikonur Cosmodrome in Kazakhstan on 4 October 1957.", source: SPU },
      { text: "NASA describes Sputnik as about the size of a beach ball, roughly 23 inches across and under 190 pounds, circling Earth in about 98 minutes.", source: SPU },
      { text: "ESA says construction of the site began in 1955 and that Sputnik 1 reached orbit on a modified intercontinental ballistic rocket.", source: EB },
      { text: "ESA says Yuri Gagarin's 12 April 1961 flight, the first crewed orbit of Earth, left from Launch Pad 1.", source: EB },
      { text: "ESA says the Soviet name Baikonur came from a small mining town about 370 km from the real launch complex, which lies near Tyuratam; the nearby city was renamed Baikonur in 1998.", source: EB2 }],
    claims: [{ text: "Sputnik 1 was launched from Baikonur on 4 October 1957.", status: "supported", sources: [SPU, EB] }],
    unknowns: ["Roscosmos page: not opened (HTTP 500 on 2026-11-26), so not used [UNKNOWN]", "ESA's older page gives 45.6 N, 63.4 E for the site, about 40 km from the pin; which is closer to the launch pads: [UNKNOWN]"],
    related: [], see_also: [], confidence: "high" },
  { id: "kourou-guiana-space-centre", title: "Kourou, Guiana Space Centre", aliases: ["Europe's Spaceport", "Centre Spatial Guyanais"], country: "GF", region: "South America", wd: "wd-q308987",
    place: { label: "Guiana Space Centre near Kourou, French Guiana", lat: 5.2372, lng: -52.7606 },
    dates: [{ date: "1964", precision: "year", label: "Kourou chosen by the French government (ESA)" }],
    everyday: "Europe's Spaceport at Kourou in French Guiana is a launch base close to the equator. France chose the site in 1964, and the first launch from it was in 1968.",
    student: "ESA says France picked Kourou in 1964 after weighing 14 other candidate sites, the first launch was a Véronique in 1968, and Ariane rockets have flown from there since 1979. At about 5°3′ N it is just over 500 km from the equator, which helps rockets flying east.",
    measures: [{ label: "Latitude (ESA)", value: "about 5°3′ N, just over 500 km north of the equator", source: EK }, { label: "Chosen by France (ESA)", value: "1964, from 14 other sites", source: EK }, { label: "First launch (ESA)", value: "1968 (Véronique)", source: EK }, { label: "First Ariane launch (ESA)", value: "1979", source: EK }],
    facts: [
      { text: "ESA says France picked Kourou in 1964 as its satellite launch base, after weighing 14 other candidate sites.", source: EK },
      { text: "ESA's key dates list the first launch (a Véronique) in 1968, the first Diamant in 1970 and the first Ariane in 1979.", source: EK },
      { text: "ESA says the nearness to the equator saves fuel, and that the Atlantic coast opening lets rockets fly north and east without crossing populated land.", source: EK }],
    claims: [], unknowns: ["CNES page: not opened, so not used [UNKNOWN]", "ESA pages give the area as about 690 km² and about 700 km²; no single figure is shown [UNKNOWN]"],
    related: [], see_also: [], confidence: "high" },
  { id: "jiuquan-launch-center", title: "Jiuquan Satellite Launch Center", aliases: ["Jiuquan"], country: "CN", region: "Asia", wd: "wd-q692677",
    place: { label: "Jiuquan Satellite Launch Center, Gansu, China", lat: 40.9675, lng: 100.2786 },
    dates: [{ date: "1970-04-24", precision: "day", label: "China's first satellite launched from here (CNSA)" }],
    everyday: "Jiuquan Satellite Launch Center in Gansu, China, was the country's first satellite launch site. China's first satellite, Dongfanghong-1, was launched from here on 24 April 1970.",
    student: "China's space agency says the centre was started in 1958 and covers about 2,800 km². On 24 April 1970 a Long March 1 rocket carried Dongfanghong-1 into orbit, the centre's first satellite launch, which made China the fifth country to launch its own satellite.",
    measures: [{ label: "Construction started (CNSA)", value: "1958", source: CC }, { label: "Area (CNSA)", value: "about 2,800 km²", source: CC }, { label: "First satellite launch (CNSA)", value: "24 April 1970 (Dongfanghong-1, Long March 1)", source: CD }],
    facts: [
      { text: "CNSA says Jiuquan was the first satellite launch site built in China, started in 1958 in the north-east of Jiuquan city, Gansu province.", source: CC },
      { text: "CNSA says a Long March 1 rocket launched on 24 April 1970 and put China's first satellite, Dongfanghong-1, into orbit; it was Jiuquan's first satellite launch.", source: CD },
      { text: "CNSA says this made China the fifth country able to build and launch its own satellite, after the Soviet Union, the United States, France and Japan.", source: CD }],
    claims: [], unknowns: ["CNSA's English page on the centre has no text; the facts come from the Chinese-language pages [UNKNOWN] in English"],
    related: [], see_also: [], confidence: "medium" },
  { id: "vandenberg-launch-base", title: "Vandenberg Space Force Base", aliases: ["Vandenberg", "Vandenberg AFB"], country: "US", region: "North America", usRegion: "US-CA", wd: "wd-q461492",
    place: { label: "Vandenberg Space Force Base, California, United States", lat: 34.7379, lng: -120.5374 },
    dates: [{ date: "1959-02-28", precision: "day", label: "Discoverer 1 launched, the first polar-orbiting satellite (USSF)" }],
    everyday: "Vandenberg Space Force Base in California began as an Army camp in 1941. Its first missile launch was in December 1958, and in February 1959 it launched Discoverer 1, which the base calls the first polar-orbiting satellite.",
    student: "The Space Force says Camp Cooke was set up in 1941, passed to the Air Force in 1957 and was renamed Vandenberg Air Force Base on 4 October 1958. The first missile launch, a Thor, was on 16 December 1958 and Discoverer 1 followed on 28 February 1959. It became a Space Force Base on 14 May 2021.",
    measures: [{ label: "First missile launch (USSF)", value: "16 December 1958 (Thor)", source: VS }, { label: "Discoverer 1 launch (USSF)", value: "28 February 1959", source: VS }, { label: "Renamed Vandenberg Space Force Base (USSF)", value: "14 May 2021", source: VS }, { label: "Land (USSF)", value: "99,604 acres", source: VS }],
    facts: [
      { text: "The base began as the Camp Cooke Army garrison in August 1941 and was transferred to the new US Air Force in 1957.", source: VS },
      { text: "It was renamed Vandenberg Air Force Base on 4 October 1958; the first missile launch from it, a Thor, was on 16 December 1958.", source: VS },
      { text: "The base says the Discoverer 1 launch on 28 February 1959 lifted the world's first polar-orbiting satellite.", source: VS },
      { text: "Vandenberg Air Force Base was renamed Vandenberg Space Force Base on 14 May 2021.", source: VS }],
    claims: [], unknowns: ["The site's reuse notice: not opened (403 / 404), so its terms are [UNKNOWN]"],
    related: [], see_also: [], confidence: "high" },
  // Owner pick: one minimal generic launch-site point. One fact, no dates, no local detail beyond the site itself.
  { id: "cape-canaveral-launch-site", title: "Cape Canaveral launch site", aliases: ["Cape Canaveral"], country: "US", region: "North America", usRegion: "US-FL", wd: "wd-q334465", minimal: true,
    place: { label: "Cape Canaveral, Florida, United States", lat: 28.4889, lng: -80.5778 },
    dates: [],
    everyday: "Cape Canaveral is a US launch site in Florida. NASA's catalogue lists it as the launch site of the Apollo 11 mission.",
    student: "NASA's NSSDCA catalogue lists the launch site of the Apollo 11 Lunar Module's mission as Cape Canaveral, United States, on 1969-07-16. This entry is one generic point for the site and adds no local detail; the Apollo 11 entry covers the mission.",
    measures: [{ label: "Launch site named in NASA's catalogue", value: "Cape Canaveral, United States", source: LM }],
    facts: [{ text: "NASA's catalogue lists Cape Canaveral, United States, as the launch site of the Apollo 11 Lunar Module's mission (launched 16 July 1969, on a Saturn 5).", source: LM }],
    claims: [], unknowns: ["Everything else about the site: left out on purpose (owner pick: one generic point, no local detail)"],
    related: [["see-also", "apollo-11-1969"]], see_also: [], confidence: "high" },
];

export const LUNAR_SITES = [
  { id: "apollo-12-landing-site", title: "Apollo 12 landing site (Moon)", aliases: ["Apollo 12"], kind: "lunar-landing", mission: "Apollo 12", src: AL, region: "Oceanus Procellarum",
    lat: -3.013, lng: -23.422, lat_text: "3.013 S", lng_text: "23.422 W", launched: "1969-11-14", landed: "1969-11-19", eva_h: "7.75", traverse_km: "1.35", sample_kg: "34.35" },
  { id: "apollo-14-landing-site", title: "Apollo 14 landing site (Moon)", aliases: ["Apollo 14", "Fra Mauro"], kind: "lunar-landing", mission: "Apollo 14", src: AL, region: "Fra Mauro",
    lat: -3.646, lng: -17.472, lat_text: "3.646 S", lng_text: "17.472 W", launched: "1971-01-31", landed: "1971-02-05", eva_h: "9.38", traverse_km: "3.45", sample_kg: "42.28" },
  { id: "apollo-15-landing-site", title: "Apollo 15 landing site (Moon)", aliases: ["Apollo 15", "Hadley Rille"], kind: "lunar-landing", mission: "Apollo 15", src: AL, region: "Hadley Rille",
    lat: 26.132, lng: 3.633, lat_text: "26.132 N", lng_text: "3.633 E", launched: "1971-07-26", landed: "1971-07-30", eva_h: "19.13", traverse_km: "27.9", sample_kg: "77.31" },
  { id: "apollo-16-landing-site", title: "Apollo 16 landing site (Moon)", aliases: ["Apollo 16", "Descartes"], kind: "lunar-landing", mission: "Apollo 16", src: AL, region: "Descartes",
    lat: -8.973, lng: 15.501, lat_text: "8.973 S", lng_text: "15.501 E", launched: "1972-04-16", landed: "1972-04-20", eva_h: "20.23", traverse_km: "[UNKNOWN] (the page prints \"27.\")", sample_kg: "95.71" },
  { id: "apollo-17-landing-site", title: "Apollo 17 landing site (Moon)", aliases: ["Apollo 17", "Taurus-Littrow"], kind: "lunar-landing", mission: "Apollo 17", src: AL, region: "Taurus-Littrow",
    lat: 20.191, lng: 30.772, lat_text: "20.191 N", lng_text: "30.772 E", launched: "1972-12-07", landed: "1972-12-11", eva_h: "22.07", traverse_km: "[UNKNOWN] (the page prints \"35.\")", sample_kg: "110.52" },
  { id: "luna-9-landing-site", title: "Luna 9 landing site (Moon)", aliases: ["Luna 9"], kind: "robotic-landing", mission: "Luna 9", src: LZ, region: "Oceanus Procellarum",
    lat: 7.08, lng: 295.63, lat_text: "7.08 N", lng_text: "295.63 E", launched: "1966-01-31", landed: "1966-02-03", landed_time: "18:44:52 UT" },
  { id: "luna-16-landing-site", title: "Luna 16 landing site (Moon)", aliases: ["Luna 16"], kind: "robotic-landing", mission: "Luna 16", src: LZ, region: "Mare Fecunditatis",
    lat: -0.68, lng: 56.3, lat_text: "0.68 S", lng_text: "56.30 E", launched: "1970-09-12", landed: "1970-09-20", landed_time: "05:18:00 UT", sample: true },
];
export { FRAME };

// Existing Atlas events shown on the overview and cross-linked, never copied (not pinned by this layer).
export const LINKED = [
  { id: "apollo-11-1969", body: "moon", facts: [
    { text: "NSSDCA's Apollo table lists the launch on 16 July 1969, the landing on 20 July 1969 in Mare Tranquilitatis (spelling as printed) at 0.674 N, 23.473 E, 2.53 hours of moonwalk time and 21.55 kg of samples.", source: AL },
    { text: "The IAU Gazetteer names the point Statio Tranquillitatis, 'Tranquility Base, Apollo 11 landing site', centre 0.67 N, 23.47 E, name approved in 1970.", source: IAU },
    { text: "NASA's catalogue lists Cape Canaveral, United States, as the launch site.", source: LM }] },
];

export const OVERVIEW = {
  id: "space-overview", title: "Space race and launch sites", aliases: ["Space race", "Launch sites layer"],
  everyday: "Launch sites on Earth and landing sites on the Moon from the space race. Earth sites are pins; Moon sites are listed with their published lunar coordinates, because the globe shows Earth.",
  student: "A first batch from NASA NSSDCA, the IAU Gazetteer of Planetary Nomenclature and official agency pages. Earth launch sites are approximate pins (one Wikidata coordinate each, CC0). Moon landing sites carry lunar coordinates as published and have no Earth pin. Apollo 11 and Cape Canaveral stay deliberately minimal.",
  stories: [
    { id: "apollo-11-cape-to-tranquility", title: "Apollo 11: from Cape Canaveral to Tranquility Base", steps: [
      { entry: "cape-canaveral-launch-site", text: "Apollo 11 launched on 16 July 1969; NASA's catalogue lists Cape Canaveral, United States, as the launch site.", sources: [LM, AL] },
      { entry: "apollo-11-1969", text: "The Lunar Module landed on 20 July 1969 in Mare Tranquilitatis, at 0.674 N, 23.473 E on the Moon.", sources: [AL] },
      { entry: "apollo-11-1969", text: "The IAU Gazetteer names that point Statio Tranquillitatis, 'Tranquility Base'; its name was approved in 1970.", sources: [IAU] },
      { entry: "apollo-12-landing-site", text: "Five more landings followed, from Apollo 12 in November 1969 to Apollo 17 in December 1972; each site is in this layer with its NSSDCA coordinates.", sources: [AL] },
    ] },
    { id: "four-launch-sites-four-firsts", title: "Four launch sites, four firsts", steps: [
      { entry: "baikonur-cosmodrome", text: "4 October 1957: Sputnik, the first artificial satellite, launched from Baikonur.", sources: [SPU] },
      { entry: "vandenberg-launch-base", text: "28 February 1959: Vandenberg launched Discoverer 1, which the base calls the world's first polar-orbiting satellite.", sources: [VS] },
      { entry: "baikonur-cosmodrome", text: "12 April 1961: ESA says Yuri Gagarin lifted off from Baikonur's Launch Pad 1.", sources: [EB] },
      { entry: "jiuquan-launch-center", text: "24 April 1970: Jiuquan launched Dongfanghong-1, China's first satellite.", sources: [CD] },
      { entry: "kourou-guiana-space-centre", text: "Kourou, chosen by France in 1964, saw its first launch in 1968.", sources: [EK] },
    ] },
  ],
};
