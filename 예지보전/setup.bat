@echo off
REM ===== Maintenance server setup: creates venv and installs packages in one go =====
REM Double-click this file. First run takes a few minutes.
cd /d "%~dp0server"
set PYTHONUTF8=1

where py >nul 2>&1
if errorlevel 1 goto :nopy
py -3.11 -V >nul 2>&1
if errorlevel 1 goto :nopy

if exist "venv\Scripts\python.exe" goto :havevenv
echo [1/3] Creating virtual environment (venv) with Python 3.11 ...
py -3.11 -m venv venv
if errorlevel 1 goto :fail
goto :install

:havevenv
echo [1/3] venv already exists - skipping.

:install
echo [2/3] Installing packages (requirements.txt) ...
"venv\Scripts\python.exe" -m pip install --upgrade pip
if errorlevel 1 goto :fail
"venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 goto :fail

echo [3/3] Checking environment ...
"venv\Scripts\python.exe" -u check_env.py
echo.
echo Setup finished. If the pump model check failed, run "python data_prep.py" and "python train.py" in the pump model folder first. Then double-click run.bat
pause
exit /b 0

:nopy
echo [ERROR] Python 3.11 was not found. Install Python 3.11 first, then run this again.
echo         Check with:  py -0p
pause
exit /b 1

:fail
echo [ERROR] Setup failed. Read the message above, fix it, and run setup.bat again.
echo         Steps that already finished are skipped on the next run.
pause
exit /b 1
