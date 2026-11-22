# Promote a layer to the public tree

This is a **local-only** helper. It copies one item from your untracked personal catalog (`GLOBEDESK_DATA`) into a candidate file under `episodes/layers/` in the repo. It does not commit, it does not push, and it does not run on a batch of items.

Use it when you want one cleaned, clearly labelled record to be *considered* for the public GitHub / grok.me tree. Shipping that file still takes a separate, explicit commit after you say YES to that item.

## What it does

1. Reads one catalog file (optionally one catalog or story id inside it).
2. Strips personal field names (`owner`, `address`, `phone`, `email`, `valuation`, `street`, `occupant`, and camelCase variants) and desk links (`openIn`).
3. Requires a source and a license on every record. Missing values are filled with `[UNKNOWN]`, and the run is blocked until you add real values.
4. Requires a `PUBLIC`, `RECORDED`, or `PROJECTED` label (`--label`, or `publicStatus` already on the item).
5. Runs `tools/scrub_scan.py` on a zip of the candidate and `tools/name_scan.py` on the file. Any hit refuses the write.
6. Writes the candidate only if you pass `--yes` after confirming that specific item. Existing files are not overwritten. Git is never invoked.

## Command

```
python3 tools/promote_layer.py --item records/records.json --id records-sample-canal-voyage --label PUBLIC
```

That is a dry run: it reports problems, or says owner YES is required, and writes nothing.

After you confirm that one item:

```
python3 tools/promote_layer.py --item records/records.json --id records-sample-canal-voyage --label PUBLIC --yes
```

`--item` is a path under `GLOBEDESK_DATA`, or an absolute path. `--dest` can point at a different output file. `--patterns` points at a JSON list of names for the name scan (otherwise `GLOBEDESK_DATA/settings/name-scan-patterns.json` is used if present). If no pattern list is available, the run is refused and nothing is written. Name patterns are never stored in the public repo.

## What it will not do

- Promote your whole catalog.
- Commit, add, or push.
- Overwrite an existing public file.
- Ship a record with a missing source or license, even if marked `[UNKNOWN]`.
- Ship a file that fails the scrub scan or the name scan.

The public tree should keep only generic SAMPLE content plus items you have deliberately promoted this way.
