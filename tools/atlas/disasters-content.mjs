// Curated content for the disasters layer (first batch). Numbers come from the NOAA NCEI Significant
// Volcanic Eruptions and Significant Earthquake databases (HazEL service, read 2026-11-26) and from
// USGS-authored pages; each fact names its source id (tools/atlas/disasters-sources.mjs). Gaps are
// [UNKNOWN]. Where two sources give different numbers, both are kept as a "people-disagree" claim.
// Mount St. Helens 1980 and San Francisco 1906 already exist in the history-places pack, and the
// 79 CE Vesuvius eruption is told from the Ancient World Pompeii entry: they are cross-linked from
// the overview (LINKED) and never duplicated here.
const V = "ncei-sig-volcanoes", Q = "ncei-sig-earthquakes", FAQ = "usgs-deadliest-eruptions", CLIM = "usgs-volcanoes-climate";
const HVO = "usgs-hvo-krakatau", YVO = "usgs-yvo-naples", L09 = "usgs-pubs-lisbon-farfield", L21 = "usgs-pubs-lisbon-source";

export const DISASTERS = [
  {
    id: "krakatau-1883", title: "Krakatau eruption, 1883", aliases: ["Krakatoa 1883", "Krakatau 1883"], hazard: "eruption",
    country: "ID", region: "Asia", ncei: { dataset: V, event_id: 2429 },
    place: { label: "Krakatau volcano, Indonesia", lat: -6.101, lng: 105.423, approximate: true, basis: "NCEI published volcano point for event 2429; one point stands for a whole volcano" },
    date: { date: "1883-08-27", precision: "day", label: "Eruption date in the NCEI catalogue", source: V },
    everyday: "In August 1883 the Krakatau volcano in Indonesia blew apart. The explosions were heard about 5,000 km away, and the tsunami that followed killed tens of thousands of people.",
    student: "NOAA NCEI lists the 27 August 1883 eruption of Krakatau at VEI 6, with 36,417 deaths in total. USGS gives about 36,000 and names the tsunami as the main cause. A USGS Volcano Watch article says about 25 km³ of material was thrown out, the island nearly vanished, and dust in the stratosphere lowered global temperatures.",
    measures: [
      { label: "Volcanic Explosivity Index (VEI)", value: "6", source: V },
      { label: "Deaths from the eruption itself (NCEI)", value: "2,000", source: V },
      { label: "Deaths in total, tsunami included (NCEI)", value: "36,417", source: V },
      { label: "Deaths (USGS deadliest-eruptions table)", value: "36,000 (36,417); main cause: tsunami", source: FAQ },
    ],
    facts: [
      { text: "NCEI files this eruption as a caldera volcano and links it to a tsunami record.", source: V },
      { text: "Explosions on 27 August 1883 were heard about 5,000 km away; USGS calls it the loudest and farthest-travelled sound in recorded history.", source: HVO },
      { text: "The island, about 30 km² before the eruption, nearly vanished. About 25 km³ of material was thrown out and the eruption column rose above 30 km.", source: HVO },
      { text: "Dust carried into the stratosphere lowered global temperatures and caused vivid sunsets.", source: HVO },
      { text: "A new volcano, Anak Krakatau, appeared about 50 years later.", source: HVO },
      { text: "USGS says the 1991 Pinatubo eruption disturbed the atmosphere probably less than Krakatau 1883 and Tambora 1815 did.", source: CLIM },
    ],
    claims: [{ text: "About 36,000 people died, most of them in the tsunami.", status: "supported", sources: [V, FAQ] }],
    unknowns: ["Hour-by-hour timeline of 26–27 August 1883: [UNKNOWN] in the sources checked", "Present-day activity: [UNKNOWN] (Smithsonian GVP not used; its terms are [UNKNOWN])"],
    related: [["see-also", "tambora-1815"]], confidence: "high",
  },
  {
    id: "tambora-1815", title: "Tambora eruption, 1815", aliases: ["Mount Tambora 1815"], hazard: "eruption",
    country: "ID", region: "Asia", ncei: { dataset: V, event_id: 367 },
    place: { label: "Mount Tambora, Indonesia", lat: -8.25, lng: 118, approximate: true, basis: "NCEI published volcano point for event 367; one point stands for a whole volcano" },
    date: { date: "1815-04-10", precision: "day", label: "Eruption date in the NCEI catalogue", source: V },
    everyday: "In April 1815 Mount Tambora in Indonesia erupted. Tens of thousands of people died, many of them later from hunger, and USGS says its effect on the atmosphere was probably bigger than that of Pinatubo in 1991.",
    student: "NOAA NCEI rates the eruption of 10 April 1815 at VEI 7, the highest in this batch, and counts 11,000 direct deaths and 60,000 in total. The USGS deadliest-eruptions table gives 92,000, mainly from starvation. The two totals disagree, so both are shown.",
    measures: [
      { label: "Volcanic Explosivity Index (VEI)", value: "7", source: V },
      { label: "Deaths from the eruption itself (NCEI)", value: "11,000", source: V },
      { label: "Deaths in total (NCEI)", value: "60,000", source: V },
      { label: "Deaths (USGS deadliest-eruptions table)", value: "92,000; main cause: starvation", source: FAQ },
    ],
    facts: [
      { text: "NCEI files Tambora as a stratovolcano and links this eruption to a tsunami record.", source: V },
      { text: "USGS says the 1991 Pinatubo eruption disturbed the atmosphere probably less than Krakatau 1883 and Tambora 1815 did; sulfate aerosols from big eruptions cool the climate.", source: CLIM },
    ],
    claims: [{ text: "How many people died.", status: "people-disagree", sources: [V, FAQ],
      positions: [{ text: "60,000 in total, 11,000 of them directly (NCEI).", source: V }, { text: "92,000, mainly from starvation (USGS table).", source: FAQ }] }],
    unknowns: ["Why the death totals differ: [UNKNOWN]", "Effects on harvests or weather in other countries in 1816: [UNKNOWN] in the sources checked"],
    related: [["see-also", "krakatau-1883"]], confidence: "medium",
  },
  {
    id: "lisbon-1755", title: "Lisbon earthquake and tsunami, 1755", aliases: ["Great Lisbon earthquake", "1755 Lisbon earthquake"], hazard: "earthquake",
    country: "PT", region: "Europe", ncei: { dataset: Q, event_id: 1339 },
    place: { label: "Epicentre at sea off Portugal", lat: 37, lng: -10, approximate: true, basis: "NCEI published epicentre for event 1339, given to whole degrees; the true source is debated" },
    date: { date: "1755-11-01", precision: "day", label: "Earthquake date in the NCEI catalogue", source: Q },
    everyday: "On 1 November 1755 a great earthquake struck under the Atlantic off Portugal. A study listed by USGS describes it as the most destructive quake Europe has known, and its tsunami reached coasts on both sides of the ocean.",
    student: "NOAA NCEI lists magnitude 8.5 (Mw), intensity XI on the Modified Mercalli scale and 50,000 deaths, and links a tsunami. A 2009 study estimated Mw 8.5–9.0 and put the tsunami at about 5–15 m on the shores of Portugal and Morocco, with accounts from Caribbean islands, Brazil and Newfoundland. Where the fault lies is still debated.",
    measures: [
      { label: "Magnitude (Mw, NCEI)", value: "8.5", source: Q },
      { label: "Magnitude estimate (2009 study)", value: "Mw 8.5–9.0", source: L09 },
      { label: "Modified Mercalli intensity (NCEI)", value: "XI", source: Q },
      { label: "Deaths (NCEI)", value: "50,000", source: Q },
    ],
    facts: [
      { text: "NCEI links this earthquake to a tsunami record.", source: Q },
      { text: "The study reports that the tsunami climbed roughly 5 to 15 m up the shores of Portugal and Morocco, and that the Azores and Madeira also saw large waves.", source: L09 },
      { text: "Accounts from far across the Atlantic, from Caribbean islands, Brazil and Newfoundland, show the waves travelled the whole ocean.", source: L09 },
    ],
    claims: [
      { text: "The earthquake was about magnitude 8.5 or larger.", status: "supported", sources: [Q, L09] },
      { text: "Where the fault that broke lies.", status: "people-disagree", sources: [L09, L21],
        positions: [{ text: "Simulations put the source south of Gorringe Bank, in the Horseshoe Plain area (2009 study).", source: L09 }, { text: "The exact source is still uncertain; the Marquês de Pombal fault fitted the geologic record best (2021 study).", source: L21 }] },
    ],
    unknowns: ["Exact epicentre: [UNKNOWN]; the pin is NCEI's whole-degree point", "Death tolls from other sources: not reviewed [UNKNOWN]"],
    related: [["see-also", "earthquakes-and-plate-faults"]], confidence: "medium",
  },
];

// Existing Atlas events shown on the layer and in the overview, never copied. Extra facts cite NCEI/USGS.
export const LINKED = [
  { id: "mount-st-helens-1980", hazard: "eruption", facts: [
    { text: "NCEI rates the eruption VEI 5 and counts 57 direct deaths (61 in total).", source: V },
    { text: "The USGS deadliest-eruptions table also gives 57 deaths, from ash asphyxiation.", source: FAQ }] },
  { id: "san-francisco-earthquake-1906", hazard: "earthquake", facts: [
    { text: "NCEI lists magnitude 7.9 (Mw) and 700 deaths; other published tolls were not reviewed [UNKNOWN].", source: Q }] },
  { id: "ancient-pompeii", hazard: "eruption",
    ncei: { dataset: V, event_id: 1348 },
    unknowns: [
      "Other published dates for the eruption: not reviewed [UNKNOWN]; only the NCEI date is shown",
      "Deep-time clock: 79 CE sits before the America 250 clock; it joins the Ancient-world deep-time clock when that lands",
    ],
    facts: [
    { text: "NCEI rates the 79 CE eruption of Vesuvius VEI 5 and counts 2,100 deaths, dated 25 August 79.", source: V },
    { text: "The USGS deadliest-eruptions table gives 3,360, mainly from pyroclastic flow.", source: FAQ },
    { text: "The 79 CE eruption buried Herculaneum and Pompeii and was described in letters by Pliny the Younger.", source: YVO },
    { text: "USGS counts eight major explosive eruptions since a caldera formed about 17,000 years ago.", source: YVO },
    { text: "Eruptions were frequent from 1631 to 1944; the most recent eruption was in 1944.", source: YVO },
    { text: "The INGV Vesuvius Observatory, founded in 1841, is the first volcano observatory in the world.", source: YVO },
    { text: "NCEI links this eruption to an earthquake record and a tsunami record.", source: V },
    { text: "NOAA NCEI Significant Volcanic Eruptions Database, event 1348", source: V },
    { text: "Other published dates for the eruption: not reviewed [UNKNOWN]; only the NCEI date is shown", source: V },
    ] },
];

export const OVERVIEW = {
  id: "disasters-overview", title: "Volcanoes, earthquakes and disasters", aliases: ["Natural hazards", "Disasters layer"],
  everyday: "Famous eruptions and earthquakes on the globe, from Vesuvius in 79 CE to Mount St. Helens in 1980. Most pins are official published points from NOAA; the Vesuvius 79 link uses Pompeii's Pleiades point. Every number names its source.",
  student: "A curated first batch from the NOAA NCEI Significant Volcanic Eruptions and Significant Earthquake databases (doi:10.7289/V5JW8BSH, doi:10.7289/V5TD9V7K), with USGS pages for context. Where NCEI and USGS give different death tolls, both are shown. Pins are NCEI's published points, so they are approximate, except the Vesuvius 79 link, which uses Pompeii's Pleiades point.",
  stories: [
    { id: "lisbon-three-coasts", title: "Lisbon 1755: one earthquake, three coasts", steps: [
      { entry: "lisbon-1755", text: "On 1 November 1755 a great earthquake struck under the Atlantic off Portugal. NCEI lists magnitude 8.5 and 50,000 deaths.", sources: [Q] },
      { entry: "lisbon-1755", text: "A tsunami followed. On the shores of Portugal and Morocco it climbed roughly 5 to 15 m, and the Azores and Madeira also saw large waves.", sources: [L09] },
      { entry: "lisbon-1755", text: "The waves crossed the ocean: far-away accounts come from Caribbean islands, Brazil and Newfoundland.", sources: [L09] },
      { entry: "lisbon-1755", text: "Scientists still disagree about which fault broke. One study modelled a source south of Gorringe Bank; a later one found the Marquês de Pombal fault fitted best.", sources: [L09, L21] },
      { entry: "earthquakes-and-plate-faults", text: "Next: the Atlas entry on earthquakes and plate faults, for how faults break.", sources: ["usgs-earthquakes-faq"] },
    ] },
    { id: "eruptions-felt-worldwide", title: "Tambora 1815 and Krakatau 1883: eruptions felt worldwide", steps: [
      { entry: "tambora-1815", text: "April 1815: Tambora erupts. NCEI rates it VEI 7, the highest in this batch.", sources: [V] },
      { entry: "tambora-1815", text: "The death toll is disputed: NCEI counts 60,000 in total, USGS 92,000, mostly from starvation.", sources: [V, FAQ] },
      { entry: "krakatau-1883", text: "August 1883: Krakatau explodes. The sound was heard about 5,000 km away.", sources: [HVO] },
      { entry: "krakatau-1883", text: "The tsunami killed most of the roughly 36,000 victims.", sources: [V, FAQ] },
      { entry: "krakatau-1883", text: "Both eruptions put sulfate aerosols high into the atmosphere, and USGS says that cools the climate. Krakatau's dust lowered global temperatures and caused vivid sunsets.", sources: [CLIM, HVO] },
      { entry: "mount-st-helens-1980", text: "Compare a modern eruption: Mount St. Helens in 1980 was VEI 5, with 57 deaths.", sources: [V, FAQ] },
    ] },
  ],
};
