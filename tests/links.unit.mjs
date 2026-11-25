// Every relative link in tracked markdown and HTML resolves to a file in the tree.
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP_PREFIX = ["vendor/", "demo/vendor/"];
const TEXT = new Set([".md", ".html", ".htm", ".txt"]);

const MD_LINK = /!\[[^\]]*\]\(([^)]+)\)|\[[^\]]*\]\(([^)]+)\)/g;
const MD_REF_DEF = /^\s{0,3}\[[^\]]+\]:\s+(\S+)/gm;
const HTML_ATTR = /\b(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;

function tracked() {
  const r = spawnSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" });
  if (r.status !== 0) throw new Error("git ls-files failed");
  return r.stdout.split("\0").filter(Boolean);
}

function shouldSkip(file) {
  const posix = file.split(path.sep).join("/");
  return SKIP_PREFIX.some((p) => posix === p.slice(0, -1) || posix.startsWith(p));
}

function destPath(raw) {
  let url = String(raw || "").trim();
  if (!url) return null;
  // Markdown destination may be <path> or path "title"
  if (url.startsWith("<") && url.includes(">")) url = url.slice(1, url.indexOf(">"));
  const m = url.match(/^(\S+)/);
  if (!m) return null;
  url = m[1];
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("//")) return null; // http, mailto, data, …
  if (url.startsWith("#")) return null;
  return url.split("#")[0].split("?")[0];
}

function resolveFrom(file, dest) {
  if (dest.includes("<") || dest.includes(">")) {
    return { dest, abs: null, reason: "placeholder in relative link" };
  }
  const abs = dest.startsWith("/")
    ? path.resolve(ROOT, dest.slice(1))
    : path.resolve(ROOT, path.dirname(file), dest);
  return { dest, abs };
}

function maskCode(text) {
  // Do not treat examples in fenced or inline code as links.
  return text
    .replace(/```[\s\S]*?```/g, (m) => " ".repeat(m.length))
    .replace(/~~~[\s\S]*?~~~/g, (m) => " ".repeat(m.length))
    .replace(/`[^`]+`/g, (m) => " ".repeat(m.length));
}

function collect(file, text) {
  const ext = path.extname(file).toLowerCase();
  const found = [];
  const add = (raw, kind) => {
    const dest = destPath(raw);
    if (dest) found.push({ raw, dest, kind });
  };
  if (ext === ".md" || ext === ".txt") {
    const visible = maskCode(text);
    visible.replace(MD_LINK, (_, img, href) => { add(img || href, "md"); return _; });
    visible.replace(MD_REF_DEF, (_, href) => { add(href, "md-ref"); return _; });
    visible.replace(HTML_ATTR, (_, dq, sq) => { add(dq || sq, "html"); return _; });
  }
  if (ext === ".html" || ext === ".htm") {
    text.replace(HTML_ATTR, (_, dq, sq) => { add(dq || sq, "html"); return _; });
  }
  return found;
}

const files = tracked().filter((f) => TEXT.has(path.extname(f).toLowerCase()) && !shouldSkip(f));
const broken = [];
let checked = 0;
for (const file of files) {
  const text = readFileSync(path.join(ROOT, file), "utf8");
  for (const hit of collect(file, text)) {
    const { dest, abs, reason } = resolveFrom(file, hit.dest);
    checked++;
    if (reason) {
      broken.push(`${file} -> ${dest} (${reason})`);
      continue;
    }
    if (!existsSync(abs)) {
      broken.push(`${file} -> ${dest}`);
      continue;
    }
    // A link to a path must be a real file or directory (trailing slash ok).
    const st = statSync(abs);
    if (!st.isFile() && !st.isDirectory()) broken.push(`${file} -> ${dest} (not a file or directory)`);
  }
}

let n = 0;
const t = (name, fn) => { fn(); n++; console.log("ok -", name); };
t("every relative link in tracked markdown and HTML resolves", () => {
  assert.equal(broken.length, 0, broken.join("\n") || "no broken links");
});
t("the check looked at a real set of files and links", () => {
  assert.ok(files.length >= 20, "tracked text files: " + files.length);
  assert.ok(checked >= 50, "links checked: " + checked);
});
console.log(`${n} link tests ok (${checked} links in ${files.length} files)`);
