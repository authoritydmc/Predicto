@echo off
setlocal EnableDelayedExpansion
cls

REM Get local IP address
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4 Address" ^| findstr /v "127.0.0.1"') do (
    for /f "tokens=*" %%b in ("%%a") do set LOCAL_IP=%%b
)
set LOCAL_IP=%LOCAL_IP: =%

goto :menu

:SHOW_PORT_STATUS
echo.
echo  ==========================================
echo    Port Status Monitor
echo  ==========================================
echo.

REM Use hardcoded ports
set BACKEND_PORT=8765
set FRONTEND_PORT=3456

echo  [Backend] Port 8765: Ready to use
echo  [Frontend] Port 3456: Ready to use
echo  [Host App] Electron: Ready to start

echo.
echo  ==========================================
goto :eof

:CHECK_PORT_CONFLICT
set APP_NAME=%1
set PORT_NUMBER=%2

REM Simple port check - no complex parsing to avoid false positives
netstat -ano | findstr ":%PORT_NUMBER% " | findstr LISTENING >nul
if %errorlevel% equ 0 (
    echo.
    echo  Port %PORT_NUMBER% appears to be in use.
    echo  Starting %APP_NAME% anyway (ports 8765/3456 are rarely conflicted)...
    echo.
) else (
    echo.
    echo  Port %PORT_NUMBER% is available. Starting %APP_NAME%...
    echo.
)
goto :eof

:CHECK_ELECTRON_CONFLICT
set APP_NAME=%1

REM Check for existing Electron processes
tasklist /FI "IMAGENAME eq electron.exe" 2>nul | findstr /I "electron.exe" >nul
if %errorlevel% equ 0 (
    echo.
    echo  WARNING: Electron process is already running!
    echo.
    for /f "tokens=1,5" %%a in ('tasklist /FI "IMAGENAME eq electron.exe" /FO CSV ^| findstr /v "INFO"') do (
        set ELECTRON_PROCESS=%%~a
        set ELECTRON_PID=%%~b
    )
    echo  Electron is running: !ELECTRON_PROCESS! (PID: !ELECTRON_PID!)
    echo.
    set /p kill_electron="Do you want to close existing Electron and start %APP_NAME%? (y/n): "
    if /i "!kill_electron!"=="y" (
        echo Closing Electron process (PID: !ELECTRON_PID!)...
        taskkill /F /PID !ELECTRON_PID! >nul 2>&1
        timeout /t 2 >nul
        echo Process closed. Starting %APP_NAME%...
    ) else (
        echo Cannot start %APP_NAME% while Electron is already running.
        pause
        goto :menu
    )
)
goto :eof

:FIND_AVAILABLE_PORT
set PORT_RANGE_START=%1
set PORT_RANGE_END=%2
set RESULT_VAR=%3

:FIND_PORT_LOOP
set /a RANDOM_PORT=%PORT_RANGE_START% + (%RANDOM% %% (%PORT_RANGE_END% - %PORT_RANGE_START% + 1))

REM Check if port is available
netstat -ano | findstr :%RANDOM_PORT% >nul
if %errorlevel% neq 0 (
    REM Port is available
    set %RESULT_VAR%=%RANDOM_PORT%
    goto :eof
) else (
    REM Port is in use, try another
    goto :FIND_PORT_LOOP
)

:GET_DYNAMIC_PORTS
REM Find available ports for backend and frontend
call :FIND_AVAILABLE_PORT 8000 9000 BACKEND_PORT
call :FIND_AVAILABLE_PORT 3000 4000 FRONTEND_PORT

REM Save ports to temp file for other processes to read
echo BACKEND_PORT=%BACKEND_PORT% > temp_ports.txt
echo FRONTEND_PORT=%FRONTEND_PORT% >> temp_ports.txt

goto :eof

:READ_PORTS_FROM_FILE
if exist temp_ports.txt (
    for /f "tokens=2 delims==" %%a in ('findstr "BACKEND_PORT" temp_ports.txt') do set BACKEND_PORT=%%a
    for /f "tokens=2 delims==" %%a in ('findstr "FRONTEND_PORT" temp_ports.txt') do set FRONTEND_PORT=%%a
) else (
    REM Fallback to default ports
    set BACKEND_PORT=4173
    set FRONTEND_PORT=5173
)
goto :eof

:menu
cls
echo.
echo  ==========================================
echo    Predicto Dev Console
echo  ==========================================
echo.

REM Set hardcoded ports (less commonly used)
set BACKEND_PORT=8765
set FRONTEND_PORT=3456

REM Show port status inline
echo.
echo  ==========================================
echo    Port Status Monitor
echo  ==========================================
echo.
echo  [Backend] Port 8765: Ready to use
echo  [Frontend] Port 3456: Ready to use
echo  [Host App] Electron: Ready to start
echo.
echo  ==========================================

echo  Local IP: %LOCAL_IP%
echo.
echo  Fixed Ports: Backend=%BACKEND_PORT%, Frontend=%FRONTEND_PORT%
echo.
echo  [A] Start ALL (Backend + Host App + Frontend)
echo  [P] Show Port Status
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

REM Port Status
if /i "%opt%"=="P" (
    cls
    call :SHOW_PORT_STATUS
    echo.
    pause
    goto :menu
)

REM Start ALL
if /i "%opt%"=="A" (
    cls
    echo Starting ALL services...
    echo.
    
    REM Use hardcoded ports
    set BACKEND_PORT=8765
    set FRONTEND_PORT=3456
    echo Using fixed ports: Backend=%BACKEND_PORT%, Frontend=%FRONTEND_PORT%
    echo.
    
    REM Check for port conflicts before starting backend
    call :CHECK_PORT_CONFLICT "Backend Server" "%BACKEND_PORT%"
    
    REM Start Backend with fixed port
    start "Backend" cmd /k "cd backend && if exist venv (call venv\Scripts\activate) && set BACKEND_PORT=%BACKEND_PORT% && python server.py"
    timeout /t 3 >nul
    
    REM Start Host App
    start "Host App" cmd /k "cd host-app && if not exist node_modules npm install && npm start"
    timeout /t 3 >nul
    
    REM Start Frontend with fixed port
    start "Frontend" cmd /k "cd frontend && echo Frontend: http://localhost:%FRONTEND_PORT% && npm run dev -- --port %FRONTEND_PORT% --host 0.0.0.0"
    
    echo.
    echo All services started in separate windows!
    echo.
    echo  Backend Server:
    echo   - Local:   http://localhost:%BACKEND_PORT%
    echo   - Network: http://%LOCAL_IP%:%BACKEND_PORT%
    echo.
    echo  Frontend Dev Server:
    echo   - Local:   http://localhost:%FRONTEND_PORT%
    echo   - Network: http://%LOCAL_IP%:%FRONTEND_PORT%
    echo   - LAN Access: ENABLED (0.0.0.0)
    echo.
    echo  Host App: Electron window
    pause
    goto :menu
)

REM Frontend
if "%opt%"=="1" (
    cls
    echo Starting Frontend Dev Server...
    
    REM Use hardcoded port
    set FRONTEND_PORT=3456
    
    REM Check for port conflicts before starting frontend
    call :CHECK_PORT_CONFLICT "Frontend Dev Server" "%FRONTEND_PORT%"
    
    cd frontend
    echo ==========================================
    echo  Frontend Dev Server Starting...
    echo ==========================================
    echo.
    echo  Available URLs:
    echo   - Local:   http://localhost:%FRONTEND_PORT%
    echo   - Network: http://%LOCAL_IP%:%FRONTEND_PORT%
    echo.
    echo  LAN Access: ENABLED (0.0.0.0)
    echo  Test from other devices: http://%LOCAL_IP%:%FRONTEND_PORT%
    echo.
    echo ==========================================
    npm run dev -- --port %FRONTEND_PORT% --host 0.0.0.0
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
    echo.
    
    REM Use hardcoded port
    set BACKEND_PORT=8765
    
    REM Check for port conflicts before starting backend
    call :CHECK_PORT_CONFLICT "Backend Server" "%BACKEND_PORT%"
    
    REM Start Backend in new console window
    start "Backend Server" cmd /k "cd backend && if exist venv (call venv\Scripts\activate) && set BACKEND_PORT=%BACKEND_PORT% && python server.py"
    
    echo.
    echo Backend Server started in new console window!
    echo  - Local:   http://localhost:%BACKEND_PORT%
    echo  - Network: http://%LOCAL_IP%:%BACKEND_PORT%
    echo.
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
    echo.
    
    REM Start Automation Tests in new console window
    start "Automation Tests" cmd /k "cd backend && if exist venv (call venv\Scripts\activate) && python test_with_mocks.py"
    
    echo.
    echo Automation Tests started in new console window!
    echo.
    pause
    goto :menu
)

REM Host App
if "%opt%"=="9" (
    cls
    echo Starting Host App in Dev Mode...
    echo.
    
    REM Check for existing Electron processes
    call :CHECK_ELECTRON_CONFLICT "Predicto Host App"
    
    REM Start Host App in new console window
    start "Predicto Host App" cmd /k "cd host-app && if not exist node_modules (echo Installing dependencies... && npm install) && npm start"
    
    echo.
    echo Host App started in new console window!
    echo.
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
    start "Live Matches" cmd /k "cd backend && if exist venv (call venv\Scripts\activate) && python -m automation.main live-matches --sport cricket"
    echo Live Matches script started in new console window!
    pause
    goto :AUTOMATION_MENU
)

if "%script_opt%"=="2" (
    start "Scraper" cmd /k "cd backend && if exist venv (call venv\Scripts\activate) && python -m automation.main run-scraper"
    echo Scraper script started in new console window!
    pause
    goto :AUTOMATION_MENU
)

if "%script_opt%"=="3" (
    start "Match Status" cmd /k "cd backend && if exist venv (call venv\Scripts\activate) && python -m automation.main match-status --sport cricket"
    echo Match Status script started in new console window!
    pause
    goto :AUTOMATION_MENU
)

if "%script_opt%"=="4" (
    start "Auto-Schedule" cmd /k "cd backend && if exist venv (call venv\Scripts\activate) && python -m automation.main auto-schedule --sport cricket --days 3"
    echo Auto-Schedule script started in new console window!
    pause
    goto :AUTOMATION_MENU
)

if "%script_opt%"=="5" (
    echo Calculate Scores requires input - running in current window
    cd backend
    if exist venv (call venv\Scripts\activate)
    set /p tid="Tournament ID: "
    set /p mid="Match ID: "
    python -m automation.main calculate-scores --sport cricket --tournament-id !tid! --match-id !mid!
    pause
    goto :AUTOMATION_MENU
)

if "%script_opt%"=="6" (
    echo Update Leaderboard requires input - running in current window
    cd backend
    if exist venv (call venv\Scripts\activate)
    set /p tid="Tournament ID: "
    python -m automation.main update-leaderboard --sport cricket --tournament-id !tid!
    pause
    goto :AUTOMATION_MENU
)

if "%script_opt%"=="7" (
    start "Reconciliation" cmd /k "cd backend && if exist venv (call venv\Scripts\activate) && python -m automation.main run --script reconciliation"
    echo Reconciliation script started in new console window!
    pause
    goto :AUTOMATION_MENU
)

if "%script_opt%"=="8" goto :menu

goto :AUTOMATION_MENU
