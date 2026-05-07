@echo off
setlocal EnableDelayedExpansion
cls

REM Get local IP address
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4 Address" ^| findstr /v "127.0.0.1"') do (
    for /f "tokens=*" %%b in ("%%a") do set LOCAL_IP=%%b
)
set LOCAL_IP=%LOCAL_IP: =%

:menu
cls
echo ==========================================
echo    OverlayChat Management Console
echo ==========================================
echo.
echo Local Network IP: %LOCAL_IP%
echo.
echo ----- Frontend (Audience) -----
echo [1]  Start Frontend (Local Dev)
echo [2]  Build Frontend for Production
echo [3]  Deploy Frontend to Firebase
echo.
echo ----- Backend (FastAPI + Automation) -----
echo [4]  Start Backend Server (Local)
echo [5]  Start Automation Scheduler
echo [6]  Run Automation Script
echo [7]  View Automation Logs
echo [8]  Test Automation
echo [9]  Build Docker Image
echo [A]  Run Docker Container
echo.
echo ----- Host App (Electron - Admin) -----
echo [B]  Start Host App (Dev Mode)
echo [C]  Build Host App (EXE)
echo [D]  Package Host App with Electron
echo.
echo ----- Management -----
echo [E]  Setup Python Virtual Environment
echo [F]  Maintenance (Clean node_modules)
echo [G]  Exit
echo.
set /p opt="Select an option: "

REM Frontend options
if "%opt%"=="1" (
    echo Starting Frontend Dev Server...
    cd frontend
    echo Frontend will be available at:
    echo   - Local: http://localhost:5173
    echo   - Network: http://%LOCAL_IP%:5173
    npm run dev -- --host 0.0.0.0
    pause
    goto :menu
)

if "%opt%"=="2" (
    echo Building Frontend for Production...
    cd frontend
    call npm run build
    echo.
    echo Build complete! Output in frontend/dist/
    pause
    goto :menu
)

if "%opt%"=="3" (
    echo Building and Deploying Frontend to Firebase...
    cd frontend
    call npm run build
    cd ..
    cd backend
    call npm run deploy
    pause
    goto :menu
)

REM Backend options
if "%opt%"=="4" (
    echo Starting Backend Server (FastAPI)...
    cd backend
    if exist venv (
        call venv\Scripts\activate
    )
    python server.py
    pause
    goto :menu
)

if "%opt%"=="5" (
    echo Starting Automation Scheduler...
    cd backend
    if exist venv (
        call venv\Scripts\activate
    )
    start cmd /k "echo Automation Scheduler && python -m automation.main scheduler start"
    goto :menu
)

if "%opt%"=="6" goto AUTOMATION_MENU

if "%opt%"=="7" (
    echo Viewing Automation Logs...
    cd backend
    if exist "logs\automation.log" (
        type "logs\automation.log" | more
    ) else (
        echo No logs found. Run automation scripts first.
    )
    pause
    goto :menu
)

if "%opt%"=="8" (
    echo Running Automation Tests...
    cd backend
    if exist venv (
        call venv\Scripts\activate
    )
    python test_with_mocks.py
    pause
    goto :menu
)

if "%opt%"=="9" (
    echo Building Docker Image...
    cd backend
    docker build -t overlaychat-backend .
    echo.
    echo Docker image built: overlaychat-backend
    pause
    goto :menu
)

if "%opt%"=="A" (
    echo Running Docker Container...
    cd backend
    docker run -d --name overlaychat-backend -p 4173:4173 overlaychat-backend
    echo.
    echo Container started! API available at http://localhost:4173
    echo To view logs: docker logs -f overlaychat-backend
    pause
    goto :menu
)

REM Host App (Electron) options
if "%opt%"=="B" (
    echo Starting Host App in Dev Mode...
    cd host-app
    if not exist node_modules (
        echo Installing dependencies...
        call npm install
    )
    echo Host App will start with DevTools...
    call npm start
    pause
    goto :menu
)

if "%opt%"=="C" (
    echo Building Host App EXE...
    cd host-app
    if not exist node_modules (
        echo Installing dependencies...
        call npm install
    )
    echo Building with electron-builder...
    call npm run build-win
    echo.
    echo Build complete! Check host-app/dist/ folder
    pause
    goto :menu
)

if "%opt%"=="D" (
    echo Packaging Host App with Electron...
    cd host-app
    if not exist node_modules (
        echo Installing dependencies...
        call npm install
    )
    echo Packaging for Windows...
    call npm run dist-win
    echo.
    echo Package complete! Check host-app/dist/ folder
    pause
    goto :menu
)

REM Management options
if "%opt%"=="E" (
    echo Setting up Python Virtual Environment...
    cd backend
    echo.
    if exist venv (
        echo Virtual environment already exists at venv\
        set /p recreate="Do you want to recreate it? (y/n): "
        if /i not "!recreate!"=="y" (
            echo Setup cancelled.
            pause
            goto :menu
        )
        rmdir /s /q venv
    )
    echo Creating virtual environment...
    python -m venv venv
    if errorlevel 1 (
        echo ERROR: Failed to create virtual environment.
        echo Make sure Python 3.10+ is installed and in PATH.
        pause
        goto :menu
    )
    echo Virtual environment created successfully.
    echo.
    echo Installing Python dependencies...
    call venv\Scripts\activate
    pip install -r requirements.txt
    if errorlevel 1 (
        echo ERROR: Failed to install dependencies.
        pause
        goto :menu
    )
    echo.
    echo Python setup completed successfully!
    echo.
    echo IMPORTANT: To use Python scripts, activate the virtual environment first:
    echo   venv\Scripts\activate
    echo.
    pause
    goto :menu
)

if "%opt%"=="F" (
    echo Attempting to clean root artifacts...
    taskkill /F /IM electron.exe /T 2>nul
    rmdir /s /q backend\node_modules 2>nul
    rmdir /s /q frontend\node_modules 2>nul
    rmdir /s /q host-app\node_modules 2>nul
    echo Cleanup attempt finished.
    pause
    goto :menu
)

if "%opt%"=="G" exit
goto :menu

:AUTOMATION_MENU
cls
echo ==========================================
echo    Automation Scripts
echo ==========================================
echo.
echo [1] Get Live Matches
echo [2] Run Scraper
echo [3] Process Match Status
echo [4] Auto-Schedule Matches
echo [5] Calculate Scores
echo [6] Update Leaderboard
echo [7] Run Reconciliation
echo [8] Back to Main Menu
echo.
set /p script_opt="Select script to run: "

if "%script_opt%"=="1" (
    cd backend
    if exist venv call venv\Scripts\activate
    python -m automation.main live-matches --sport cricket
    pause
    goto :AUTOMATION_MENU
)

if "%script_opt%"=="2" (
    cd backend
    if exist venv call venv\Scripts\activate
    python -m automation.main run-scraper
    pause
    goto :AUTOMATION_MENU
)

if "%script_opt%"=="3" (
    cd backend
    if exist venv call venv\Scripts\activate
    python -m automation.main match-status --sport cricket
    pause
    goto :AUTOMATION_MENU
)

if "%script_opt%"=="4" (
    cd backend
    if exist venv call venv\Scripts\activate
    python -m automation.main auto-schedule --sport cricket --days 3
    pause
    goto :AUTOMATION_MENU
)

if "%script_opt%"=="5" (
    echo Enter match details:
    set /p tournament_id="Tournament ID: "
    set /p match_id="Match ID: "
    cd backend
    if exist venv call venv\Scripts\activate
    python -m automation.main calculate-scores --sport cricket --tournament-id !tournament_id! --match-id !match_id!
    pause
    goto :AUTOMATION_MENU
)

if "%script_opt%"=="6" (
    echo Enter tournament details:
    set /p tournament_id="Tournament ID: "
    cd backend
    if exist venv call venv\Scripts\activate
    python -m automation.main update-leaderboard --sport cricket --tournament-id !tournament_id!
    pause
    goto :AUTOMATION_MENU
)

if "%script_opt%"=="7" (
    cd backend
    if exist venv call venv\Scripts\activate
    python -m automation.main run --script reconciliation
    pause
    goto :AUTOMATION_MENU
)

if "%script_opt%"=="8" goto :menu
goto :AUTOMATION_MENU
