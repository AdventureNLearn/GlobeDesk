// Shared helpers for the Atlas build and validator. Pure Node, no network.
import { readFileSync, statSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");  // repo root
export const ATLAS = path.join(ROOT, "atlas");
export const MAX_BYTES = 50 * 1024 * 1024;
export const CATEGORY_PACKS = ["energy", "objects", "chemistry", "economics"]; // packs written so far
export const J = (p) => JSON.parse(readFileSync(path.join(ATLAS, p), "utf8"));
export const JR = (p) => JSON.parse(readFileSync(path.join(ROOT, p), "utf8")); // repo-root relative (schemas, records)
export const sha = (buf) => createHash("sha256").update(buf).digest("hex");
export const fileInfo = (abs) => ({ bytes: statSync(abs).size, sha256: sha(readFileSync(abs)) });
export const exists = (rel) => existsSync(path.join(ROOT, rel));
export const packSha = (files) => sha(files.map((f) => `${f.sha256}  ${f.path}\n`).join(""));

export function allEntries() {
  return CATEGORY_PACKS.flatMap((p) => J(`packs/${p}/entries.json`).entries);
}

// Day count between two ISO dates (YYYY-MM-DD).
export function daysBetween(a, b) {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
}

export const DATE_FORM = { year: /^-?[0-9]{1,4}$/, month: /^-?[0-9]{1,4}-(0[1-9]|1[0-2])$/, day: /^-?[0-9]{1,4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/ };
