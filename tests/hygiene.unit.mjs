// OPEN-ITEMS #29 (owner decision 2026-11-24): "Secretary of State" is not a secret; real secrets still are.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hygieneHits } from "../tools/atlas/hygiene.mjs";
let n = 0;
const t = (name, fn) => { fn(); n++; console.log("ok -", name); };
t("ordinary words pass: Secretary of State, secretariat, Secretary of War", () => {
  for (const s of ["William Seward, Secretary of State, signed it.", "the UN Secretariat", "Secretary of War Henry Stimson", "Office of the Secretary of State"]) assert.deepEqual(hygieneHits(s), [], s);
});
t("the word secret and real credential shapes are still caught", () => {
  const fakeGh = "ghp_" + "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8";
  const cases = [["client secret: x", "secret wording"], ["secrets.json", "secret wording"], ["token " + fakeGh, "GitHub token"],
    ["AKIA" + "ABCDEFGHIJKLMNOP", "AWS access key"], ["Authorization: Bearer abcdefghijk123", "bearer token"], ["-----BEGIN RSA PRIVATE KEY-----", "private key block"],
    ["key sk-" + "abcdefghijklmnopqrstuvwx", "OpenAI-style key"], ["xoxb-" + "1234567890-abc", "Slack token"], ["/home/someone/x", "home path"], ["a.person@example.org", "email address"], ["my password", "password wording"], ["api_key=1", "api key wording"]];
  for (const [s, rule] of cases) assert.ok(hygieneHits(s).includes(rule), s + " -> " + hygieneHits(s));
});
t("the shipped history pack mentions a Secretary and passes", () => {
  const s = readFileSync(new URL("../atlas/packs/history-places/entries.json", import.meta.url), "utf8");
  assert.match(s, /Secretary/); assert.deepEqual(hygieneHits(s), []);
});
console.log(`${n} hygiene tests ok`);
