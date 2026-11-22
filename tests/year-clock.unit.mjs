// Unit checks for the data-year clock. No browser, no network.
import fs from "node:fs"; import vm from "node:vm"; import path from "node:path"; import assert from "node:assert/strict"; import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ctx = { window: {}, Date, URL, console }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, "js", "year-clock.js"), "utf8"), ctx);
const yc = ctx.window.GD.yearClock;
let n = 0;
const t = (name, fn) => { fn(); n++; console.log("ok -", name); };

t("default year is the calendar year, within 1983..now", () => {
  yc.resetForTests({ now: () => new Date("2026-11-22T12:00:00-05:00") });
  assert.equal(yc.calendarYear(), 2026);
  assert.equal(yc.getYear(), 2026);
  assert.equal(yc.YEAR_MIN, 1983);
  assert.equal(yc.yearMax(), 2026);
  assert.equal(yc.getDate(), null);
  assert.equal(yc.isFollowStory(), false);
});

t("clampYear rejects years below 1983 and after the calendar year", () => {
  yc.resetForTests({ now: () => new Date("2026-06-01T00:00:00Z") });
  assert.equal(yc.clampYear(1900), 1983);
  assert.equal(yc.clampYear(2027), 2026);
  assert.equal(yc.clampYear(2018.7), 2019);
});

t("setYear updates state and does not invent a playback time", () => {
  yc.resetForTests({ now: () => new Date("2026-11-22T12:00:00-05:00") });
  let playbackT = 12.5;
  yc.setYear(2016);
  assert.equal(yc.getYear(), 2016);
  assert.equal(playbackT, 12.5);
  yc.setYear(1999);
  assert.equal(yc.getYear(), 1999);
  assert.equal(yc.getDate(), null);
});

t("setDate refuses a future day and adopts its year", () => {
  yc.resetForTests({ now: () => new Date("2026-11-22T15:00:00-05:00") });
  yc.setDate("2018-07-04");
  assert.equal(yc.getYear(), 2018);
  assert.equal(yc.getDate(), "2018-07-04");
  yc.setDate("2027-01-01");
  assert.equal(yc.getDate(), "2026-11-22");
  assert.equal(yc.getYear(), 2026);
});

t("parseStoryDate reads YYYY, YYYY-MM and YYYY-MM-DD", () => {
  const a = yc.parseStoryDate("2018-07-04");
  assert.equal(a.year, 2018); assert.equal(a.date, "2018-07-04");
  const b = yc.parseStoryDate("2018-07");
  assert.equal(b.year, 2018); assert.equal(b.date, "2018-07-01");
  const c = yc.parseStoryDate("2018");
  assert.equal(c.year, 2018); assert.equal(c.date, "2018-01-01");
  assert.equal(yc.parseStoryDate("sometime"), null);
});

t("follow story date sets the year from the story and leaves playbackT unused", () => {
  yc.resetForTests({ now: () => new Date("2026-11-22T12:00:00-05:00") });
  const playbackT = 33;
  yc.setFollowStory(true, { silent: true });
  const snap = yc.applyStoryDate("2014-03-15", { playbackT: playbackT });
  assert.equal(snap.year, 2014);
  assert.equal(snap.date, "2014-03-15");
  assert.equal(playbackT, 33);
  yc.setFollowStory(false, { silent: true });
  yc.setYear(2020, { silent: true });
  yc.applyStoryDate("1999-01-01");
  assert.equal(yc.getYear(), 2020, "follow off must ignore the story date");
});

t("onChange fires when the year moves, and resetForTests drops listeners", () => {
  yc.resetForTests({ now: () => new Date("2026-11-22T12:00:00-05:00") });
  const seen = [];
  yc.onChange((s) => seen.push(s.year));
  yc.setYear(2000);
  assert.deepEqual(seen, [2000]);
  yc.resetForTests({ now: () => new Date("2026-11-22T12:00:00-05:00") });
  yc.setYear(2001);
  assert.deepEqual(seen, [2000]);
});


t("2016 EOX mosaic is RECORDED; 2017 is PROJECTED and never labelled recorded", () => {
  yc.resetForTests({ now: () => new Date("2026-11-22T12:00:00-05:00") });
  yc.setYear(2016, { silent: true });
  const rec = yc.statusFor({ kind: "eox-cloudless" }, 2016, null, { nonCommercialAck: false });
  assert.equal(rec.kind, "recorded");
  assert.equal(yc.chipText(rec), "RECORDED");
  assert.match(rec.spoken, /Recorded/i);
  assert.equal(/projected/i.test(rec.spoken), false);
  yc.setYear(2017, { silent: true });
  const proj = yc.statusFor({ kind: "eox-cloudless" }, 2017, null, { nonCommercialAck: true, showProjected: true });
  assert.equal(proj.kind, "projected");
  assert.equal(yc.chipText(proj), "PROJECTED");
  assert.match(proj.spoken, /projected/i);
  assert.match(proj.spoken, /not recorded imagery for 2017/i);
  assert.equal(proj.prev, 2016);
  assert.equal(proj.next, 2018);
  /* 2017 still has recorded GIBS daily frames, so the default stack is not projected. */
  const badge2017 = yc.yearBadgeSpec({ nonCommercialAck: true, showProjected: true });
  assert.notEqual(badge2017.kind, "projected");
});

t("a gap year with no recorded imagery is labelled PROJECTED on the default stack", () => {
  yc.resetForTests({ now: () => new Date("2026-11-22T12:00:00-05:00") });
  yc.setShowProjected(true, { silent: true });
  yc.setYear(1995, { silent: true });
  const weld = yc.statusFor({ kind: "gibs-weld" }, 1995, null, { showProjected: true });
  assert.equal(weld.kind, "projected");
  assert.equal(weld.prev, 1990);
  assert.equal(weld.next, 1998);
  assert.match(weld.spoken, /not recorded imagery for 1995/i);
  const st = yc.defaultImageryStatus(1995, null, { showProjected: true });
  assert.equal(st.kind, "projected");
  assert.equal(st.stack, "weld");
  const badge = yc.yearBadgeSpec({ showProjected: true });
  assert.equal(badge.kind, "projected");
  assert.equal(badge.text, "PROJECTED · 1995");
  assert.match(badge.spoken, /estimate/i);
  yc.setShowProjected(false, { silent: true });
  const off = yc.defaultImageryStatus(1995, null, { showProjected: false });
  assert.notEqual(off.kind, "projected");
});

t("a GIBS nearest available day is RECORDED-nearest, not PROJECTED", () => {
  yc.resetForTests({ now: () => new Date("2026-11-22T12:00:00-05:00") });
  /* SNPP has a documented gap 2022-07-28..2022-08-09; Terra also gaps around then but 2022-07-28 may exist on Terra. */
  const st = yc.statusFor({ kind: "gibs-daily" }, 2022, "2022-08-01", {});
  assert.ok(st.kind === "recorded" || st.kind === "recorded-nearest", st.kind + " " + st.actual);
  assert.equal(st.kind === "projected", false);
  assert.equal(/projected/i.test(st.spoken), false);
  if (st.kind === "recorded-nearest") {
    assert.match(st.label, /nearest available/i);
    assert.notEqual(st.actual, "2022-08-01");
  }
});

t("legal Census boundaries are never PROJECTED", () => {
  yc.resetForTests({ now: () => new Date("2026-11-22T12:00:00-05:00") });
  const y2010 = yc.statusFor({ kind: "tiger" }, 2010);
  assert.equal(y2010.kind, "recorded");
  assert.equal(y2010.actual, "tigerWMS_Census2010");
  const y2020 = yc.statusFor({ kind: "tiger" }, 2020);
  assert.equal(y2020.actual, "tigerWMS_Census2020");
  const y2018 = yc.statusFor({ kind: "tiger" }, 2018);
  assert.equal(y2018.actual, "tigerWMS_ACS2018");
  const y2005 = yc.statusFor({ kind: "tiger" }, 2005, null, { showProjected: true });
  assert.equal(y2005.kind, "unavailable");
  assert.equal(y2005.actual, null);
  assert.equal(y2005.projectable, false);
  assert.match(y2005.spoken, /not projected/i);
  assert.match(y2005.label, /unavailable/i);
  assert.equal(/tigerWMS_/i.test(y2005.label + " " + y2005.spoken), false);
  assert.match(y2010.label, /Census 2010/);
  assert.equal(/tigerWMS_/i.test(y2010.label + " " + y2010.spoken), false);
  const y2020acs = yc.tigerVintage(2020);
  assert.equal(y2020acs, "tigerWMS_Census2020");
  assert.equal(yc.tigerVintage(2005), null);
  assert.equal(yc.tigerVintageLabel("tigerWMS_Census2010"), "Census 2010");
  assert.equal(yc.tigerVintageLabel("tigerWMS_ACS2018"), "ACS 2018");
});

t("current-only layers are not stamped with a historical year", () => {
  yc.resetForTests({ now: () => new Date("2026-11-22T12:00:00-05:00") });
  const st = yc.statusFor({ kind: "current-weather" }, 2016);
  assert.equal(st.kind, "unavailable");
  assert.match(st.spoken, /not historical/i);
  const now = yc.statusFor({ kind: "current-weather" }, 2026);
  assert.equal(now.kind, "current-not-year-specific");
});

t("gibsTileUrl refuses a future date and uses the official REST shape", () => {
  yc.resetForTests({ now: () => new Date("2026-11-22T12:00:00-05:00") });
  const url = yc.gibsTileUrl("VIIRS_NOAA20_CorrectedReflectance_TrueColor", "2026-11-20");
  assert.equal(url, "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_NOAA20_CorrectedReflectance_TrueColor/default/2026-11-20/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg");
  assert.equal(yc.gibsTileUrl("VIIRS_NOAA20_CorrectedReflectance_TrueColor", "2027-01-01"), null);
  assert.equal(yc.eoxLayerId(2017, { nonCommercialAck: true }), null);
  assert.equal(yc.eoxLayerId(2016), "s2cloudless_3857");
  assert.equal(yc.eoxLayerId(2024, { nonCommercialAck: false }), null);
  assert.equal(yc.eoxLayerId(2024, { nonCommercialAck: true }), "s2cloudless-2024_3857");
});

console.log(n + " year-clock tests ok");
