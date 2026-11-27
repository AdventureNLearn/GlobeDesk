// Sources for the Wonders layer (New Seven Wonders, 2007 popular vote, unofficial). Merged by id into
// atlas/packs/core/sources.json by build-wonders.mjs. Every page was opened on 2026-11-27 (see "verified").
// UNESCO text is CC BY-SA 3.0 IGO (ShareAlike), so it is linked only and facts are restated in our own words.
// The New7Wonders FAQ page is all rights reserved: linked only, no logos, no marketing text, no endorsement.
const CHECKED = "2026-11-27";
const DIRECT = "opened directly (HTTP 200)";
const NASA_TERMS = "NASA content is generally not subject to copyright in the United States (NASA Images and Media Usage Guidelines). Credit NASA; no NASA insignia; no implied endorsement. Facts restated in our own words; no image copied.";
const NASA_URL = "https://www.nasa.gov/nasa-brand-center/images-and-media/";
const UNESCO_TERMS = "UNESCO World Heritage Centre pages mark their text as CC BY-SA 3.0 IGO (whc.unesco.org/en/disclaimer, opened 2026-11-27); photographs are separate and need permission. ShareAlike terms, so nothing is bundled: linked only; dates, places and figures restated as facts in our own words; no text or image copied.";
const UNESCO_URL = "https://whc.unesco.org/en/disclaimer/";
const N7W_TERMS = "(c) Global Platform Ltd., all rights reserved (page footer, opened 2026-11-27). The organisation also runs a commercial licensing arm; no open licence was found. Linked only; the 2007 declaration date and the list of seven are restated as facts in our own words. No logo, campaign text or branding is used and nothing here implies endorsement.";
const WD = (q, name) => ({ id: `wd-${q.toLowerCase()}`, title: `Wikidata item for ${name} (coordinate property)`, url: `https://www.wikidata.org/wiki/${q}`, checked: CHECKED, class: "reference",
  publisher: "Wikimedia Foundation (Wikidata)", license: "CC0 1.0: Wikidata structured data is released into the public domain (Wikidata:Licensing). Used for the one published coordinate point only.", terms_url: "https://www.wikidata.org/wiki/Wikidata:Licensing", verified: DIRECT });
const WHC = (id, title, extra) => ({ id: `unesco-whc-${id}`, title: `UNESCO World Heritage Centre: ${title}`, url: `https://whc.unesco.org/en/list/${id}/`, checked: CHECKED, class: "official",
  publisher: "UNESCO World Heritage Centre", license: UNESCO_TERMS, terms_url: UNESCO_URL, verified: DIRECT, description: extra });

export const WONDERS_SOURCES = [
  WHC(252, "Taj Mahal (list no. 252)", "Inscribed 1983. Brief synthesis: location in Agra District, Uttar Pradesh; built 1632 to 1648 with outer parts finished 1653; garden of nearly 17 hectares."),
  WHC(91, "Historic Centre of Rome, the Properties of the Holy See in that City Enjoying Extraterritorial Rights and San Paolo Fuori le Mura (list no. 91)", "Inscribed 1980. Names the Colosseum among the monuments of antiquity; property area 1,469.7 ha."),
  WHC(274, "Historic Sanctuary of Machu Picchu (list no. 274)", "Inscribed 1983, mixed cultural and natural property. Brief synthesis: citadel above 2,400 m, about 200 structures, built in the fifteenth century, made known to the outside world in 1911."),
  WHC(483, "Pre-Hispanic City of Chichen-Itza (list no. 483)", "Inscribed 1988. Brief synthesis: founding dates vary by local account; buildings named include El Castillo, the Warriors' Temple and El Caracol."),
  WHC(438, "The Great Wall (list no. 438)", "Inscribed 1987. Gives the span of construction (3rd century BC into the 17th century AD), a combined length above 20,000 km, and the two end points (Shanhaiguan in Hebei, Jiayuguan in Gansu)."),
  WHC(1100, "Rio de Janeiro: Carioca Landscapes between the Mountain and the Sea (list no. 1100)", "Inscribed 2012. Counts Corcovado Mountain, where the well-known Christ statue stands, inside the listed Rio landscape."),
  { id: "unesco-news-new7wonders", title: "UNESCO World Heritage Centre news: UNESCO confirms that it is not involved in the \"New 7 wonders of the world\" campaign (9 July 2007)", url: "https://whc.unesco.org/en/news/352", checked: CHECKED,
    class: "official", publisher: "UNESCO World Heritage Centre", license: UNESCO_TERMS, terms_url: UNESCO_URL, verified: DIRECT,
    description: "UNESCO says there is no link between its World Heritage programme and the New 7 Wonders campaign, describes the campaign as a private initiative begun in 2000, and says the list will reflect only the opinions of people with internet access." },
  { id: "new7wonders-faq", title: "New7Wonders: FAQ (organisation's own page; lists the 7 July 2007 declaration event and the seven winners)", url: "https://about.new7wonders.com/faq/", checked: CHECKED,
    class: "reference", publisher: "New7Wonders (Global Platform Ltd.; Swiss-registered foundation plus commercial operation, as the page says)", license: N7W_TERMS, verified: DIRECT,
    description: "Gives the declaration event as Lisbon, 07.07.2007 and names the seven winners (here in alphabetical order): Chichen Itza (Mexico), Colosseum (Italy), Cristo Redentor (Brazil), Great Wall of China, Machu Picchu (Peru), Petra (Jordan), Taj Mahal (India). Says the campaign cast 'hundreds of millions of votes' (the organisation's own figure)." },
  { id: "nasa-great-wall", title: "NASA: Great Wall (image article, 2 April 2009)", url: "https://www.nasa.gov/image-article/great-wall/", checked: CHECKED,
    class: "official", publisher: "NASA", license: NASA_TERMS, terms_url: NASA_URL, verified: DIRECT,
    description: "Says that despite myths to the contrary the wall isn't visible from the Moon and is difficult or impossible to see from Earth orbit without high-powered lenses." },
  WD("Q9141", "Taj Mahal"), WD("Q10285", "Colosseum"), WD("Q79961", "Christ the Redeemer"), WD("Q676203", "Machu Picchu"), WD("Q5859", "Chichen Itza"),
];
