/* Source classes (owner rule, Nov 24 2026). Official sources are primary or public records: government,
   standards bodies, or datasets with a named licence. The owner's own repos and Learning Lab cards are
   EXPERIMENTAL references: they may be linked, always labelled, kept in their own group, and never count
   as a record backing a claim. window.GD.sourceClass */
(function (root) {
  "use strict";
  const CLASSES = ["official", "reference", "experimental"];
  const EXPERIMENTAL_LABEL = "Experimental (not an official source)";
  // Owner-controlled hosts and paths: GitHub org repos, its Pages sites, and grok.me app hosts (Learning Lab included).
  const OWNER_URL = /^https:\/\/((www\.)?github\.com\/AdventureNLearn(\/|$)|adventurenlearn\.github\.io(\/|$)|([a-z0-9-]+\.)*grok\.me(\/|$)|(www\.)?x\.com\/AdventureNLearn(\/|$))/i;
  function isOwnerUrl(url) { return OWNER_URL.test(String(url || "")); }
  // The class a link must carry. An owner URL is always experimental, whatever it was tagged.
  function classOf(item) {
    if (item && isOwnerUrl(item.url)) return "experimental";
    return item && CLASSES.indexOf(item.class) >= 0 ? item.class : "reference";
  }
  // Rule: returns problems for a tagged item. An owner URL tagged official (or reference) is refused.
  function checkTag(item, where) {
    const p = [];
    if (!item) return p;
    if (item.class != null && CLASSES.indexOf(item.class) < 0) p.push(where + ": unknown source class " + item.class);
    if (isOwnerUrl(item.url) && item.class !== "experimental") p.push(where + ": owner repo or card must be class experimental, not " + (item.class || "untagged"));
    if (item.class === "official" && !/^https:\/\//.test(String(item.url || ""))) p.push(where + ": an official source needs an https link");
    return p;
  }
  // Only official sources count as backing for a claim.
  function officialOnly(list) { return (list || []).filter((s) => classOf(s) === "official"); }
  const api = { CLASSES, EXPERIMENTAL_LABEL, OWNER_URL, isOwnerUrl, classOf, checkTag, officialOnly };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else { root.GD = root.GD || {}; root.GD.sourceClass = api; }
})(typeof window !== "undefined" ? window : globalThis);
