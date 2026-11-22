/* Data-year clock. One integer year (and an optional day) drives dated imagery
   and official-GIS vintages. It is not the episode playback scrubber.
   window.GD.yearClock */
(function () {
  "use strict";
  const GD = (window.GD = window.GD || {});
  const YEAR_MIN = 1983;
  const FOLLOW_KEY = "globedesk.dataYear.followStory";
  const PROJECT_KEY = "globedesk.dataYear.showProjected";

  let nowFn = function () { return new Date(); };
  const listeners = [];

  const state = {
    year: 0,
    date: null,
    followStory: false,
    showProjected: true
  };

  function calendarYear() {
    const y = nowFn().getFullYear();
    return isFinite(y) ? y : YEAR_MIN;
  }

  function yearMax() { return calendarYear(); }

  function clampYear(y) {
    const n = Number(y);
    if (!isFinite(n)) return calendarYear();
    const v = Math.round(n);
    const max = yearMax();
    if (v < YEAR_MIN) return YEAR_MIN;
    if (v > max) return max;
    return v;
  }

  function readFlag(key, fallback) {
    try {
      if (typeof localStorage === "undefined" || !localStorage) return fallback;
      const v = localStorage.getItem(key);
      if (v === "1") return true;
      if (v === "0") return false;
    } catch (e) { /* private mode */ }
    return fallback;
  }

  function writeFlag(key, on) {
    try {
      if (typeof localStorage === "undefined" || !localStorage) return;
      localStorage.setItem(key, on ? "1" : "0");
    } catch (e) { /* private mode */ }
  }

  function parseStoryDate(s) {
    if (s == null) return null;
    const m = String(s).trim().match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?/);
    if (!m) return null;
    const year = Number(m[1]);
    if (!isFinite(year)) return null;
    const month = m[2] ? Number(m[2]) : 1;
    const day = m[3] ? Number(m[3]) : 1;
    if (month < 1 || month > 12 || day < 1 || day > 31) return { year: year, date: null };
    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    return { year: year, date: year + "-" + mm + "-" + dd };
  }

  function isoDay(y, m, d) {
    return String(y) + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0");
  }

  function isIsoDate(s) {
    return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
  }

  function cmpIso(a, b) {
    if (a === b) return 0;
    return a < b ? -1 : 1;
  }

  function inPeriod(day, start, end) {
    return cmpIso(day, start) >= 0 && cmpIso(day, end) <= 0;
  }

  function expandYears(list) {
    return list.slice();
  }

  /* Official recorded sets, from the v1.2 live-data plan (GIBS caps 22 Nov 2026). */
  const WELD_ANNUAL_YEARS = [1983, 1984, 1985, 1988, 1989, 1990, 1998, 1999, 2000];

  const TIGER_ACS_YEARS = [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2021, 2022, 2023, 2024, 2025, 2026];

  const EOX_CLOUDLESS_YEARS = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
  const EOX_DISABLED_YEARS = [2017];
  const EOX_NC_YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

  function weldDateFor(year) {
    if (WELD_ANNUAL_YEARS.indexOf(year) < 0) return null;
    return isoDay(year, 12, 1);
  }

  function defaultDayInYear(year) {
    return isoDay(year, 7, 1);
  }

  function daysInPeriods(periods) {
    /* periods: [{start, end}] inclusive ISO dates, daily. */
    return periods;
  }

  function dayInPeriods(day, periods) {
    for (let i = 0; i < periods.length; i++) {
      if (inPeriod(day, periods[i].start, periods[i].end)) return true;
    }
    return false;
  }

  function nearestDay(requested, periods) {
    if (!periods || !periods.length) return null;
    if (dayInPeriods(requested, periods)) return requested;
    let best = null;
    let bestDist = Infinity;
    function consider(day) {
      const dist = Math.abs(Date.parse(day + "T00:00:00Z") - Date.parse(requested + "T00:00:00Z"));
      if (!isFinite(dist)) return;
      /* Prefer earlier on a tie. */
      if (dist < bestDist || (dist === bestDist && best && day < best)) {
        best = day;
        bestDist = dist;
      }
    }
    periods.forEach(function (p) {
      consider(p.start);
      consider(p.end);
      if (requested >= p.start && requested <= p.end) consider(requested);
    });
    /* Also walk year-bounded midpoints? ends are enough for gap edges. */
    return best;
  }

  function latestDay(periods) {
    if (!periods || !periods.length) return null;
    let last = periods[0].end;
    periods.forEach(function (p) { if (p.end > last) last = p.end; });
    const today = isoDay(nowFn().getUTCFullYear(), nowFn().getUTCMonth() + 1, nowFn().getUTCDate());
    if (last > today) return today < periods[0].start ? periods[0].start : today;
    return last;
  }

  /* GIBS daily true-colour periods from EPSG:3857 best capabilities, 22 Nov 2026. */
  const GIBS_DAILY = {
    "MODIS_Terra_CorrectedReflectance_TrueColor": {
      tms: "GoogleMapsCompatible_Level9",
      ext: "jpg",
      periods: [
        { start: "2000-02-24", end: "2000-04-25" },
        { start: "2000-04-28", end: "2000-08-06" },
        { start: "2000-08-18", end: "2001-06-15" },
        { start: "2001-07-03", end: "2002-03-19" },
        { start: "2002-03-28", end: "2003-12-16" },
        { start: "2003-12-24", end: "2008-12-20" },
        { start: "2008-12-23", end: "2016-02-18" },
        { start: "2016-02-27", end: "2022-10-10" },
        { start: "2022-10-23", end: "2025-08-08" },
        { start: "2025-08-10", end: "2025-11-08" },
        { start: "2025-11-10", end: "2026-11-22" }
      ]
    },
    "MODIS_Aqua_CorrectedReflectance_TrueColor": {
      tms: "GoogleMapsCompatible_Level9",
      ext: "jpg",
      periods: [
        { start: "2002-07-03", end: "2002-07-30" },
        { start: "2002-08-07", end: "2002-09-12" },
        { start: "2002-09-14", end: "2022-03-31" },
        { start: "2022-04-17", end: "2026-11-22" }
      ]
    },
    "VIIRS_SNPP_CorrectedReflectance_TrueColor": {
      tms: "GoogleMapsCompatible_Level9",
      ext: "jpg",
      periods: [
        { start: "2015-11-24", end: "2022-07-27" },
        { start: "2022-08-10", end: "2024-05-31" },
        { start: "2024-06-04", end: "2024-07-11" },
        { start: "2024-07-16", end: "2024-07-24" },
        { start: "2024-07-29", end: "2024-11-03" },
        { start: "2024-11-06", end: "2026-04-28" },
        { start: "2026-04-30", end: "2026-07-10" },
        { start: "2026-07-16", end: "2026-11-02" }
      ]
    },
    "VIIRS_NOAA20_CorrectedReflectance_TrueColor": {
      tms: "GoogleMapsCompatible_Level9",
      ext: "jpg",
      periods: [
        { start: "2018-01-05", end: "2018-02-21" },
        { start: "2018-02-24", end: "2018-03-12" },
        { start: "2018-03-14", end: "2019-12-31" },
        { start: "2020-01-02", end: "2022-01-12" },
        { start: "2022-01-14", end: "2026-11-22" }
      ]
    },
    "VIIRS_NOAA21_CorrectedReflectance_TrueColor": {
      tms: "GoogleMapsCompatible_Level9",
      ext: "jpg",
      periods: [
        { start: "2023-02-10", end: "2023-02-23" },
        { start: "2023-02-25", end: "2023-03-09" },
        { start: "2023-03-11", end: "2023-04-17" },
        { start: "2023-04-19", end: "2023-07-08" },
        { start: "2023-07-10", end: "2023-08-26" },
        { start: "2023-08-28", end: "2023-11-21" },
        { start: "2023-11-23", end: "2024-01-14" },
        { start: "2024-01-16", end: "2024-02-26" },
        { start: "2024-02-29", end: "2026-11-22" }
      ]
    }
  };

  const GIBS_WELD = {
    id: "Landsat_WELD_CorrectedReflectance_TrueColor_Global_Annual",
    tms: "GoogleMapsCompatible_Level12",
    ext: "jpg"
  };

  function gibsTileUrl(layerId, date, z, y, x) {
    const daily = GIBS_DAILY[layerId];
    const meta = daily || (layerId === GIBS_WELD.id ? GIBS_WELD : null);
    if (!meta || !isIsoDate(date)) return null;
    if (cmpIso(date, isoDay(calendarYear(), nowFn().getMonth() + 1, nowFn().getDate())) > 0) return null;
    const zz = z == null ? "{z}" : String(z);
    const yy = y == null ? "{y}" : String(y);
    const xx = x == null ? "{x}" : String(x);
    return "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/" + layerId + "/default/" + date + "/" + meta.tms + "/" + zz + "/" + yy + "/" + xx + "." + meta.ext;
  }

  function eoxLayerId(year, opts) {
    opts = opts || {};
    if (year === 2016) return "s2cloudless_3857";
    if (EOX_DISABLED_YEARS.indexOf(year) >= 0) return null;
    if (EOX_NC_YEARS.indexOf(year) >= 0) {
      if (!opts.nonCommercialAck) return null;
      return "s2cloudless-" + year + "_3857";
    }
    return null;
  }

  function eoxTileUrl(year, opts) {
    const id = eoxLayerId(year, opts);
    if (!id) return null;
    return "https://tiles.maps.eox.at/wmts/1.0.0/" + id + "/default/g/{z}/{y}/{x}.jpg";
  }

  function tigerVintage(year) {
    if (year === 2010) return "tigerWMS_Census2010";
    if (year === 2020) return "tigerWMS_Census2020";
    if (TIGER_ACS_YEARS.indexOf(year) >= 0) return "tigerWMS_ACS" + year;
    return null;
  }

  function tigerVintageLabel(serviceId) {
    if (serviceId === "tigerWMS_Census2010") return "Census 2010";
    if (serviceId === "tigerWMS_Census2020") return "Census 2020";
    const m = /^tigerWMS_ACS(\d{4})$/.exec(serviceId || "");
    if (m) return "ACS " + m[1];
    return "";
  }

  function pickGibsDaily(year, date) {
    const order = [
      "VIIRS_NOAA20_CorrectedReflectance_TrueColor",
      "VIIRS_SNPP_CorrectedReflectance_TrueColor",
      "VIIRS_NOAA21_CorrectedReflectance_TrueColor",
      "MODIS_Terra_CorrectedReflectance_TrueColor",
      "MODIS_Aqua_CorrectedReflectance_TrueColor"
    ];
    const want = isIsoDate(date) ? date : defaultDayInYear(year);
    const today = isoDay(nowFn().getFullYear(), nowFn().getMonth() + 1, nowFn().getDate());
    const req = cmpIso(want, today) > 0 ? today : want;
    for (let i = 0; i < order.length; i++) {
      const id = order[i];
      const periods = GIBS_DAILY[id].periods;
      if (dayInPeriods(req, periods)) {
        return { layerId: id, date: req, kind: "recorded", periods: periods };
      }
    }
    let best = null;
    order.forEach(function (id) {
      const n = nearestDay(req, GIBS_DAILY[id].periods);
      if (!n) return;
      /* A frame in another calendar year is not "recorded for this year". */
      if (n.slice(0, 4) !== String(year)) return;
      const dist = Math.abs(Date.parse(n + "T00:00:00Z") - Date.parse(req + "T00:00:00Z"));
      if (!best || dist < best.dist || (dist === best.dist && n < best.date)) {
        best = { layerId: id, date: n, kind: "recorded-nearest", dist: dist };
      }
    });
    return best;
  }

  function bracketingRecordedYears(year, recordedYears) {
    let prev = null, next = null;
    recordedYears.forEach(function (y) {
      if (y < year && (prev == null || y > prev)) prev = y;
      if (y > year && (next == null || y < next)) next = y;
    });
    return { prev: prev, next: next };
  }

  function honestToProject(kind) {
    return kind === "imagery" || kind === "author-series" || kind === "dated-path";
  }

  function statusFor(layer, year, date, opts) {
    opts = opts || {};
    const y = clampYear(year == null ? state.year : year);
    const kind = (layer && layer.kind) || "unknown";
    const id = (layer && layer.id) || "";

    if (kind === "current-snapshot" || id === "usgs-topo" || id === "usgs-imagery" || id === "usgs-nhd") {
      const isCurrent = y === calendarYear();
      if (!isCurrent && !opts.showCurrentAnyway) {
        return {
          kind: "unavailable",
          requested: y,
          actual: null,
          label: "Current official data, not year-specific",
          spoken: "Current official data, not year-specific. Hidden for " + y + ".",
          sources: []
        };
      }
      return {
        kind: "current-not-year-specific",
        requested: y,
        actual: "current",
        label: "Current official data, not year-specific",
        spoken: "Current official data, not year-specific.",
        sources: []
      };
    }

    if (kind === "current-weather" || id === "nowcoast-radar" || id === "nowcoast-sst" || id === "nowcoast-cyclone") {
      if (y !== calendarYear()) {
        return {
          kind: "unavailable",
          requested: y,
          actual: null,
          label: "Current observations, not historical",
          spoken: "Current weather observations, not historical. Hidden for " + y + ".",
          sources: []
        };
      }
      return {
        kind: "current-not-year-specific",
        requested: y,
        actual: "current",
        label: "Current observations, not historical",
        spoken: "Current weather observations, not historical.",
        sources: []
      };
    }

    if (kind === "tiger" || id === "tiger-boundaries") {
      const v = tigerVintage(y);
      if (v) {
        const human = tigerVintageLabel(v) || ("Census " + y);
        return {
          kind: "recorded",
          requested: y,
          actual: v,
          label: "RECORDED · " + human,
          spoken: "Recorded " + human + " vintage for " + y + ".",
          sources: [v]
        };
      }
      return {
        kind: "unavailable",
        requested: y,
        actual: null,
        label: "Unavailable — no Census vintage for " + y,
        spoken: "No Census vintage for " + y + ". Legal boundaries are not projected.",
        sources: [],
        projectable: false
      };
    }

    if (kind === "eox-cloudless" || id === "eox-cloudless") {
      const ack = !!opts.nonCommercialAck;
      const layerId = eoxLayerId(y, { nonCommercialAck: ack });
      if (layerId) {
        return {
          kind: "recorded",
          requested: y,
          actual: y,
          layerId: layerId,
          tiles: eoxTileUrl(y, { nonCommercialAck: ack }),
          label: "RECORDED · EOX " + y,
          spoken: "Recorded EOX Sentinel-2 cloudless imagery for " + y + ".",
          sources: ["EOX " + y]
        };
      }
      const enabled = [2016].concat(ack ? EOX_NC_YEARS : []);
      const br = bracketingRecordedYears(y, enabled);
      if (opts.showProjected !== false && honestToProject("imagery") && (br.prev != null || br.next != null)) {
        const sources = [];
        if (br.prev != null) sources.push("EOX " + br.prev);
        if (br.next != null) sources.push("EOX " + br.next);
        const from = br.prev != null && br.next != null
          ? ("Visual blend of recorded EOX " + br.prev + " and EOX " + br.next)
          : ("Projected from recorded EOX " + (br.prev != null ? br.prev : br.next));
        return {
          kind: "projected",
          requested: y,
          actual: null,
          prev: br.prev,
          next: br.next,
          prevTiles: br.prev != null ? eoxTileUrl(br.prev, { nonCommercialAck: ack }) : null,
          nextTiles: br.next != null ? eoxTileUrl(br.next, { nonCommercialAck: ack }) : null,
          label: "PROJECTED · " + y,
          spoken: "Projected view for " + y + ". " + from + ". This is an estimate, not recorded imagery for " + y + ".",
          credit: "PROJECTED view for " + y + ". " + from + ". This is an estimate, not recorded imagery for " + y + ".",
          sources: sources
        };
      }
      return {
        kind: "unavailable",
        requested: y,
        actual: null,
        label: "No recorded EOX mosaic for " + y,
        spoken: "No recorded EOX mosaic for " + y + ".",
        sources: []
      };
    }

    if (kind === "gibs-weld" || id === "gibs-weld") {
      const d = weldDateFor(y);
      if (d) {
        return {
          kind: "recorded",
          requested: y,
          actual: d,
          layerId: GIBS_WELD.id,
          tiles: gibsTileUrl(GIBS_WELD.id, d),
          label: "RECORDED · Landsat WELD " + d,
          spoken: "Recorded Landsat WELD annual imagery for " + d + ".",
          sources: [GIBS_WELD.id]
        };
      }
      const br = bracketingRecordedYears(y, WELD_ANNUAL_YEARS);
      if (opts.showProjected !== false && (br.prev != null || br.next != null)) {
        const sources = [];
        if (br.prev != null) sources.push("WELD " + br.prev);
        if (br.next != null) sources.push("WELD " + br.next);
        const from = br.prev != null && br.next != null
          ? ("Visual blend of recorded Landsat WELD " + br.prev + " and " + br.next)
          : ("Projected from recorded Landsat WELD " + (br.prev != null ? br.prev : br.next));
        return {
          kind: "projected",
          requested: y,
          actual: null,
          prev: br.prev,
          next: br.next,
          prevTiles: br.prev != null ? gibsTileUrl(GIBS_WELD.id, weldDateFor(br.prev)) : null,
          nextTiles: br.next != null ? gibsTileUrl(GIBS_WELD.id, weldDateFor(br.next)) : null,
          label: "PROJECTED · " + y,
          spoken: "Projected view for " + y + ". " + from + ". This is an estimate, not recorded imagery for " + y + ".",
          credit: "PROJECTED view for " + y + ". " + from + ". This is an estimate, not recorded imagery for " + y + ".",
          sources: sources
        };
      }
      return { kind: "unavailable", requested: y, actual: null, label: "No Landsat WELD year " + y, spoken: "No recorded Landsat WELD imagery for " + y + ".", sources: [] };
    }

    if (kind === "gibs-daily" || id === "gibs-daily") {
      const pick = pickGibsDaily(y, date || state.date);
      if (pick && pick.date) {
        const same = pick.date === (isIsoDate(date) ? date : defaultDayInYear(y)) || pick.date.slice(0, 4) === String(y);
        const nearest = pick.date !== (isIsoDate(date || defaultDayInYear(y)) ? (date || defaultDayInYear(y)) : pick.date);
        const requestedDay = isIsoDate(date) ? date : defaultDayInYear(y);
        const isNearest = pick.date !== requestedDay;
        return {
          kind: isNearest ? "recorded-nearest" : "recorded",
          requested: y,
          requestedDate: requestedDay,
          actual: pick.date,
          layerId: pick.layerId,
          tiles: gibsTileUrl(pick.layerId, pick.date),
          label: isNearest
            ? ("RECORDED, nearest available: " + pick.date + " (requested " + requestedDay + ")")
            : ("RECORDED · GIBS " + pick.date),
          spoken: isNearest
            ? ("Recorded GIBS daily true colour, nearest available " + pick.date + ", requested " + requestedDay + ". Not projected.")
            : ("Recorded GIBS daily true colour, date " + pick.date + "."),
          sources: [pick.layerId]
        };
      }
      return { kind: "unavailable", requested: y, actual: null, label: "No GIBS daily frame", spoken: "No recorded GIBS daily imagery for " + y + ".", sources: [] };
    }

    if (kind === "blue-marble" || id === "bluemarble") {
      return {
        kind: "current-not-year-specific",
        requested: y,
        actual: "2004-08",
        label: "Not year-specific (Blue Marble, August 2004)",
        spoken: "NASA Blue Marble is not year-specific. August 2004 product.",
        sources: ["BlueMarble_ShadedRelief_Bathymetry"]
      };
    }

    return { kind: "none", requested: y, actual: null, label: "", spoken: "", sources: [] };
  }


  function projectedDistance(st, y) {
    if (!st || st.kind !== "projected") return Infinity;
    const ds = [];
    if (st.prev != null) ds.push(Math.abs(y - st.prev));
    if (st.next != null) ds.push(Math.abs(y - st.next));
    if (!ds.length) return Infinity;
    return Math.min.apply(null, ds);
  }

  function defaultImageryStatus(year, date, opts) {
    opts = opts || {};
    const y = clampYear(year == null ? state.year : year);
    const eox = statusFor({ kind: "eox-cloudless" }, y, date, opts);
    if (eox.kind === "recorded") return Object.assign({ stack: "eox" }, eox);
    const weld = statusFor({ kind: "gibs-weld" }, y, date, opts);
    if (weld.kind === "recorded") return Object.assign({ stack: "weld" }, weld);
    const daily = statusFor({ kind: "gibs-daily" }, y, date, opts);
    if (daily.kind === "recorded" || daily.kind === "recorded-nearest") return Object.assign({ stack: "gibs-daily" }, daily);
    if (opts.showProjected !== false) {
      /* Prefer the tighter recorded bracket, so 1995 blends WELD 1990/1998
         rather than stretching from the 2016 EOX mosaic. */
      const scored = [];
      if (eox.kind === "projected") scored.push({ stack: "eox", st: eox, dist: projectedDistance(eox, y) });
      if (weld.kind === "projected") scored.push({ stack: "weld", st: weld, dist: projectedDistance(weld, y) });
      scored.sort(function (a, b) {
        if (a.dist !== b.dist) return a.dist - b.dist;
        const ab = (a.st.prev != null && a.st.next != null) ? 0 : 1;
        const bb = (b.st.prev != null && b.st.next != null) ? 0 : 1;
        return ab - bb;
      });
      if (scored.length) return Object.assign({ stack: scored[0].stack }, scored[0].st);
    }
    if (daily.kind !== "none") return Object.assign({ stack: "gibs-daily" }, daily);
    return { kind: "unavailable", requested: y, actual: null, label: "No recorded data", spoken: "No recorded data for " + y + ".", sources: [], stack: "none" };
  }

  function chipText(st) {
    if (!st || !st.kind || st.kind === "none") return "";
    if (st.kind === "projected") return "PROJECTED";
    if (st.kind === "recorded") return "RECORDED";
    if (st.kind === "recorded-nearest") return "NEAREST";
    if (st.kind === "current-not-year-specific") return "CURRENT";
    if (st.kind === "unavailable") return "UNAVAILABLE";
    return "";
  }

  function notify() {
    const snap = snapshot();
    listeners.slice().forEach(function (fn) {
      try { fn(snap); } catch (e) { /* listener errors must not break the clock */ }
    });
  }

  function snapshot() {
    return {
      year: state.year,
      date: state.date,
      followStory: state.followStory,
      showProjected: state.showProjected,
      min: YEAR_MIN,
      max: yearMax()
    };
  }

  function setYear(y, opts) {
    opts = opts || {};
    const next = clampYear(y);
    const prev = state.year;
    /* A year-only change drops a previously pinned day, unless the caller is
       also setting a date, or follow-story just supplied one. */
    if (!opts.keepDate) state.date = null;
    state.year = next;
    if (opts.silent) return snapshot();
    if (next !== prev || !opts.keepDate) notify();
    return snapshot();
  }

  function setDate(iso, opts) {
    opts = opts || {};
    if (iso == null || iso === "") {
      state.date = null;
      if (!opts.silent) notify();
      return snapshot();
    }
    if (!isIsoDate(iso)) return snapshot();
    const today = isoDay(nowFn().getFullYear(), nowFn().getMonth() + 1, nowFn().getDate());
    const day = cmpIso(iso, today) > 0 ? today : iso;
    const y = Number(day.slice(0, 4));
    state.date = day;
    state.year = clampYear(y);
    if (!opts.silent) notify();
    return snapshot();
  }

  function setFollowStory(on, opts) {
    state.followStory = !!on;
    writeFlag(FOLLOW_KEY, state.followStory);
    if (!opts || !opts.silent) notify();
    return snapshot();
  }

  function setShowProjected(on, opts) {
    state.showProjected = !!on;
    writeFlag(PROJECT_KEY, state.showProjected);
    if (!opts || !opts.silent) notify();
    return snapshot();
  }

  function applyStoryDate(dateStr, opts) {
    if (!state.followStory) return snapshot();
    const parsed = parseStoryDate(dateStr);
    if (!parsed) return snapshot();
    const playbackT = opts && opts.playbackT;
    /* Must not mutate playback time. We only read the story date string. */
    void playbackT;
    setYear(parsed.year, { silent: true, keepDate: true });
    if (parsed.date) setDate(parsed.date, { silent: true });
    else state.date = null;
    if (!opts || !opts.silent) notify();
    return snapshot();
  }

  function onChange(fn) {
    if (typeof fn === "function") listeners.push(fn);
    return function () {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  }


  function yearBadgeSpec(opts) {
    let st = null;
    if (!opts && GD.layers && GD.layers.datedSatSpec) {
      const spec = GD.layers.datedSatSpec();
      if (spec && spec.status) st = spec.status;
    }
    if (!st) {
      st = defaultImageryStatus(undefined, undefined, opts || {
        nonCommercialAck: !!(GD.layers && GD.layers.eoxNonCommercialAck && GD.layers.eoxNonCommercialAck()),
        showProjected: state.showProjected
      });
    }
    if (!st || st.kind === "none") return null;
    const year = state.year;
    let text = "";
    if (st.kind === "projected") text = "PROJECTED · " + year;
    else if (st.kind === "recorded") text = st.label || ("RECORDED · " + year);
    else if (st.kind === "recorded-nearest") text = st.label || ("NEAREST · " + year);
    else return { kind: st.kind, text: st.label || "", spoken: st.spoken || "", credit: st.credit || st.spoken || "", status: st };
    return { kind: st.kind, text: text, spoken: st.spoken || "", credit: st.credit || st.spoken || "", status: st };
  }

  function resetForTests(opts) {
    opts = opts || {};
    if (opts.now) nowFn = opts.now;
    else nowFn = function () { return new Date(); };
    listeners.length = 0;
    state.followStory = false;
    state.showProjected = true;
    state.date = null;
    state.year = clampYear(calendarYear());
  }

  state.followStory = readFlag(FOLLOW_KEY, false);
  state.showProjected = readFlag(PROJECT_KEY, true);
  state.year = clampYear(calendarYear());

  GD.yearClock = {
    YEAR_MIN: YEAR_MIN,
    WELD_ANNUAL_YEARS: expandYears(WELD_ANNUAL_YEARS),
    TIGER_ACS_YEARS: expandYears(TIGER_ACS_YEARS),
    EOX_NC_YEARS: expandYears(EOX_NC_YEARS),
    calendarYear: calendarYear,
    yearMax: yearMax,
    clampYear: clampYear,
    parseStoryDate: parseStoryDate,
    getYear: function () { return state.year; },
    getDate: function () { return state.date; },
    isFollowStory: function () { return state.followStory; },
    isShowProjected: function () { return state.showProjected; },
    setYear: setYear,
    setDate: setDate,
    setFollowStory: setFollowStory,
    setShowProjected: setShowProjected,
    applyStoryDate: applyStoryDate,
    statusFor: statusFor,
    defaultImageryStatus: defaultImageryStatus,
    chipText: chipText,
    yearBadgeSpec: yearBadgeSpec,
    gibsTileUrl: gibsTileUrl,
    eoxLayerId: eoxLayerId,
    eoxTileUrl: eoxTileUrl,
    tigerVintage: tigerVintage,
    tigerVintageLabel: tigerVintageLabel,
    weldDateFor: weldDateFor,
    honestToProject: honestToProject,
    onChange: onChange,
    snapshot: snapshot,
    resetForTests: resetForTests
  };
})();
