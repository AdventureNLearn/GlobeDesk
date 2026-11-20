@echo off
REM GlobeDesk launcher for Windows. No install needed. Serves this folder on http://127.0.0.1:8080/
REM Usage: double-click, or run "START-GLOBEDESK.bat 8090" to use another port.
setlocal
cd /d "%~dp0"
set "PORT=%~1"
if "%PORT%"=="" set "PORT=8080"

REM 1) Python launcher (py), 2) python on PATH (skips the Microsoft Store stub), 3) built-in PowerShell server.
where py >nul 2>nul && (
  py -3 --version >nul 2>nul && (
    echo Starting GlobeDesk with Python on port %PORT% ...
    py -3 "tools\serve.py" %PORT%
    goto :end
  )
)
python --version >nul 2>nul && (
  echo Starting GlobeDesk with Python on port %PORT% ...
  python "tools\serve.py" %PORT%
  goto :end
)
echo Python not found. Using the built-in PowerShell server on port %PORT% ...
powershell -NoProfile -ExecutionPolicy Bypass -File "tools\serve.ps1" -Port %PORT%
if errorlevel 1 (
  echo.
  echo Could not start a local server. See WINDOWS-RUN.md for other options.
  pause
)
:end
endlocal
