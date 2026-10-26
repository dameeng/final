@echo off
rem ROUTEL AI server - first-time setup (double-click once, takes 5-15 min)
cd /d "%~dp0"
set "PY=%~dp0venv\Scripts\python.exe"

echo ============================================================
echo  [1/4] Python 3.11
echo ============================================================
py -3.11 --version >nul 2>nul
if errorlevel 1 (
    echo Python 3.11 not found. Trying to install with winget...
    winget install --id Python.Python.3.11 -e --scope user --silent --accept-package-agreements --accept-source-agreements
    py -3.11 --version >nul 2>nul
    if errorlevel 1 (
        echo.
        echo [FAIL] Could not install Python 3.11.
        echo        Install it from https://www.python.org/downloads/release/python-3119/
        echo        and check "Add python.exe to PATH". Then run setup.bat again.
        goto fail
    )
)
py -3.11 --version

echo.
echo ============================================================
echo  [2/4] Virtual environment (venv)
echo ============================================================
if exist "%PY%" (
    echo venv already exists - skip
) else (
    py -3.11 -m venv venv
    if errorlevel 1 goto fail
)

echo.
echo ============================================================
echo  [3/4] Packages (requirements.txt)
echo ============================================================
"%PY%" -m pip install --upgrade pip
"%PY%" -m pip install -r requirements.txt
if errorlevel 1 goto fail
rem ultralytics also installs opencv-python -> keep only opencv-contrib-python
"%PY%" -m pip uninstall -y opencv-python opencv-python-headless
"%PY%" -m pip install --force-reinstall --no-deps opencv-contrib-python==5.0.0.93
if errorlevel 1 goto fail

echo.
echo ============================================================
echo  [4/4] GPU packages (only if an NVIDIA GPU is found)
echo ============================================================
where nvidia-smi >nul 2>nul
if errorlevel 1 (
    echo No NVIDIA GPU - CPU version is kept.
    set "USE_GPU=0"
    rem CPU: convert YOLO to OpenVINO (about 3x faster on CPU, same results)
    if not exist "%~dp0yolo8!\yolo_plate_far\best_openvino_model\best.xml" (
        "%PY%" -c "from ultralytics import YOLO; YOLO(r'yolo8!\yolo_plate_far\best.pt').export(format='openvino', imgsz=1280, dynamic=True)"
        if errorlevel 1 goto fail
    )
) else (
    nvidia-smi --query-gpu=name --format=csv,noheader
    "%PY%" -m pip install --force-reinstall --no-deps torch==2.7.1 torchvision==0.22.1 --index-url https://download.pytorch.org/whl/cu126
    if errorlevel 1 goto fail
    "%PY%" -m pip uninstall -y paddlepaddle
    "%PY%" -m pip install paddlepaddle-gpu==3.3.1 --extra-index-url https://www.paddlepaddle.org.cn/packages/stable/cu126/
    if errorlevel 1 goto fail
    rem torch uses cuDNN 9.7, paddle brings 9.5 -> match them (otherwise WinError 127)
    "%PY%" -m pip install --no-deps nvidia-cudnn-cu12==9.7.1.26
    if errorlevel 1 goto fail
)

echo.
echo ============================================================
echo  DONE. Put the camera video (see CAMERAS in config.py)
echo  in the video folder, start Spring, then double-click run.bat
echo ============================================================
pause
exit /b 0

:fail
echo.
echo [FAIL] Setup stopped. Read the error above.
echo        Fix it and run setup.bat again - finished steps are skipped.
pause
exit /b 1
