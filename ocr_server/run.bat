@echo off
rem Double-click to start the AI server (http://localhost:8000/docs)
cd /d "%~dp0"

if not exist "%~dp0venv\Scripts\python.exe" (
    echo [!] venv not found. Run setup.bat first.
    pause
    exit /b 1
)

rem Spring address. Default: Spring on this PC.
rem If Spring runs on another PC, create spring_url.txt in this folder with one line,
rem e.g.  http://192.168.0.80:5555
set "SPRING_URL=http://localhost:5555"
if exist "%~dp0spring_url.txt" set /p SPRING_URL=<"%~dp0spring_url.txt"

rem No NVIDIA GPU -> CPU settings (detect every 0.5s, 4 threads, stream delay 2.5s)
rem 0.3s used ~60% CPU and the browser stuttered -> leave CPU for the browser
where nvidia-smi >nul 2>nul
if errorlevel 1 (
    set "USE_GPU=0"
    set "PLATE_INTERVAL_SEC=0.5"
    set "INFER_THREADS=4"
    set "STREAM_DELAY_SEC=2.5"
    echo [AI] No GPU - running with CPU settings
) else (
    echo [AI] GPU mode
)
echo [AI] Spring: %SPRING_URL%

"%~dp0venv\Scripts\python.exe" -m uvicorn fast_api:app --host 0.0.0.0 --port 8000
echo.
pause
