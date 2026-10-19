@echo off
REM ===== Maintenance server run =====
REM Double-click this file. (Spring is not needed.)
REM Keep this window open. Close it or press Ctrl+C to stop the server.
cd /d "%~dp0server"
set PYTHONUTF8=1

if not exist "venv\Scripts\python.exe" goto :nosetup

if "%PORT%"=="" set PORT=8003

echo Maintenance server starting on port %PORT%  (docs: http://localhost:%PORT%/docs)
"venv\Scripts\python.exe" -m uvicorn fast_api:app --host 0.0.0.0 --port %PORT%
echo.
echo Server stopped. If you saw "Address already in use", another maintenance server window is still open.
pause
exit /b 0

:nosetup
echo [ERROR] venv was not found. Double-click setup.bat first.
pause
exit /b 1
