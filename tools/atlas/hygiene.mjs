// Shared hygiene check for shareable Atlas and desk files: no home paths, emails or secret-like strings.
// "secret" is matched only as the word secret/secrets, so ordinary words like "Secretary of State"
// (owner decision, OPEN-ITEMS #29) pass. Real credential shapes are matched directly, so narrowing
// the word rule does not weaken detection of actual keys.
export const HYGIENE_RULES = [
  ["home path", /\/home\/|\/workspace\/|C:\\\\(Users)?/i],
  ["email address", /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/],
  ["api key wording", /api[_-]?key/i],
  ["secret wording", /\bsecrets?\b/i],
  ["password wording", /\bpasswords?\b/i],
  ["bearer token", /\bbearer\s+[A-Za-z0-9._~+/-]{8,}/i],
  ["private key block", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["GitHub token", /\b(gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})\b/],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["Slack token", /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ["OpenAI-style key", /\bsk-[A-Za-z0-9_-]{20,}/],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{35}\b/],
];

// Returns the names of the rules a text breaks (empty when clean).
export function hygieneHits(text) {
  return HYGIENE_RULES.filter(([, re]) => re.test(text)).map(([name]) => name);
}
