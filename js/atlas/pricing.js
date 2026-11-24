// Region pricing: picks the coarse region file, totals only checked prices, never guesses.
(function (root) {
  const UNKNOWN = "[UNKNOWN]";
  // region "US-FL" falls back to "US"; no finer than ISO 3166-2.
  function resolve(regionCode, available) {
    const code = String(regionCode || "").toUpperCase();
    if (!/^[A-Z]{2}(-[A-Z0-9]{1,3})?$/.test(code)) return null;
    if (available.includes(code)) return code;
    const country = code.slice(0, 2);
    return available.includes(country) ? country : null;
  }
  // Returns per-part lines and a partial total; any unknown part makes the total partial.
  function quote(record, optionId, prices) {
    const lines = record.parts.map((p) => {
      const qty = p.qty[optionId];
      const rows = (prices ? prices.rows : []).filter((r) => r.object === record.id && r.part === p.id && r.status === "checked");
      if (qty === 0) return { part: p.id, qty: 0, low: 0, status: "not-needed" };
      if (typeof qty !== "number" || !rows.length) return { part: p.id, qty: typeof qty === "number" ? qty : UNKNOWN, low: UNKNOWN, status: "unknown" };
      const low = Math.min(...rows.map((r) => r.low));
      return { part: p.id, qty, low: Math.round(low * qty * 100) / 100, status: "checked", checked: rows.map((r) => r.checked).sort()[0], sources: rows.map((r) => r.url) };
    });
    const known = lines.filter((l) => l.status === "checked");
    const unknown = lines.filter((l) => l.status === "unknown").map((l) => l.part);
    const total = Math.round(known.reduce((s, l) => s + l.low, 0) * 100) / 100;
    return { currency: prices ? prices.currency : UNKNOWN, lines, knownTotalLow: total, unknownParts: unknown, complete: unknown.length === 0 };
  }
  const api = { resolve, quote, UNKNOWN };
  if (typeof module !== "undefined") module.exports = api; else root.GD_ATLAS_PRICING = api;
})(typeof window !== "undefined" ? window : globalThis);
