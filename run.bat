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
echo.
echo  ==========================================
echo    Predicto Dev Console
echo  ==========================================
echo.
echo  Local IP: %LOCAL_IP%
echo.
echo  [A] Start ALL (Backend + Host App + Frontend)
echo.
echo  ----- Frontend (Audience) -----
echo  [1] Start Frontend (Dev Mode)
echo  [2] Build Frontend
echo  [3] Deploy to Firebase
echo.
echo  ----- Backend (FastAPI + Automation) -----
echo  [4] Start Backend Server
echo  [5] Start Automation Scheduler
echo  [6] Run Automation Script
echo  [7] View Logs
echo  [8] Test Automation
echo.
echo  ----- Host App (Electron - Admin) -----
echo  [9] Start Host App (Dev)
echo  [0] Build Host App (EXE)
echo.
echo  ----- Management -----
echo  [E] Setup Python Venv
echo  [F] Clean node_modules
echo  [G] Exit
echo.
set /p opt="Select option: "

REM Start ALL
if /i "%opt%"=="A" (
    cls
    echo Starting ALL services...
    echo.
    
    REM Start Backend
    start "Backend" cmd /k "cd backend && if exist venv (call venv\Scripts\activate) && python server.py"
    timeout /t 3 >nul
    
    REM Start Host App
    start "Host App" cmd /k "cd host-app && if not exist node_modules npm install && npm start"
    timeout /t 3 >nul
    
    REM Start Frontend
    start "Frontend" cmd /k "cd frontend && echo Frontend: http://localhost:5173 && npm run dev -- --host 0.0.0.0"
    
    echo.
    echo All services started in separate windows!
    echo  - Backend: http://localhost:4173
    echo  - Frontend: http://localhost:5173
    echo  - Host App: Electron window
    pause
    goto :menu
)

REM Frontend
if "%opt%"=="1" (
    cls
    echo Starting Frontend Dev Server...
    cd frontend
    echo Available at:
    echo  - Local: http://localhost:5173
    echo  - Network: http://%LOCAL_IP%:5173
    npm run dev -- --host 0.0.0.0
    pause
    goto :menu
)

if "%opt%"=="2" (
    cls
    echo Building Frontend...
    cd frontend
    call npm run build
    echo.
    echo Build complete! Output: frontend/dist/
    pause
    goto :menu
)

if "%opt%"=="3" (
    cls
    echo Building and Deploying to Firebase...
    cd frontend
    call npm run build
    cd ..\backend
    call npm run deploy
    pause
    goto :menu
)

REM Backend
if "%opt%"=="4" (
    cls
    echo Starting Backend Server...
    cd backend
    if exist venv (call venv\Scripts\activate)
    python server.py
    pause
    goto :menu
)

if "%opt%"=="5" (
    cls
    echo Starting Automation Scheduler...
    start "Automation" cmd /k "cd backend && if exist venv (call venv\Scripts\activate) && python -m automation.main scheduler start"
    goto :menu
)

if "%opt%"=="6" goto AUTOMATION_MENU

if "%opt%"=="7" (
    cls
    echo === Automation Logs ===
    cd backend
    if exist "logs\automation.log" (
        type "logs\automation.log" | more
    ) else (
        echo No logs found.
    )
    pause
    goto :menu
)

if "%opt%"=="8" (
    cls
    echo Running Automation Tests...
    cd backend
    if exist venv (call venv\Scripts\activate)
    python test_with_mocks.py
    pause
    goto :menu
)

REM Host App
if "%opt%"=="9" (
    cls
    echo Starting Host App in Dev Mode...
    cd host-app
    if not exist node_modules (
        echo Installing dependencies...
        call npm install
    )
    npm start
    pause
    goto :menu
)

if "%opt%"=="0" (
    cls
    echo Building Host App EXE...
    cd host-app
    if not exist node_modules (
        echo Installing dependencies...
        call npm install
    )
    call npm run build-win
    echo.
    echo Build complete! Check host-app/dist/
    pause
    goto :menu
)

REM Management
if /i "%opt%"=="E" (
    cls
    echo Setting up Python Virtual Environment...
    cd backend
    if exist venv (
        echo Virtual environment already exists.
        set /p recreate="Recreate? (y/n): "
        if /i not "!recreate!"=="y" goto :menu
        rmdir /s /q venv
    )
    python -m venv venv
    if errorlevel 1 (
        echo ERROR: Failed to create venv.
        pause
        goto :menu
    )
    echo Installing dependencies...
    call venv\Scripts\activate
    pip install -r requirements.txt
    echo.
    echo Setup complete!
    pause
    goto :menu
)

if /i "%opt%"=="F" (
    cls
    echo Cleaning node_modules...
    if exist frontend\node_modules rmdir /s /q frontend\node_modules
    if exist host-app\node_modules rmdir /s /q host-app\node_modules
    if exist backend\node_modules rmdir /s /q backend\node_modules
    echo Done!
    pause
    goto :menu
)

if /i "%opt%"=="G" exit

goto :menu

:AUTOMATION_MENU
cls
echo.
echo  === Automation Scripts ===
echo.
echo  [1] Get Live Matches
echo  [2] Run Scraper
echo  [3] Process Match Status
echo  [4] Auto-Schedule Matches
echo  [5] Calculate Scores
echo  [6] Update Leaderboard
echo  [7] Run Reconciliation
echo  [8] Back to Main Menu
echo.
set /p script_opt="Select script: "

if "%script_opt%"=="1" (
    cd backend
    if exist venv (call venv\Scripts\activate)
    python -m automation.main live-matches --sport cricket
    pause
    goto :AUTOMATION_MENU
)

if "%script_opt%"=="2" (
    cd backend
    if exist venv (call venv\Scripts\activate)
    python -m automation.main run-scraper
    pause
    goto :AUTOMATION_MENU
)

if "%script_opt%"=="3" (
    cd backend
    if exist venv (call venv\Scripts\activate)
    python -m automation.main match-status --sport cricket
    pause
    goto :AUTOMATION_MENU
)

if "%script_opt%"=="4" (
    cd backend
    if exist venv (call venv\Scripts\activate)
    python -m automation.main auto-schedule --sport cricket --days 3
    pause
    goto :AUTOMATION_MENU
)

if "%script_opt%"=="5" (
    cd backend
    if exist venv (call venv\Scripts\activate)
    set /p tid="Tournament ID: "
    set /p mid="Match ID: "
    python -m automation.main calculate-scores --sport cricket --tournament-id !tid! --match-id !mid!
    pause
    goto :AUTOMATION_MENU
)

if "%script_opt%"=="6" (
    cd backend
    if exist venv (call venv\Scripts\activate)
    set /p tid="Tournament ID: "
    python -m automation.main update-leaderboard --sport cricket --tournament-id !tid!
    pause
    goto :AUTOMATION_MENU
)

if "%script_opt%"=="7" (
    cd backend
    if exist venv (call venv\Scripts\activate)
    python -m automation.main run --script reconciliation
    pause
    goto :AUTOMATION_MENU
)

if "%script_opt%"=="8" goto :menu

goto :AUTOMATION_MENU
