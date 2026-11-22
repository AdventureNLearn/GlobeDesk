// Lock tests for sidecar rules and globedesk.claims/1. No browser, no network.
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { validateSchema } from "./jsonschema-lite.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ctx = { window: {}, Date, URL, TextEncoder, TextDecoder, Uint8Array, ArrayBuffer, DataView, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, "data", "land.js"), "utf8"), ctx);
for (const f of ["themes", "captions", "events-model", "sanitize", "zip", "schema", "model"]) {
  vm.runInContext(fs.readFileSync(path.join(root, "js", f + ".js"), "utf8"), ctx);
}
const { schema, model } = ctx.window.GD;
const J = (v) => JSON.parse(JSON.stringify(v));
assert.deepEqual = ((orig) => (a, b, m) => orig(J(a), J(b), m))(assert.deepEqual);
let n = 0;
const t = (name, fn) => { fn(); n++; console.log("ok -", name); };

const dc = JSON.parse(fs.readFileSync(path.join(root, "episodes", "washington-dc-demo.globedesk.json"), "utf8"));
const newsdesk = JSON.parse(fs.readFileSync(path.join(root, "newsdesk/topics/newsdesk-50.globedesk.json"), "utf8"));
const EPISODES = [
  "episodes/blank.globedesk.json",
  "episodes/washington-dc-demo.globedesk.json",
  "newsdesk/episodes/newsdesk-chokepoints.globedesk.json",
  "newsdesk/episodes/newsdesk-civic.globedesk.json",
  "newsdesk/episodes/newsdesk-memory.globedesk.json",
  "newsdesk/episodes/newsdesk-science.globedesk.json",
  "newsdesk/topics/newsdesk-50.globedesk.json",
  "starter/episode-template.globedesk.json"
];

function claimsDoc(claims) {
  return { schema: "globedesk.claims/1", claims };
}

t("all eight shipped episodes still validate as globedesk.episode/2", () => {
  assert.equal(EPISODES.length, 8);
  EPISODES.forEach((rel) => {
    const ep = JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
    assert.equal(ep.schema, "globedesk.episode/2", rel);
    assert.deepEqual(schema.validate(ep), [], rel);
    assert.deepEqual(model.validate(ep), [], rel);
    if (schema.validateEpisode) assert.deepEqual(schema.validateEpisode(ep), [], rel);
  });
  assert.equal(newsdesk.stories.length, 50);
});

t("unknown keys on the episode, a story, a card, and a fact still fail", () => {
  const ep = J(dc);
  ep.extra = 1;
  assert.ok(schema.validate(ep).some((e) => /unknown key/.test(e)));
  const ep2 = J(dc);
  ep2.stories[0].mystery = true;
  assert.ok(schema.validate(ep2).some((e) => /unknown key/.test(e)));
  const ep3 = J(dc);
  ep3.stories[0].cards[0].bonus = "x";
  assert.ok(schema.validate(ep3).some((e) => /unknown key/.test(e)));
  const ep4 = J(dc);
  ep4.stories[0].cards[0].facts[0].claimStatus = "supported";
  const errs = schema.validate(ep4);
  assert.ok(errs.some((e) => /unknown key/.test(e) && /claimStatus/.test(e)), errs.join("; "));
});

t("an empty claims sidecar validates, and a missing sidecar is not required to load an episode", () => {
  assert.deepEqual(schema.validateClaims(claimsDoc([])), []);
  assert.deepEqual(schema.validate(dc), []);
});

t("claims sidecar rejects the wrong schema and unknown keys", () => {
  assert.ok(schema.validateClaims({ schema: "globedesk.episode/2", claims: [] }).some((e) => /schema must be/.test(e)));
  assert.ok(schema.validateClaims({ schema: "globedesk.claims/1", claims: [], secret: 1 }).some((e) => /unknown key/.test(e)));
  assert.ok(schema.validateClaims({ schema: "globedesk.claims/1", claims: [{ storyId: "story-lincoln", invented: true }] }).some((e) => /unknown key/.test(e)));
});

t("a valid supported claim against the DC sample is accepted", () => {
  const doc = claimsDoc([
    {
      id: "claim-lincoln-place",
      storyId: "story-lincoln",
      cardId: "card-lincoln",
      factIndex: 0,
      factLabel: "Place",
      claimStatus: "supported",
      sourceIds: ["src-nps-linc"]
    }
  ]);
  assert.deepEqual(schema.validateClaims(doc, dc), []);
});

t("people-disagree requires two groups, and both source ids must exist on the story", () => {
  const base = {
    storyId: "story-lincoln",
    cardId: "card-lincoln",
    factIndex: 1,
    factLabel: "View",
    claimStatus: "people-disagree"
  };
  const one = claimsDoc([Object.assign({}, base, { disagree: [{ sourceIds: ["src-nps-linc"], position: "One official wording." }] })]);
  assert.ok(schema.validateClaims(one, dc).some((e) => /at least two disagree groups/.test(e)));

  const badSrc = claimsDoc([
    Object.assign({}, base, {
      disagree: [
        { sourceIds: ["src-nps-linc"], position: "Wording in the Lincoln Memorial record." },
        { sourceIds: ["src-not-on-story"], position: "A source that is not on the story." }
      ]
    })
  ]);
  assert.ok(schema.validateClaims(badSrc, dc).some((e) => /not a source on the story/.test(e)));

  const ok = claimsDoc([
    Object.assign({}, base, {
      disagree: [
        { sourceIds: ["src-nps-linc"], position: "Wording in the Lincoln Memorial record." },
        { sourceIds: ["src-nps-mall"], position: "Wording in the National Mall record." }
      ]
    })
  ]);
  assert.deepEqual(schema.validateClaims(ok, dc), []);
});

t("claimStatus, cardId, factIndex, and storyId are checked", () => {
  const badStatus = claimsDoc([{ storyId: "story-lincoln", claimStatus: "true" }]);
  assert.ok(schema.validateClaims(badStatus, dc).some((e) => /claimStatus must be/.test(e)));
  const badStory = claimsDoc([{ storyId: "story-missing", claimStatus: "not-proven" }]);
  assert.ok(schema.validateClaims(badStory, dc).some((e) => /not a story/.test(e)));
  const badCard = claimsDoc([{ storyId: "story-lincoln", cardId: "card-missing", claimStatus: "disputed" }]);
  assert.ok(schema.validateClaims(badCard, dc).some((e) => /not a card/.test(e)));
  const badFact = claimsDoc([{ storyId: "story-lincoln", cardId: "card-lincoln", factIndex: 99, claimStatus: "supported" }]);
  assert.ok(schema.validateClaims(badFact, dc).some((e) => /not a fact/.test(e)));
});

t("people-disagree rejects empty groups, and disagree is only for people-disagree", () => {
  const base = {
    storyId: "story-lincoln",
    cardId: "card-lincoln",
    factIndex: 1,
    factLabel: "View",
    claimStatus: "people-disagree"
  };
  const emptyObjs = claimsDoc([Object.assign({}, base, { disagree: [{}, {}] })]);
  const emptyObjErrs = schema.validateClaims(emptyObjs, dc);
  assert.ok(emptyObjErrs.some((e) => /sourceIds must have at least one id/.test(e)), emptyObjErrs.join("; "));
  assert.ok(emptyObjErrs.some((e) => /position must be a non-empty string/.test(e)), emptyObjErrs.join("; "));

  const emptyFields = claimsDoc([Object.assign({}, base, {
    disagree: [
      { sourceIds: [], position: "" },
      { sourceIds: [], position: "" }
    ]
  })]);
  const emptyFieldErrs = schema.validateClaims(emptyFields, dc);
  assert.ok(emptyFieldErrs.some((e) => /sourceIds must have at least one id/.test(e)), emptyFieldErrs.join("; "));
  assert.ok(emptyFieldErrs.some((e) => /position must be a non-empty string/.test(e)), emptyFieldErrs.join("; "));

  const onSupported = claimsDoc([{
    storyId: "story-lincoln",
    cardId: "card-lincoln",
    factIndex: 0,
    factLabel: "Place",
    claimStatus: "supported",
    sourceIds: ["src-nps-linc"],
    disagree: [
      { sourceIds: ["src-nps-linc"], position: "One wording." },
      { sourceIds: ["src-nps-mall"], position: "Another wording." }
    ]
  }]);
  assert.ok(schema.validateClaims(onSupported, dc).some((e) => /only allowed on people-disagree/.test(e)));
});

t("factLabel and factIndex are checked, and they need a cardId", () => {
  const noCard = claimsDoc([{ storyId: "story-lincoln", factIndex: 0, claimStatus: "supported" }]);
  assert.ok(schema.validateClaims(noCard, dc).some((e) => /need a cardId/.test(e)));
  const badLabel = claimsDoc([{
    storyId: "story-lincoln",
    cardId: "card-lincoln",
    factIndex: 0,
    factLabel: "Not a real fact",
    claimStatus: "supported",
    sourceIds: ["src-nps-linc"]
  }]);
  assert.ok(schema.validateClaims(badLabel, dc).some((e) => /factLabel/.test(e)));
  const missingLabel = claimsDoc([{
    storyId: "story-lincoln",
    cardId: "card-lincoln",
    factLabel: "Not a real fact",
    claimStatus: "supported"
  }]);
  assert.ok(schema.validateClaims(missingLabel, dc).some((e) => /factLabel is not a fact/.test(e)));
});

t("duplicate claim ids and explicit nulls are rejected, and storyId must be non-empty", () => {
  const dup = claimsDoc([
    { id: "claim-a", storyId: "story-lincoln", claimStatus: "supported" },
    { id: "claim-a", storyId: "story-lincoln", claimStatus: "not-proven" }
  ]);
  assert.ok(schema.validateClaims(dup, dc).some((e) => /duplicate id/.test(e)));
  const nulls = claimsDoc([{ storyId: "story-lincoln", cardId: null, factIndex: null, claimStatus: null }]);
  const nullErrs = schema.validateClaims(nulls, dc);
  assert.ok(nullErrs.some((e) => /cardId/.test(e)), nullErrs.join("; "));
  assert.ok(nullErrs.some((e) => /factIndex/.test(e)), nullErrs.join("; "));
  assert.ok(nullErrs.some((e) => /claimStatus/.test(e)), nullErrs.join("; "));
  const emptyStory = claimsDoc([{ storyId: "", claimStatus: "supported" }]);
  assert.ok(schema.validateClaims(emptyStory).some((e) => /storyId missing/.test(e)));
  const wsStory = claimsDoc([{ storyId: "  ", claimStatus: "supported" }]);
  assert.ok(schema.validateClaims(wsStory).some((e) => /storyId missing/.test(e)));
  const emptyId = claimsDoc([{ id: "", storyId: "story-lincoln", claimStatus: "supported" }]);
  assert.ok(schema.validateClaims(emptyId, dc).some((e) => /id must not be empty/.test(e)));
  const wsId = claimsDoc([{ id: "  ", storyId: "story-lincoln", claimStatus: "supported" }]);
  assert.ok(schema.validateClaims(wsId, dc).some((e) => /id must not be empty/.test(e)));
});

t("a whitespace-only disagree position is rejected", () => {
  const doc = claimsDoc([{
    storyId: "story-lincoln",
    cardId: "card-lincoln",
    factIndex: 1,
    factLabel: "View",
    claimStatus: "people-disagree",
    disagree: [
      { sourceIds: ["src-nps-linc"], position: "   " },
      { sourceIds: ["src-nps-mall"], position: "Wording in the National Mall record." }
    ]
  }]);
  assert.ok(schema.validateClaims(doc, dc).some((e) => /position must be a non-empty string/.test(e)));
});

t("the claims JSON Schema file rejects the same invalid fixtures", () => {
  const claimsSchema = JSON.parse(fs.readFileSync(path.join(root, "schema/globedesk-claims.schema.json"), "utf8"));
  const ok = claimsDoc([{
    id: "claim-lincoln-place",
    storyId: "story-lincoln",
    cardId: "card-lincoln",
    factIndex: 0,
    factLabel: "Place",
    claimStatus: "supported",
    sourceIds: ["src-nps-linc"]
  }]);
  assert.deepEqual(validateSchema(claimsSchema, ok), []);
  const emptyPos = claimsDoc([{
    storyId: "story-lincoln",
    claimStatus: "people-disagree",
    disagree: [
      { sourceIds: ["src-nps-linc"], position: " " },
      { sourceIds: ["src-nps-mall"], position: "Other wording." }
    ]
  }]);
  assert.ok(validateSchema(claimsSchema, emptyPos).length, "whitespace position should fail the schema");
  const emptyId = claimsDoc([{ id: "", storyId: "story-lincoln", claimStatus: "supported" }]);
  assert.ok(validateSchema(claimsSchema, emptyId).length, "empty id should fail the schema");
  const wsId = claimsDoc([{ id: "  ", storyId: "story-lincoln", claimStatus: "supported" }]);
  assert.ok(validateSchema(claimsSchema, wsId).length, "whitespace id should fail the schema");
  const wsStory = claimsDoc([{ storyId: "  ", claimStatus: "supported" }]);
  assert.ok(validateSchema(claimsSchema, wsStory).length, "whitespace storyId should fail the schema");
  const noCard = claimsDoc([{ storyId: "story-lincoln", factIndex: 0, claimStatus: "supported" }]);
  assert.ok(validateSchema(claimsSchema, noCard).some((e) => /cardId/.test(e)), validateSchema(claimsSchema, noCard).join("; "));
  const oneGroup = claimsDoc([{
    storyId: "story-lincoln",
    claimStatus: "people-disagree",
    disagree: [{ sourceIds: ["src-nps-linc"], position: "One official wording." }]
  }]);
  assert.ok(validateSchema(claimsSchema, oneGroup).length, "one disagree group should fail the schema");
});

t("jsonschema-lite throws on unknown keywords", () => {
  assert.throws(() => validateSchema({ type: "object", oneOf: [] }, {}), /unsupported JSON Schema keyword: oneOf/);
  assert.throws(() => validateSchema({ type: "number", maximum: 1 }, 0), /unsupported JSON Schema keyword: maximum/);
  assert.throws(() => validateSchema({ type: ["string", "null"] }, "x"), /unsupported type array/);
});

t("CLAIMS_SCHEMA and CLAIM_STATUS are exported", () => {
  assert.equal(schema.CLAIMS_SCHEMA, "globedesk.claims/1");
  assert.deepEqual(schema.CLAIM_STATUS, ["supported", "not-proven", "disputed", "people-disagree"]);
  assert.deepEqual(schema.KEYS.fact, ["label", "value"]);
});

console.log(n + " passing");
