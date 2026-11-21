# Run GlobeDesk on Windows (no install)

Target folder: `C:\GlobeDesk`

1. Extract `globedesk-v0.5.1.zip` into `C:\` (the zip contains a `GlobeDesk` folder), so that `C:\GlobeDesk\index.html` exists. You can also extract into any other folder you choose; the app folder should contain `index.html`.
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
- **Blank globe or no satellite:** the free imagery and street tiles need internet. Choose *Layers → Offline globe* to work fully offline (coastlines, countries, towns).

Don't double-click `index.html` directly (a `file://` URL). The browser blocks parts of the app that way.

## What stays local

All files are served only to this PC (`127.0.0.1`). Media you drop in, saved episodes, and exports (JSON, GeoJSON, CSV, KML, SRT/VTT, WebM) go to your Downloads folder. Optional paid keys, if you ever add one, stay in that browser's storage only.
