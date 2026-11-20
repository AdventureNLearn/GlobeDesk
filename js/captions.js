/* Captions: SRT/VTT parse + export, auto-cues from a script. window.GD.captions */
(function () {
  "use strict";
  const GD = (window.GD = window.GD || {});

  function toSec(ts) {
    const m = String(ts).trim().replace(",", ".").match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/);
    if (!m) return NaN;
    return (Number(m[1] || 0) * 3600) + Number(m[2]) * 60 + Number(m[3]);
  }

  function fmt(sec, sep) {
    const ms = Math.max(0, Math.round(sec * 1000));
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const r = ms % 1000;
    const p = (n, w) => String(n).padStart(w, "0");
    return `${p(h, 2)}:${p(m, 2)}:${p(s, 2)}${sep}${p(r, 3)}`;
  }

  // Parses SRT or WebVTT text into [{start, end, text}].
  function parse(text) {
    const out = [];
    const blocks = String(text).replace(/\r/g, "").replace(/^\uFEFF/, "").split(/\n{2,}/);
    for (const b of blocks) {
      const lines = b.split("\n").filter((l) => l.trim() !== "");
      const i = lines.findIndex((l) => l.includes("-->"));
      if (i < 0) continue;
      const [a, z] = lines[i].split("-->");
      const start = toSec(a);
      const end = toSec(String(z).trim().split(/\s+/)[0]);
      const body = lines.slice(i + 1).join("\n").replace(/<[^>]+>/g, "").trim();
      if (!isNaN(start) && !isNaN(end) && body) out.push({ start, end, text: body });
    }
    return out;
  }

  // Spreads script sentences over the duration by word count. Caps a cue at ~12 words.
  function fromScript(script, durationSec) {
    const words = String(script || "").trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const chunks = [];
    let cur = [];
    for (const w of words) {
      cur.push(w);
      if (cur.length >= 12 || /[.!?]$/.test(w)) { chunks.push(cur.join(" ")); cur = []; }
    }
    if (cur.length) chunks.push(cur.join(" "));
    const dur = Math.max(1, Number(durationSec) || words.length / 2.6);
    const per = dur / words.length;
    let t = 0;
    return chunks.map((c) => {
      const n = c.split(" ").length;
      const cue = { start: round(t), end: round(Math.min(dur, t + n * per)), text: c };
      t += n * per;
      return cue;
    });
  }

  function round(v) { return Math.round(v * 100) / 100; }

  function toVTT(cues) {
    return "WEBVTT\n\n" + cues.map((c) => `${fmt(c.start, ".")} --> ${fmt(c.end, ".")}\n${c.text}`).join("\n\n") + "\n";
  }
  function toSRT(cues) {
    return cues.map((c, i) => `${i + 1}\n${fmt(c.start, ",")} --> ${fmt(c.end, ",")}\n${c.text}`).join("\n\n") + "\n";
  }

  // Episode-wide cues (story captions shifted by each story's start).
  function episodeCues(ep) {
    const starts = GD.model.storyStarts(ep);
    const all = [];
    ep.stories.forEach((s, i) => (s.captions || []).forEach((c) => all.push({ start: c.start + starts[i], end: c.end + starts[i], text: c.text })));
    return all;
  }

  GD.captions = { parse, fromScript, toVTT, toSRT, episodeCues, fmt };
})();
