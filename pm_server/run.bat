@echo off
REM ===== PdM server run (CCTV + pump + water level + VMS) =====
REM Pulls equipment and sensors from Spring, computes scores, pushes them back (see README, "Spring link").
REM Put the Spring internal key in secret.bat (not in git):   set INTERNAL_API_KEY=your-key
REM Keep this window open. Close it or press Ctrl+C to stop the server.
cd /d "%~dp0"
set PYTHONUTF8=1

if not exist "venv\Scripts\python.exe" goto :nosetup
if not exist "models\cctv_model.joblib" goto :nomodel

if "%PORT%"=="" set PORT=8002
if exist "secret.bat" call "secret.bat"
if "%INTERNAL_API_KEY%"=="" echo [WARN] INTERNAL_API_KEY is empty: Spring link is OFF (only /predict APIs work). Create secret.bat.

echo PdM server starting on port %PORT%  (docs: http://localhost:%PORT%/docs)
"venv\Scripts\python.exe" -m uvicorn main:app --host 0.0.0.0 --port %PORT%
echo.
echo Server stopped. If you saw "Address already in use", another server is using port %PORT%.
pause
exit /b 0

:nomodel
echo [ERROR] No model files (models\*_model.joblib). Run:  venv\Scripts\python.exe train.py
pause
exit /b 1

:nosetup
echo [ERROR] venv was not found. Double-click setup.bat first.
pause
exit /b 1
