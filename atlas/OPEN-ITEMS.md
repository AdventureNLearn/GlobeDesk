# GlobeDesk Atlas: open items

Status as of Nov 24, 2026 (carried into the v1.4.0-draft build, not released). Every item below is OPEN and unresolved. None is decided by this build. Items 1-12 are the owner's questions from the approved Atlas proposal; items 13-21 were found while building v1.4.0-draft; items 22 onward came with the History section (branch next/atlas-history, local only, not released).

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| 1 | Pack size budget per pack, and how many packs to start with | OPEN | Hard cap is 50 MB per pack (enforced). Real budget [UNKNOWN]. Skeleton has core + 4 category packs. |
| 2 | Languages | OPEN | English only in the skeleton. Other languages [UNKNOWN]. |
| 3 | Licences of outside datasets we may bundle | OPEN | Bundle only if redistribution is allowed without NC or SA terms. Each dataset [UNKNOWN] until checked. Outside projects with unconfirmed licences are outbound links only. |
| 4 | Sources for the other categories | OPEN | Energy, objects, chemistry, economics and (on next/atlas-history) History have cited draft entries. Formerly History, civic, food, preparedness, health, earth, science history and Now have no sources yet [UNKNOWN]. |
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
| 22 | History section review (US 1776-2026) | OPEN | Draft pack history-places: 41 event entries (a 1775 Old North prologue plus 40 from 1776 to 2026), each with at least one official source (NPS, NARA, LOC, NASA, USGS, State Dept, SSA, CDC, DOJ ADA.gov; one California State Parks and one Federal Reserve History page, whose reuse terms are [UNKNOWN]). Every URL answered on Nov 24, 2026 (SSA and CDC through a page fetch; curl got 403). Owner review of wording and stop choice before any promote. |
| 23 | Approximate pins | OPEN | Every history pin is approximate; surveyed coordinates are [UNKNOWN]. Five entries are country-level only (Bill of Rights, 13th Amendment, Social Security Act, Civil Rights Act, ADA); Trail of Tears and COVID-19 use area pins. |
| 24 | Year-only and month-only dates | OPEN | Erie Canal (1825; opening day [UNKNOWN] in the cited page), Ellis Island (1892-1924; opening day [UNKNOWN]), Trail of Tears (May and June 1838). |
| 25 | Missing history topics | OPEN | Not yet in the pack: Indigenous nations beyond the Cherokee removal, the Mexican-American War, Reconstruction beyond the 13th Amendment, the Great Migration, World War I, Japanese American incarceration, the Vietnam War, the Cold War, the 2008 financial crisis and more. Each needs official sources. |
| 26 | Reading levels | OPEN | All history entries have Kids, Everyday and Student text; five also have Professional. Professional is missing on the rest. |
| 27 | Bells live in the Bells branch | OPEN | Per the owner (5:49 PM), bells are not duplicated here. History entries link by id (see_also_ids) to liberty-bell, centennial-bell, justice-bell, old-north-bells and bicentennial-bell; in this copy they show "(not in this copy)" until the Bells branch (next/atlas-bells) lands with those ids. The ids must match there. |
| 28 | Object angles on other history entries | OPEN | Records exist for the Constitution (four pages) and the 1844 telegraph tape. The golden spike, printing presses and other objects need official sources for metal and maker before they get Parts or Chemistry content. |
| 29 | Validator hygiene word match | OPEN | The hygiene check now matches "secret" only as a whole word, so "Secretary of State" passes. Owner OK on this change [UNKNOWN]. |
| 30 | History category year range | OPEN | The by-year slider for History starts at 1775 because of the Old North prologue. Whether the section should start strictly at 1776 is the owner's call. |
| 31 | 10-minute video | OPEN | Script and story list drafted (video folder: SCRIPT-10MIN.md, STORY-LIST-10MIN.md). Recording waits for the owner's review, for the Bells branch (for the bell beats), for v1.4 on the PC, and for the Adventure frog host after the footage cut is approved. |

Also [UNKNOWN] in the skeleton, not yet owner questions: the by-year slider's earliest year; the solar-resource table (PVGIS) values; currency rate source and terms; the water filter kit and lithium element entries (placeholders).

Process reminders (approved, not open): owner repos and Learning Lab cards are experimental references only, never official sources or records backing a claim (validator rule); no entry about a living person; the Now pack refreshes weekly and category packs quarterly, each only through the owner's promote step with his YES; nothing is pushed, merged or published without that YES.
