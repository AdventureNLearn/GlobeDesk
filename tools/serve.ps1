# GlobeDesk fallback server for Windows when Python is not installed. Uses only built-in Windows PowerShell 5.1.
# Serves this folder on http://127.0.0.1:<port>/ (local only). Stop with Ctrl+C or close the window.
param([int]$Port = 8080)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$mime = @{ ".html"="text/html; charset=utf-8"; ".js"="text/javascript; charset=utf-8"; ".mjs"="text/javascript"; ".css"="text/css";
  ".json"="application/json"; ".geojson"="application/geo+json"; ".svg"="image/svg+xml"; ".png"="image/png"; ".jpg"="image/jpeg";
  ".csv"="text/csv"; ".kml"="application/vnd.google-earth.kml+xml"; ".md"="text/plain; charset=utf-8"; ".txt"="text/plain; charset=utf-8" }
$listener = New-Object System.Net.HttpListener
$prefix = "http://127.0.0.1:$Port/"
$listener.Prefixes.Add($prefix)
try { $listener.Start() } catch { Write-Host "Could not start on port $Port. Try: START-GLOBEDESK.bat 8090"; exit 1 }
Write-Host "GlobeDesk running at $prefix  (Ctrl+C or close this window to stop)"
Start-Process $prefix
$rootFull = [System.IO.Path]::GetFullPath($root)
try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $rel = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart("/"))
    if ($rel -eq "") { $rel = "index.html" }
    $path = [System.IO.Path]::GetFullPath((Join-Path $rootFull $rel))
    $res = $ctx.Response
    if (-not $path.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $path -PathType Leaf)) {
      $res.StatusCode = 404; $bytes = [System.Text.Encoding]::UTF8.GetBytes("Not found")
    } else {
      $ext = [System.IO.Path]::GetExtension($path).ToLower()
      $res.ContentType = $(if ($mime.ContainsKey($ext)) { $mime[$ext] } else { "application/octet-stream" })
      $bytes = [System.IO.File]::ReadAllBytes($path)
    }
    $res.Headers.Add("Cache-Control", "no-cache")
    # videos.html has its own meta CSP (hosted film, inline script/style).
    # Match that path exactly (AbsolutePath has no query); do not prefix-match
    # /videos.htmlx or /videos.html.bak.
    $urlPath = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
    if ($urlPath -ine "/videos.html") {
      $res.Headers.Add("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob: https://tiles.maps.eox.at https://tiles.openfreemap.org https://s3.amazonaws.com/elevation-tiles-prod/ https://gibs.earthdata.nasa.gov https://api.maptiler.com https://basemap.nationalmap.gov https://hydro.nationalmap.gov https://tigerweb.geo.census.gov https://nowcoast.noaa.gov https://mrdata.usgs.gov; connect-src 'self' https://tiles.maps.eox.at https://tiles.openfreemap.org https://s3.amazonaws.com/elevation-tiles-prod/ https://gibs.earthdata.nasa.gov https://api.maptiler.com https://basemap.nationalmap.gov https://hydro.nationalmap.gov https://tigerweb.geo.census.gov https://nowcoast.noaa.gov https://mrdata.usgs.gov https://photon.komoot.io; font-src 'self' data: https://tiles.openfreemap.org; media-src 'self' blob: data:; frame-src https://www.youtube-nocookie.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'")
    }
    $res.ContentLength64 = $bytes.Length
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
    $res.OutputStream.Close()
  }
} finally { $listener.Stop() }
