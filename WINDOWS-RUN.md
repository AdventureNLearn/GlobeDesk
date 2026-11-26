# Run GlobeDesk on Windows (no install)

Target folder: `C:\GlobeDesk`

1. Extract `globedesk-v1.5.1.zip` into `C:\` (the zip contains a `GlobeDesk` folder), so that `C:\GlobeDesk\index.html` exists. You can also extract into any other folder you choose; the app folder should contain `index.html`.
2. Double-click **`START-GLOBEDESK.bat`**. It picks the first server it finds:
   - **Python** (`py -3` or `python`) runs `tools\serve.py`.
   - If there's no Python, it uses **Windows PowerShell's built-in server** (`tools\serve.ps1`). Nothing gets installed.
3. Your browser opens at <http://127.0.0.1:8080/>. Use Chrome or Edge for recording; WebM capture is built in.
4. To stop the server, close the black console window, or press Ctrl+C in it.

## If something goes wrong

- **Port in use:** run `START-GLOBEDESK.bat 8090` from a Command Prompt in the folder.
- **SmartScreen or "Windows protected your PC":** choose *More info → Run anyway*. The .bat is plain text, so you can open it in Notepad to check it first.
- **PowerShell blocked by policy:** the launcher already passes `-ExecutionPolicy Bypass` for this one script. If your organisation forbids that, install Python from python.org and run the .bat again.
- **The Microsoft Store opens when Python is called:** that's Windows' Python stub. The launcher detects it and falls back to PowerShell.
- **Manual start:** open a terminal in `C:\GlobeDesk` and run `py -3 tools\serve.py`, or `python -m http.server 8080 --bind 127.0.0.1`, then open <http://127.0.0.1:8080/>.
- **Blank globe or no satellite:** the free street and 10 m satellite tiles need internet. Choose *Layers → Offline globe* for coastlines, countries and towns with no network. If you have built the local Blue Marble pack (see below), turn on *NASA Blue Marble* as well to show globe-level imagery offline.

Don't double-click `index.html` directly (a `file://` URL). The browser blocks parts of the app that way.

## What stays local

All files are served only to this PC (`127.0.0.1`). Media you drop in, saved episodes, and exports (JSON, GeoJSON, CSV, KML, SRT/VTT, WebM) go to your Downloads folder. Optional paid keys, if you ever add one, stay in that browser's storage only.

## Local Blue Marble pack (optional)

Globe-level NASA Blue Marble imagery (August 2004, shaded relief and bathymetry; public domain) can be stored as a single MBTiles file at:

`globedesk-data\bluemarble\BlueMarble_ShadedRelief_Bathymetry-z0-8.mbtiles`

That folder sits under the app folder and is gitignored. Override the parent folder with the `GLOBEDESK_DATA` environment variable. A complete z0–8 pack is 475,246,592 bytes. With the **Python** server running (`tools/serve.py`, used by `START-GLOBEDESK.bat` when Python is available), the desk asks `http://127.0.0.1:<port>/tiles/bluemarble/{z}/{x}/{y}.jpeg`, which looks in the local pack, then a disk cache (default cap 32 GiB; set `GLOBEDESK_CACHE_MAX_BYTES` — `0` means off, `unlimited` or 1 TiB or larger means no cap), then NASA GIBS. Only the app itself (same Origin or Referer on this port) can stream and fill the cache. If you start the desk with the PowerShell fallback, `python -m http.server`, or `npm start`, `/tiles` is missing and the overlay uses NASA GIBS directly.

## Washington, DC demo-region pack (optional)

A small downtown / National Mall box of EOX Sentinel-2 cloudless 2016 imagery (CC BY 4.0; contains modified Copernicus Sentinel data 2016), used with the GlobeDesk Washington, DC (approx.) stories:

`globedesk-data\regions\washington-dc\eox2016-s2cloudless-2016.mbtiles`

A complete pack is 131 tiles, 1,904,640 bytes (z0–14). Build or resume it with:

```
py -3 tools\fetch_region_pack.py --out .\globedesk-data\regions\washington-dc
```

The **Washington, DC demo region** overlay in Layers is served only by the Python server (pack → cache → EOX). Coverage outside that bbox is empty.

A two-story sample episode for this pack is `episodes\washington-dc-demo.globedesk.json`. Open `http://127.0.0.1:8080/index.html?import=/episodes/washington-dc-demo.globedesk.json`. Pins are approximate; facts are cited or marked [UNKNOWN].

The localhost command API (`POST /api/command`, `GET /api/tools`) is also only on the Python server. The PowerShell fallback does not provide it.

To build or resume the pack (rate-limited; safe to re-run):

```
py -3 tools\fetch_bluemarble_pack.py --out .\globedesk-data\bluemarble
```
