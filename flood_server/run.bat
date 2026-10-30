@echo off
REM ===== Flood server run =====
REM Start Spring (port 5555) first, then double-click this file.
REM Keep this window open. Close it or press Ctrl+C to stop the server.
cd /d "%~dp0"
set PYTHONUTF8=1

if not exist "venv\Scripts\python.exe" goto :nosetup

if "%PORT%"=="" set PORT=8001

echo Flood server starting on port %PORT%  (docs: http://localhost:%PORT%/docs)
"venv\Scripts\python.exe" -m uvicorn fast_api:app --host 0.0.0.0 --port %PORT%
echo.
echo Server stopped. If you saw "Address already in use", another flood server window is still open.
pause
exit /b 0

:nosetup
echo [ERROR] venv was not found. Double-click setup.bat first.
pause
exit /b 1
