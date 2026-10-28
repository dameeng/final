@echo off
REM ===== PdM server setup: creates venv (Python 3.13) and installs packages in one go =====
REM Double-click this file. First run takes a few minutes.
REM numpy 2.5.3 needs Python 3.12 or newer.
cd /d "%~dp0"
set PYTHONUTF8=1

if exist "venv\Scripts\python.exe" goto :havevenv

where uv >nul 2>&1
if not errorlevel 1 goto :withuv
py -3.13 -V >nul 2>&1
if errorlevel 1 goto :nopy
echo [1/2] Creating virtual environment (venv) with Python 3.13 ...
py -3.13 -m venv venv
if errorlevel 1 goto :fail
goto :install

:withuv
echo [1/2] Creating virtual environment (venv) with Python 3.13 (uv) ...
uv venv venv --python 3.13
if errorlevel 1 goto :fail
echo [2/2] Installing packages (requirements.txt) ...
uv pip install --python venv\Scripts\python.exe -r requirements.txt
if errorlevel 1 goto :fail
goto :done

:havevenv
echo [1/2] venv already exists - skipping.

:install
echo [2/2] Installing packages (requirements.txt) ...
"venv\Scripts\python.exe" -m ensurepip >nul 2>&1
"venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 goto :fail

:done
echo.
echo Setup finished. Double-click run.bat
pause
exit /b 0

:nopy
echo [ERROR] Python 3.13 was not found. Install Python 3.13 (or uv), then run this again.
echo         Check with:  py -0p
pause
exit /b 1

:fail
echo [ERROR] Setup failed. Read the message above, fix it, and run setup.bat again.
pause
exit /b 1
