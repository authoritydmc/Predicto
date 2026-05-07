@echo off
REM Predicto Dev Launcher - Windows Entry Point
REM This script launches the Python-based launcher

echo.
echo ========================================
echo   Predicto Dev Launcher
echo ========================================
echo.

REM Check if Python is available
python --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.7+ and try again
    pause
    exit /b 1
)

REM Get the directory where this batch file is located
set SCRIPT_DIR=%~dp0

REM Change to the script directory
cd /d "%SCRIPT_DIR%"

REM Run the Python launcher with all arguments passed through
python launcher.py %*

REM Check exit code
if %ERRORLEVEL% neq 0 (
    echo.
    echo Launcher exited with error code %ERRORLEVEL%
    pause
)
