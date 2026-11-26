// v1.5.1 regression: on a phone the Atlas list and the open entry must be two scroll panes, never overflow:visible.
// Before 1.5.1 both had overflow:visible with min-height:0 in a fixed-height grid, so rows collapsed and text overlapped.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
let n = 0;
const t = (name, fn) => { fn(); n++; console.log("ok", name); };
const css = readFileSync(new URL("../css/app.css", import.meta.url), "utf8");
const block = (css.match(/@media \(max-width: 820px\) \{\n  \/\* Opaque sheet[\s\S]*?\n\}/) || [])[0] || "";

t("the phone Atlas block exists", () => assert.ok(block.length > 200));
t("no overflow:visible on .at-browse or .at-detail on a phone", () => {
  assert.doesNotMatch(block, /\.at-browse[^{]*\{[^}]*overflow:\s*visible/);
  assert.doesNotMatch(block, /\.at-detail[^{]*\{[^}]*overflow:\s*visible/);
});
t("the list and the detail are scroll panes in a column", () => {
  assert.match(block, /\.at-body \{[^}]*display:\s*flex[^}]*flex-direction:\s*column[^}]*overflow:\s*hidden/);
  assert.match(block, /\.at-browse \{[^}]*overflow:\s*auto/);
  assert.match(block, /\.at-detail \{[^}]*overflow:\s*auto/);
});
t("the sheet is opaque and starts under the topbar", () => {
  assert.match(block, /\.atlas-view \{[^}]*top:\s*var\(--at-under-topbar[^}]*background:\s*var\(--gd-surface\)/);
});
t("source links keep 44px targets on a phone", () => assert.match(block, /\.at-detail li > a[^{]*\{[^}]*padding:\s*14px 0/));
t("desktop rules for .at-body are still a two-column grid", () => assert.match(css, /\.at-body \{ display: grid; grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1\.25fr\)/));
console.log(n + " passed");
