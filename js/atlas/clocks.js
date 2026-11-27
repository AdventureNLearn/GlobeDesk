/* Timeline clocks: named year windows that a pack or a desk runs on. Shared by the app and the validator.
   America 250 (1775-2026) is the US history clock and stays as it is (owner decision 2026-11-24, OPEN-ITEMS #30).
   Deep time (10,000 BCE-2026) is the Ancient World clock (owner pick 2026-11-26). A later topic adds one row here
   and names its packs and desks; nothing else changes. Years are astronomical (1 BCE = 0, so N BCE = -(N-1)).
   window.GD.clocks */
(function (root) {
  "use strict";
  const CLOCKS = [
    { id: "america-250", label: "America 250 clock", noun: "history", min: 1775, max: 2026, packs: ["history-places"], desks: [] },
    { id: "deep-time", label: "Deep-time clock", noun: "deep-time", min: -9999, max: 2026, packs: ["ancient-world"], desks: ["ancient-world"] },
  ];
  const byId = (id) => CLOCKS.find((c) => c.id === id) || null;
  const forPack = (pack) => CLOCKS.find((c) => c.packs.indexOf(pack) >= 0) || null;
  const forDesk = (desk) => CLOCKS.find((c) => c.desks.indexOf(desk) >= 0) || null;
  const inRange = (clock, year) => Number.isInteger(year) && year >= clock.min && year <= clock.max;
  const yearLabel = (y) => (y <= 0 ? (1 - y) + " BCE" : String(y));
  const rangeLabel = (clock) => yearLabel(clock.min) + "–" + yearLabel(clock.max);
  const api = { CLOCKS, byId, forPack, forDesk, inRange, yearLabel, rangeLabel };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) (root.GD = root.GD || {}).clocks = api;
})(typeof window !== "undefined" ? window : null);
