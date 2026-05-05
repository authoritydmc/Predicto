@echo off
echo ================================================================================
echo  PREDICTOR MANAGER - AUTOMATION ORCHESTRATOR
echo ================================================================================
echo.

:: Change to backend dir so relative paths work
cd /d "%~dp0..\.."

echo [*] Starting Python orchestrator with unbuffered output...
python -u automation\orchestrator\main.py %*

echo.
echo [!] Orchestrator exited. Press any key to close.
pause >nul
