#!/usr/bin/env python3
"""QA a finalized mission video: STT word-match per line, overlap, loudness, frames."""
from __future__ import annotations
import difflib, json, os, re, subprocess, sys, tempfile, wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TMP = Path(os.environ.get("GLOBEDESK_TMP") or tempfile.gettempdir())
OUT_DIR = TMP / "final-qa"
# Speech-to-text QA needs a local Vosk model and a venv with vosk installed.
STT = Path(os.environ.get("GLOBEDESK_STT_DIR") or (TMP / "stt"))
MODEL = STT / "vosk-model-small-en-us-0.15"
VENV_PY = STT / "venv" / "bin" / "python"
MANIFEST = ROOT / "guide-packs" / "frogpost" / "manifest.json"

LEVEL_ORDER = [
    "spin", "dive", "open", "edit", "pins", "media",
    "embed", "sound", "captions", "assist", "grokme",
]

def normalize(s: str) -> list[str]:
    s = s.lower().replace("g.m.", "gm").replace("—", " ").replace("–", " ")
    s = re.sub(r"[^a-z0-9']+", " ", s)
    s = s.replace("n t ", "nt ")  # don't -> don t handled by keeping apostrophes
    return [w for w in s.split() if w]

def spoken(node) -> str:
    if isinstance(node, dict):
        return (node.get("spoken") or node.get("text") or "").strip()
    return str(node).strip()

def script_lines(manifest: dict) -> list[tuple[str, str]]:
    lines = manifest["lines"]
    levels = manifest["levels"]
    out = [("start", spoken(lines["start"])), ("coldopen", spoken(lines["coldopen"]))]
    for lid in LEVEL_ORDER:
        lv = levels[lid]
        for kind in ("brief", "success", "why"):
            out.append((f"{lid}-{kind}", spoken(lv[kind])))
    out.append(("finale", spoken(lines["finale"])))
    out.append(("debrief", spoken(lines["debrief"])))
    return out

def run(cmd, **kw):
    return subprocess.run(cmd, check=True, **kw)

def extract_wav(video: Path, wav: Path):
    run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
         "-i", str(video), "-ac", "1", "-ar", "16000", "-vn", str(wav)])

def transcribe_words(wav: Path) -> list[dict]:
    code = r'''
import json, sys, wave
from vosk import Model, KaldiRecognizer
model = Model(sys.argv[1])
wf = wave.open(sys.argv[2], "rb")
rec = KaldiRecognizer(model, wf.getframerate())
rec.SetWords(True)
words = []
while True:
    data = wf.readframes(4000)
    if not data:
        break
    if rec.AcceptWaveform(data):
        res = json.loads(rec.Result())
        words.extend(res.get("result") or [])
res = json.loads(rec.FinalResult())
words.extend(res.get("result") or [])
print(json.dumps(words))
'''
    out = subprocess.check_output([str(VENV_PY), "-c", code, str(MODEL), str(wav)])
    return json.loads(out)

def best_span(words, ref_toks):
    """Find a contiguous word span maximizing token matches (order-aware)."""
    hyp = [w["word"].lower() for w in words]
    n, m = len(hyp), len(ref_toks)
    if m == 0 or n == 0:
        return None
    best = None
    # window from m-2 to m+6 tokens
    for wlen in range(max(1, m - 2), min(n, m + 8) + 1):
        for i in range(0, n - wlen + 1):
            window = hyp[i:i+wlen]
            # greedy left-to-right match count
            ri = 0
            matched = 0
            for tok in window:
                if ri < m and tok == ref_toks[ri]:
                    matched += 1
                    ri += 1
            # also bag-of-words fallback component
            # prefer high matched, then tighter window
            score = (matched, -abs(wlen - m), -i)
            if best is None or score > best[0]:
                best = (score, i, i+wlen, matched)
    if best is None:
        return None
    _, i, j, matched = best
    return {
        "i": i, "j": j, "matched": matched,
        "start": words[i]["start"], "end": words[j-1]["end"],
        "hyp": " ".join(hyp[i:j]),
    }

def word_scores(ref_toks, hyp_toks):
    # bag recall/precision on tokens (multiset)
    from collections import Counter
    rc, hc = Counter(ref_toks), Counter(hyp_toks)
    matched = sum((rc & hc).values())
    rw, hw = sum(rc.values()), sum(hc.values()) or 1
    rec = matched / rw if rw else 0
    prec = matched / hw if hw else 0
    f1 = (2*rec*prec/(rec+prec)) if rec+prec else 0
    return {"ref_words": rw, "hyp_words": hw, "matched": matched,
            "recall": rec, "precision": prec, "f1": f1}

def measure_loudness(video: Path) -> dict:
    log = subprocess.check_output([
        "ffmpeg", "-hide_banner", "-i", str(video),
        "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json",
        "-f", "null", "-",
    ], stderr=subprocess.STDOUT, text=True)
    start, end = log.rfind("{"), log.rfind("}")
    return json.loads(log[start:end+1])

def extract_frames(video: Path, dest: Path, every=5.0):
    dest.mkdir(parents=True, exist_ok=True)
    # also a few mid-second samples
    run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
         "-i", str(video), "-vf", f"fps=1/{every}", "-q:v", "3",
         str(dest / "t%04d.jpg")])
    files = sorted(dest.glob("t*.jpg"))
    return files

def main():
    video = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "GlobeDesk-frog-mission-FINAL.mp4")
    if not video.is_file():
        sys.exit(f"missing {video}")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(MANIFEST.read_text())
    refs = script_lines(manifest)
    wav = OUT_DIR / "final-16k.wav"
    words_path = OUT_DIR / "final-words.json"
    if not wav.is_file():
        print(f"extract {video} -> {wav}")
        extract_wav(video, wav)
    if words_path.is_file() and "--fresh" not in sys.argv:
        words = json.loads(words_path.read_text())
        print(f"reuse {words_path} ({len(words)} words)")
    else:
        print(f"extract {video} -> {wav}" if wav.is_file() else "")
        if not wav.is_file():
            extract_wav(video, wav)
        print("transcribe...")
        words = transcribe_words(wav)
        words_path.write_text(json.dumps(words))
        print(f"words {len(words)}")

    hyp = [w["word"].lower() for w in words]
    # Flatten refs, then greedily match each token to the next hyp word (limited skip).
    flat = []
    for li, (name, ref) in enumerate(refs):
        for tok in normalize(ref):
            flat.append((li, tok))
    assign = {}  # ref-flat index -> hyp index
    hi = 0
    for ri, (li, tok) in enumerate(flat):
        found = None
        # look ahead; don't jump over a whole later line
        for k in range(hi, min(len(hyp), hi + 20)):
            if hyp[k] == tok:
                found = k
                break
        if found is not None:
            assign[ri] = found
            hi = found + 1
    rows = []
    for li, (name, ref) in enumerate(refs):
        idxs = [i for i, (l, _) in enumerate(flat) if l == li]
        toks = [flat[i][1] for i in idxs]
        hits = [assign[i] for i in idxs if i in assign]
        matched = len(hits)
        if hits:
            i0, i1 = min(hits), max(hits)
            hyp_toks = hyp[i0:i1+1]
            span = {"start": words[i0]["start"], "end": words[i1]["end"],
                    "hyp": " ".join(hyp_toks), "i": i0, "j": i1+1}
        else:
            hyp_toks = []
            span = {"start": None, "end": None, "hyp": ""}
        sc = {"ref_words": len(toks), "hyp_words": len(hyp_toks), "matched": matched,
              "recall": matched / len(toks) if toks else 0,
              "precision": matched / len(hyp_toks) if hyp_toks else 0}
        rec, prec = sc["recall"], sc["precision"]
        sc["f1"] = (2*rec*prec/(rec+prec)) if rec+prec else 0
        rows.append({"name": name, "ref": ref, "hyp": span.get("hyp",""),
                     "start": span.get("start"), "end": span.get("end"),
                     "score": sc})
        print(f"  {name:22} {sc['matched']}/{sc['ref_words']}  rec={sc['recall']:.2f}  {span.get('hyp','')[:70]}")

    overlaps = []
    timed = [r for r in rows if r["start"] is not None]
    for a, b in zip(timed, timed[1:]):
        if b["start"] < a["end"] - 0.05:
            overlaps.append({"a": a["name"], "b": b["name"],
                             "overlap_s": a["end"] - b["start"]})
    total_m = sum(r["score"]["matched"] for r in rows)
    total_r = sum(r["score"]["ref_words"] for r in rows)
    summary = {
        "video": str(video),
        "lines": len(rows),
        "matched": total_m,
        "ref_words": total_r,
        "word_match_pct": 100 * total_m / total_r if total_r else 0,
        "overlaps": overlaps,
        "rows": rows,
    }
    (OUT_DIR / "stt-final.json").write_text(json.dumps(summary, indent=2))
    print(f"OVERALL {total_m}/{total_r} {summary['word_match_pct']:.1f}%  overlaps {len(overlaps)}")

    loud = measure_loudness(video)
    (OUT_DIR / "loudness.json").write_text(json.dumps(loud, indent=2))
    print("loudness", json.dumps(loud))

    frames = extract_frames(video, OUT_DIR / "frames", 5)
    print(f"frames {len(frames)} -> {OUT_DIR/'frames'}")
    print("QA_OK")

if __name__ == "__main__":
    main()
