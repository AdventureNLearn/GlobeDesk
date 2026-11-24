# GlobeDesk Atlas: open items

Status as of Nov 24, 2026 (carried into the v1.4.0-draft build, not released). Every item below is OPEN and unresolved. None is decided by this build. Items 1-12 are the owner's questions from the approved Atlas proposal; items 13 onward were found while building v1.4.0-draft.

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| 1 | Pack size budget per pack, and how many packs to start with | OPEN | Hard cap is 50 MB per pack (enforced). Real budget [UNKNOWN]. Skeleton has core + 4 category packs. |
| 2 | Languages | OPEN | English only in the skeleton. Other languages [UNKNOWN]. |
| 3 | Licences of outside datasets we may bundle | OPEN | Bundle only if redistribution is allowed without NC or SA terms. Each dataset [UNKNOWN] until checked. Outside projects with unconfirmed licences are outbound links only. |
| 4 | Sources for the other categories | OPEN | Only energy, objects, chemistry and economics have cited draft entries. History, civic, food, preparedness, health, earth, science history and Now have no sources yet [UNKNOWN]. |
| 5 | Which kit size first (S, M, L or all three) | OPEN | |
| 6 | The 150 W inverter (L kit only) in v1 | OPEN | |
| 7 | Price regions to check first | OPEN | Draft checks exist for US, GB, IT and IN; most parts [UNKNOWN]. |
| 8 | Seller links as plain outbound links (no affiliate links) | OPEN | |
| 9 | Chemistry 3D models (crystal or molecule) | OPEN | Needs an open-licence structure source [UNKNOWN]. |
| 10 | DIY safety note on battery and build entries | OPEN | |
| 11 | A real kit build and test | OPEN | Until then the kit stays draft, not built or tested. |
| 12 | Release name v1.4.0 Atlas | OPEN | Build is labelled v1.4.0-draft · not released until this is decided. |
| 13 | Official sources for 8 desks | OPEN | Owner rule (Nov 24, 2026): owner repos and Learning Lab cards are experimental, never official. These desks have only experimental references, so their official source is [UNKNOWN]: News (desk level; stories cite their own pages), Permits and Codes, Jobsite and Constructability, Trades and Skills, Infrastructure Trade and Routes, Regulatory and Public Records, Surveillance and Civil Liberties, Security and Counterterrorism. Engineering and 3D Objects and Energy and Materials list FAA PackSafe (and PVGIS terms) only. |
| 14 | Withheld owner projects in desks | OPEN | Four desk rows show "owner project (link pending)" with no link: a state-level permitting prototype (Permits and Codes), a highway right-of-way record kernel (private repo) and a historic routes atlas (Infrastructure Trade and Routes), and a primary-law quotation collection (Regulatory and Public Records). Whether and how to link them is the owner's call. |
| 15 | Learning Lab deep links | OPEN | Cards are linked to the Learning Lab home page with a card number; per-card links are [UNKNOWN]. |
| 16 | Kids and everyday versions of desks and entries | OPEN | Permits, Jobsite, Engineering, Regulatory, Surveillance and Security desks have no kids or everyday text. Atlas entries are written at one reading level each; other levels show "not written yet [UNKNOWN]". |
| 17 | Packs for the other eight categories and Now | OPEN | History, civic, food, preparedness, health, earth, science history and Now are greyed in the Atlas ("pack not built yet"). See item 4. |
| 18 | Community lane content and review | OPEN | atlas/community/community.json ships empty. Who reviews contributor cards, how the report flag reaches the maintainer (no server), and the recheck cadence before the one-year fade are [UNKNOWN]. |
| 19 | three.js release line | OPEN | The 3D view lazy-loads vendored three.js r158 (MIT, unmodified), the last line with a classic-script build; it logs a deprecation warning when 3D is first opened. Moving to an ES-module build is [UNKNOWN]. |
| 20 | Source classes for "reference" sources | OPEN | Battery University and retailer or supplier listings are tagged reference (cited, not official). Whether entries need at least one official source before leaving draft is [UNKNOWN]. |
| 21 | Online price and solar lookups | OPEN | Off by default and not built; prices are the bundled, dated checks only. |
| 22 | Bells layer: thin regions | OPEN | 55 sourced bells: Europe 21, North America 14, Asia 13, Oceania 4, Africa 2, South America 1. More bells for Africa, South America, South and West Asia and the Middle East need official or primary sources first [UNKNOWN]. Candidates seen only in secondary sources were left out. |
| 23 | Bells: approximate pins and missing facts | OPEN | 12 pins are approximate and labelled (Amedzofe, Balangiga, Bok Tower, Bolshoy Uspensky, Dhammazedi (lost), HMS Hood bell, Nimrud bell, Sysoy, Todai-ji, Uglich, Wilbank, World Peace Bell). Status [UNKNOWN] for Amedzofe, Balangiga (present church site), Wilbank and World Peace Bell; era [UNKNOWN] for 9 bells whose casting date has no primary source. Mass is [UNKNOWN] for 24 bells, diameter for 32, strike note for 45. |
| 24 | Bells: conflicts kept open | OPEN | Centennial Bell diameter (NPS fact sheet 7 ft 6 in vs National Register form 7 ft 3/4 in); Bicentennial Bell mass (12,466 vs 12,446 lb, both NPS); Old North bells casting year (Boston Landmarks Commission report says 1744 and, once, 1745); bell-bronze ratio 78-80% Cu / 20-22% Sn appears only in secondary sources (CCCBR gives about 80/20). |
| 25 | Bells: low-confidence records | OPEN | No official or primary source yet for Dhammazedi Bell (BBC only), Anzac Bell (Perth) and World Peace Bell (Newport); Amedzofe and Maria Angola are low confidence on dates. They stay draft and say so. |
| 26 | Bells 3D | OPEN | js/atlas/models/bell.js is a generic Western profile (lathe) scaled from the sourced diameter (and height or wall where sourced); 23 bells use sourced dimensions, 20 a generic 1 m bell with the assumption labelled. Rings, carillons, chime sets, the bianzhong set and lost bells have no 3D. East Asian bonsho shapes and scanned profiles are [UNKNOWN]. |
| 27 | Bells: licences of linked sources | OPEN | NPS and USAF pages are US federal works (public domain in the US); parliament.uk is Open Parliament Licence v3.0; every other source is linked only with licence [UNKNOWN] and no text copied. Images: none bundled. |
| 28 | Bells and the history branch: merge notes | OPEN | The Bells pack owns all bell entries, including liberty-bell, old-north-bells, centennial-bell, justice-bell and bicentennial-bell (same ids the history pack links to with see_also_ids). On merge with next/atlas-history: drop that branch's bell copies under objects/historic-objects and data/atlas/artifacts bell records, keep one source record per id (same ids and URLs), and settle the objects subcategory count (historic-objects plus bells would be 7; the validator allows 3-6). |
| 29 | Bells: URL rechecks | OPEN | All 91 bell sources were opened on 2026-11-24. Some sites block scripted checks (UK Parliament, Notre-Dame, British Museum, Korea Heritage Service, NCA, Erfurt, Hibberts, NZHistory, Warren AFB); they were opened through a fetch service and are marked so in sources.json. A recheck cadence is [UNKNOWN]. |

Also [UNKNOWN] in the skeleton, not yet owner questions: the by-year slider's earliest year; the solar-resource table (PVGIS) values; currency rate source and terms; the water filter kit and lithium element entries (placeholders).

Process reminders (approved, not open): owner repos and Learning Lab cards are experimental references only, never official sources or records backing a claim (validator rule); no entry about a living person; the Now pack refreshes weekly and category packs quarterly, each only through the owner's promote step with his YES; nothing is pushed, merged or published without that YES.
