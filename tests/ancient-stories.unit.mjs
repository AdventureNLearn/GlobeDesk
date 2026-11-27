// Ancient World stories: each episode validates as globedesk.episode/2, cites UNESCO, pins only a site whose pin
// is shown, no sacred site remains held, and says the pin is approximate.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import vm from "node:vm";
import { SITES } from "../tools/atlas/ancient-content.mjs";
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok", name); };
const ctx = { window: {}, URL }; ctx.window.window = ctx.window; ctx.window.URL = URL; vm.createContext(ctx);
vm.runInContext(readFileSync(new URL("../js/schema.js", import.meta.url), "utf8"), ctx);
const S = ctx.window.GD.schema;
const files = readdirSync(new URL("../episodes/", import.meta.url)).filter((f) => /^ancient-world-.*\.globedesk\.json$/.test(f));
const eps = files.map((f) => JSON.parse(readFileSync(new URL("../episodes/" + f, import.meta.url), "utf8")));
t("at least one Ancient World episode, each valid globedesk.episode/2", () => {
  assert.ok(eps.length >= 1);
  eps.forEach((e, i) => assert.deepEqual(JSON.parse(JSON.stringify(S.validateEpisode(e))), [], files[i]));
});
t("every story cites a UNESCO page and marks its pin approximate", () => {
  eps.forEach((e) => e.stories.forEach((s) => {
    assert.ok(s.sources.some((x) => /^https:\/\/whc\.unesco\.org\/en\/list\/\d+\/$/.test(x.url)), s.id);
    assert.equal(s.location.precision, "approximate"); assert.equal(s.location.verified, false);
  }));
});
t("no sacred, Indigenous, burial or ritual site remains held (owner YES 2026-11-27 for all 12)", () => {
  assert.deepEqual(SITES.filter((x) => x.hold).map((x) => x.id), []);
  assert.equal(SITES.filter((x) => !x.hold).length, 13);
});
console.log(`${n} ancient story tests ok`);
