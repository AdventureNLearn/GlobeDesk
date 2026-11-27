// Curated content for the Wonders layer (first batch): the seven winners of the 2007 New7Wonders popular vote,
// labelled everywhere as an UNOFFICIAL popular vote run by a private foundation (UNESCO says it has no link to it).
// Facts come from UNESCO World Heritage pages, UNESCO's 2007 statement, NASA and the organisation's own FAQ page for the
// date and the list. Every fact names its source id (tools/atlas/wonders-sources.mjs). Own words only; no logos.
// Petra already belongs to the Ancient layer (ancient-petra, not in this copy yet): it is a deferred cross-link, never a second entry.
// Five wonders get one approximate pin (one Wikidata CC0 point). The Great Wall is a line thousands of km long: no pin.
const N7 = "new7wonders-faq", UN = "unesco-news-new7wonders", NASA = "nasa-great-wall";
const W = (n) => `unesco-whc-${n}`;
export const VOTE_DATE = "2007-07-07";
export const UNOFFICIAL = "Unofficial: one of seven sites named in a private popular vote announced on 7 July 2007. This is not a UNESCO list and UNESCO says it has no link to it.";

export const WONDERS = [
  { id: "wonder-taj-mahal", title: "Taj Mahal (New Seven Wonders, unofficial vote)", aliases: ["Taj Mahal", "Agra"], country: "IN", region: "Asia", whc: 252, wd: "wd-q9141", inscribed: "1983",
    place: { label: "Taj Mahal, Agra, India", lat: 27.175, lng: 78.0419 },
    everyday: "The Taj Mahal in Agra, India, was one of seven sites named in an unofficial 2007 popular vote. UNESCO says Mughal Emperor Shah Jahan had it built to commemorate his wife Mumtaz Mahal, between 1632 and 1648.",
    student: "UNESCO says the Taj Mahal is in Agra District, Uttar Pradesh, on the Yamuna's right bank, inside a Mughal garden of nearly 17 hectares. Work began in 1632 and the main building was done in 1648; the mosque, guest house, gateway and outer courtyard were finished by 1653. It was inscribed on the World Heritage List in 1983. This entry is about the site; the 2007 vote is an unofficial popular vote.",
    measures: [{ label: "Main construction (UNESCO)", value: "1632 to 1648; outer parts finished by 1653", source: W(252) }, { label: "Garden area (UNESCO)", value: "nearly 17 hectares", source: W(252) }, { label: "World Heritage inscription", value: "1983", source: W(252) }],
    facts: [{ text: "UNESCO places the Taj Mahal in Agra District, Uttar Pradesh, on the Yamuna's right bank, inside a Mughal garden.", source: W(252) },
      { text: "UNESCO says Mughal Emperor Shah Jahan had it built to commemorate his wife Mumtaz Mahal; work began in 1632 and the main building was finished in 1648.", source: W(252) },
      { text: "UNESCO says the mosque, guest house, south gateway and outer courtyard with its cloisters were added afterwards and finished by 1653.", source: W(252) },
      { text: "The organisation behind the 2007 vote lists the Taj Mahal (India) among its seven winners.", source: N7 }],
    claims: [], unknowns: ["Statue and marble figures and visitor numbers: not looked up [UNKNOWN]"] },
  { id: "wonder-colosseum", title: "Colosseum (New Seven Wonders, unofficial vote)", aliases: ["Colosseum", "Rome"], country: "IT", region: "Europe", whc: 91, wd: "wd-q10285", inscribed: "1980",
    place: { label: "Colosseum, Rome, Italy", lat: 41.8903, lng: 12.4922 },
    everyday: "The Colosseum in Rome, Italy, was one of seven sites named in an unofficial 2007 popular vote. UNESCO lists it among the monuments of antiquity in the Historic Centre of Rome, inscribed in 1980.",
    student: "UNESCO names the Colosseum among the monuments of antiquity in the Historic Centre of Rome, which it inscribed in 1980; the whole property covers 1,469.7 hectares, not the Colosseum alone. UNESCO also cites the Colosseum's restoration as an early case of the scholarly restoration principles first tested in Rome. This entry is about the site; the 2007 vote is an unofficial popular vote.",
    measures: [{ label: "World Heritage inscription (Historic Centre of Rome, the whole property)", value: "1980", source: W(91) }, { label: "Area of the whole World Heritage property (not the Colosseum alone)", value: "1,469.7 hectares", source: W(91) }],
    facts: [{ text: "UNESCO names the Colosseum, with the Pantheon and the Roman and Imperial Forums, among the monuments of antiquity in the Historic Centre of Rome.", source: W(91) },
      { text: "UNESCO cites the restoration of the Colosseum and the Arch of Titus as early examples of restoration principles first tested in Rome.", source: W(91) },
      { text: "The organisation behind the 2007 vote lists the Colosseum (Italy) among its seven winners.", source: N7 }],
    claims: [], unknowns: ["Construction dates and capacity: not on the UNESCO page; the site's own heritage authority was not opened [UNKNOWN]"] },
  { id: "wonder-christ-the-redeemer", title: "Christ the Redeemer (New Seven Wonders, unofficial vote)", aliases: ["Christ the Redeemer", "Cristo Redentor", "Corcovado"], country: "BR", region: "South America", whc: 1100, wd: "wd-q79961", inscribed: "2012",
    place: { label: "Christ the Redeemer, Corcovado, Rio de Janeiro, Brazil", lat: -22.9519, lng: -43.2105 },
    everyday: "The statue of Christ on Corcovado Mountain in Rio de Janeiro, Brazil, was one of seven sites named in an unofficial 2007 popular vote. UNESCO calls the statue well known and counts the mountain in Rio's World Heritage landscape.",
    student: "UNESCO counts Corcovado Mountain, home of the well-known statue of Christ, as part of its Rio de Janeiro: Carioca Landscapes property, inscribed in 2012. That inscription covers the city landscape, not the statue alone. This entry is about the statue's site; the 2007 vote is an unofficial popular vote.",
    measures: [{ label: "World Heritage inscription (Rio landscapes, the whole property)", value: "2012", source: W(1100) }],
    facts: [{ text: "UNESCO counts Corcovado Mountain, home of the well-known statue of Christ, inside the Rio de Janeiro landscape property.", source: W(1100) },
      { text: "The organisation behind the 2007 vote lists Cristo Redentor (Brazil) among its seven winners.", source: N7 }],
    claims: [], unknowns: ["Statue height, builder and completion date: no official page opened [UNKNOWN]", "The 2012 inscription covers the whole city landscape, so it is not a listing of the statue alone"] },
  { id: "wonder-machu-picchu", title: "Machu Picchu (New Seven Wonders, unofficial vote)", aliases: ["Machu Picchu", "Inca citadel"], country: "PE", region: "South America", whc: 274, wd: "wd-q676203", inscribed: "1983",
    place: { label: "Machu Picchu, Peru", lat: -13.1633, lng: -72.5456 },
    everyday: "Machu Picchu in Peru was one of seven sites named in an unofficial 2007 popular vote. UNESCO says the Inca citadel was built in the fifteenth century, abandoned after the Spanish conquest, and made known to the outside world in 1911.",
    student: "UNESCO describes the Historic Sanctuary of Machu Picchu as a mixed cultural and natural property where the Andes meet the Amazon Basin. The citadel sits more than 2,400 metres above sea level and holds about 200 structures. Built in the fifteenth century, it was abandoned when Spain conquered the Inca Empire in the sixteenth, and became known to the outside world in 1911. Inscribed 1983. This entry is about the site; the 2007 vote is an unofficial popular vote.",
    measures: [{ label: "Elevation of the citadel (UNESCO)", value: "more than 2,400 m above sea level", source: W(274) }, { label: "Structures in the citadel (UNESCO)", value: "about 200", source: W(274) }, { label: "Built (UNESCO)", value: "fifteenth century", source: W(274) }, { label: "Made known to the outside world (UNESCO)", value: "1911", source: W(274) }, { label: "World Heritage inscription", value: "1983 (mixed cultural and natural)", source: W(274) }],
    facts: [{ text: "UNESCO says Machu Picchu was built in the fifteenth century and abandoned when Spain conquered the Inca Empire in the sixteenth.", source: W(274) },
      { text: "UNESCO says the archaeological complex was not made known to the outside world until 1911.", source: W(274) },
      { text: "The organisation behind the 2007 vote lists Machu Picchu (Peru) among its seven winners.", source: N7 }],
    claims: [], unknowns: ["Which Inca ruler it served: not stated on the page used [UNKNOWN]"] },
  { id: "wonder-chichen-itza", title: "Chichén Itzá (New Seven Wonders, unofficial vote)", aliases: ["Chichén Itzá", "Chichen Itza"], country: "MX", region: "North America", whc: 483, wd: "wd-q5859", inscribed: "1988",
    place: { label: "Chichén Itzá, Yucatán, Mexico", lat: 20.6831, lng: -88.5686 },
    everyday: "Chichén Itzá in Yucatán, Mexico, was one of seven sites named in an unofficial 2007 popular vote. UNESCO says the Maya town grew up beside two natural wells, and that sources disagree about when it was founded.",
    student: "UNESCO says the town was founded in the Classic period beside two cenotes (natural wells), and that the name refers to a well and the Itzá people. Local accounts disagree on the founding date: one manuscript gives 415-35 AD and others 455 AD. Standing buildings named by UNESCO include El Castillo, the Warriors' Temple and the circular observatory El Caracol. Inscribed 1988. This entry is about the site; the 2007 vote is an unofficial popular vote.",
    measures: [{ label: "Buildings named by UNESCO", value: "El Castillo, Warriors' Temple, El Caracol", source: W(483) }, { label: "Older monuments built (UNESCO)", value: "between the 6th and 10th centuries", source: W(483) }, { label: "World Heritage inscription", value: "1988", source: W(483) }],
    facts: [{ text: "UNESCO says the town was set up in the Classic period beside two cenotes, natural cavities that gave access to underground water.", source: W(483) },
      { text: "UNESCO names El Castillo, the Warriors' Temple and the circular observatory El Caracol among the surviving buildings.", source: W(483) },
      { text: "The organisation behind the 2007 vote lists Chichen Itza (Mexico) among its seven winners.", source: N7 }],
    claims: [{ text: "When Chichén Itzá was founded.", status: "people-disagree", sources: [W(483)], positions: [{ text: "One local manuscript gives 415-35 AD.", source: W(483) }, { text: "Other local accounts give 455 AD.", source: W(483) }] }],
    unknowns: ["A single agreed founding date: [UNKNOWN] (UNESCO itself reports the two accounts)"] },
  { id: "wonder-great-wall", title: "Great Wall of China (New Seven Wonders, unofficial vote)", aliases: ["Great Wall of China", "The Great Wall"], country: "CN", region: "Asia", whc: 438, wd: null, inscribed: "1987",
    place: { label: "The Great Wall, northern China (a line across several provinces; no single point)", lat: null, lng: null },
    everyday: "The Great Wall of China was one of seven sites named in an unofficial 2007 popular vote. UNESCO says work started in the 3rd century BC and went on into the 17th century AD. The belief that it can be seen from the Moon is a myth.",
    student: "UNESCO says the Great Wall was built over many centuries by one Chinese empire after another along their northern frontier, starting in the 3rd century BC and ending in the 17th century AD. It gives the whole length as over 20,000 km, with Shanhaiguan (Hebei) at the east end and Jiayuguan (Gansu) at the west end. It was inscribed in 1987. NASA says the wall is not visible from the Moon and is difficult or impossible to see from Earth orbit without high-powered lenses. It is a line, so this entry has no map pin. The 2007 vote is an unofficial popular vote.",
    measures: [{ label: "Built (UNESCO)", value: "from the 3rd century BC into the 17th century AD", source: W(438) }, { label: "Total length (UNESCO)", value: "more than 20,000 km", source: W(438) }, { label: "East end and west end (UNESCO)", value: "Shanhaiguan (Hebei) to Jiayuguan (Gansu)", source: W(438) }, { label: "World Heritage inscription", value: "1987", source: W(438) }],
    facts: [{ text: "UNESCO says the wall was worked on without a break by one Chinese empire after another, as defensive military works, from the 3rd century BC into the 17th century AD.", source: W(438) },
      { text: "UNESCO gives Shanhaiguan, in Hebei, as the east end and Jiayuguan, in Gansu, as the west end.", source: W(438) },
      { text: "The organisation behind the 2007 vote lists the Great Wall of China among its seven winners.", source: N7 }],
    claims: [{ text: "Myth: the Great Wall can be seen from the Moon. NASA says it is not visible from the Moon and is difficult or impossible to see from Earth orbit without high-powered lenses.", status: "myth", sources: [NASA] }],
    unknowns: ["Other published lengths differ from UNESCO's figure; no second official length was checked [UNKNOWN]", "A single map point: none, because the wall is a line across several provinces"] },
];

export const OVERVIEW = {
  id: "wonders-overview", title: "New Seven Wonders (2007 popular vote, unofficial)", aliases: ["New 7 Wonders", "Seven Wonders of the modern world", "Wonders layer"],
  everyday: "Seven sites named in an unofficial, private popular vote announced in Lisbon on 7 July 2007. It is not an official list: UNESCO says it has no link to it. Six of the seven are here; Petra belongs to the Ancient layer.",
  student: "A first batch for the unofficial 2007 New7Wonders popular vote. Six winners have a card with facts from UNESCO World Heritage pages and a NASA page; five have one approximate map pin (a Wikidata CC0 point) and the Great Wall, a line, has none. Petra is a deferred cross-link to the Ancient layer. The organisation's own FAQ page is the only source for the date and the list. No logos, no campaign text, no endorsement.",
  vote: [
    { name: "Great Wall of China", country: "CN", entry: "wonder-great-wall", deferred_link: null, source: N7 },
    { name: "Petra", country: "JO", entry: null, deferred_link: "ancient-petra", source: N7 },
    { name: "Colosseum", country: "IT", entry: "wonder-colosseum", deferred_link: null, source: N7 },
    { name: "Chichén Itzá", country: "MX", entry: "wonder-chichen-itza", deferred_link: null, source: N7 },
    { name: "Machu Picchu", country: "PE", entry: "wonder-machu-picchu", deferred_link: null, source: N7 },
    { name: "Taj Mahal", country: "IN", entry: "wonder-taj-mahal", deferred_link: null, source: N7 },
    { name: "Christ the Redeemer", country: "BR", entry: "wonder-christ-the-redeemer", deferred_link: null, source: N7 },
  ],
  facts: [
    { text: "The organisation behind the vote lists its declaration event as held in Lisbon on 7 July 2007.", source: N7 },
    { text: "UNESCO says the campaign began in 2000 as a private initiative, that UNESCO was invited to support it and decided not to, and that there is no link between it and the World Heritage programme.", source: UN },
    { text: "UNESCO says the list will reflect only the opinions of people with internet access, and that the campaign cannot contribute in any significant and lasting way to preserving the sites it picks.", source: UN },
  ],
  claims: [
    { text: "Myth: the New Seven Wonders is an official or UNESCO list. UNESCO says there is no link between its World Heritage programme and the campaign.", status: "myth", sources: [UN] },
    { text: "Hundreds of millions of people voted. This is the organisation's own figure and no independent count was found.", status: "not-proven", sources: [N7] },
  ],
  stories: [
    { id: "a-vote-not-a-list", title: "A popular vote, not an official list", steps: [
      { entry: "wonders-overview", text: "The organisation behind the vote says its declaration event was held in Lisbon on 7 July 2007.", sources: [N7] },
      { entry: "wonders-overview", text: "UNESCO's statement, dated 9 July 2007, says it has no link to the campaign, which it called a private initiative begun in 2000.", sources: [UN] },
      { entry: "wonder-great-wall", text: "Seven sites were named; the Great Wall of China is the only one that is a line rather than a place.", sources: [N7, "unesco-whc-438"] },
    ] },
    { id: "built-over-many-centuries", title: "Built over many centuries", steps: [
      { entry: "wonder-great-wall", text: "The Great Wall: UNESCO says work began in the 3rd century BC and ran into the 17th century AD.", sources: ["unesco-whc-438"] },
      { entry: "wonder-chichen-itza", text: "Chichén Itzá: UNESCO says older monuments there date from the 6th to the 10th centuries, and sources disagree about the founding.", sources: ["unesco-whc-483"] },
      { entry: "wonder-machu-picchu", text: "Machu Picchu: built in the fifteenth century and made known to the outside world in 1911, says UNESCO.", sources: ["unesco-whc-274"] },
      { entry: "wonder-taj-mahal", text: "The Taj Mahal: built from 1632 to 1648, with outer parts finished by 1653, says UNESCO.", sources: ["unesco-whc-252"] },
    ] },
  ],
};
