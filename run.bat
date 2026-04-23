@echo off
setlocal
cls

REM Get local IP address
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4 Address" ^| findstr /v "127.0.0.1"') do (
    for /f "tokens=*" %%b in ("%%a") do set LOCAL_IP=%%b
)
set LOCAL_IP=%LOCAL_IP: =%

echo ==========================================
echo    Predictor Manager Management Console
echo ==========================================
echo.
echo Local Network IP: %LOCAL_IP%
echo.
echo  [0]  Start FULL STACK (LOCAL)
echo  [P]  Start FULL STACK (PROD) - !DANGER!
echo.
echo  [1]  Broadcaster App Only (Local)
echo  [2]  Audience App Only (Local)
echo.
echo  [3]  Deploy Frontend to Firebase
echo  [4]  Setup Python Virtual Environment
echo  [5]  Maintenance (Clean node_modules)
echo  [6]  Exit
echo.
set /p opt="Select an option: "

if "%opt%"=="0" (
    echo Launching FULL STACK in LOCAL mode...
    start cmd /k "echo Broadcaster (Local) && cd backend && npm start -- --mode=local"
    start cmd /k "echo Audience (Local) && cd frontend && echo Frontend will be available at: && echo   - Local: http://localhost:5173 && echo   - Network: http://%LOCAL_IP%:5173 && npm run dev -- --host 0.0.0.0"
    goto :eof
)

if "%opt%"=="p" goto PROD_CONFIRM
if "%opt%"=="P" goto PROD_CONFIRM

if "%opt%"=="1" (
    echo Launching Broadcaster in LOCAL mode...
    cd backend
    npm start -- --mode=local
    pause
    goto :eof
)

if "%opt%"=="2" (
    echo Launching Audience...
    echo Frontend will be available at:
    echo   - Local: http://localhost:5173
    echo   - Network: http://%LOCAL_IP%:5173
    echo.
    cd frontend
    npm run dev -- --host 0.0.0.0
    pause
    goto :eof
)

if "%opt%"=="3" (
    echo Building and Deploying to Firebase...
    cd backend
    npm run deploy
    pause
    goto :eof
)

if "%opt%"=="4" (
    echo Setting up Python Virtual Environment...
    echo.
    if exist venv (
        echo Virtual environment already exists at venv\
        set /p recreate="Do you want to recreate it? (y/n): "
        if /i not "%recreate%"=="y" (
            echo Setup cancelled.
            pause
            goto :eof
        )
        rmdir /s /q venv
    )
    echo Creating virtual environment...
    python -m venv venv
    if errorlevel 1 (
        echo ERROR: Failed to create virtual environment.
        echo Make sure Python 3.10+ is installed and in PATH.
        pause
        goto :eof
    )
    echo Virtual environment created successfully.
    echo.
    echo Installing Python dependencies...
    call venv\Scripts\activate
    pip install -r backend\requirements.txt
    if errorlevel 1 (
        echo ERROR: Failed to install dependencies.
        pause
        goto :eof
    )
    echo.
    echo Python setup completed successfully!
    echo.
    echo IMPORTANT: To use Python scripts, activate the virtual environment first:
    echo   venv\Scripts\activate
    echo.
    pause
    goto :eof
)

if "%opt%"=="5" (
    echo Attempting to clean root artifacts...
    taskkill /F /IM electron.exe /T 2>nul
    rmdir /s /q backend\node_modules 2>nul
    rmdir /s /q frontend\node_modules 2>nul
    echo Cleanup attempt finished.
    pause
    goto :eof
)

if "%opt%"=="6" exit
goto :eof

:PROD_CONFIRM
echo.
echo !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
echo  WARNING: YOU ARE ABOUT TO CONNECT TO PRODUCTION DATABASE
echo !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
echo.
set /p confirm="Type 'YES' to proceed into PROD mode: "
if /i "%confirm%"=="YES" (
    echo Launching FULL STACK in PROD mode...
    start cmd /k "echo Broadcaster (PROD) && cd backend && npm start -- --mode=prod"
    start cmd /k "echo Audience (PROD) && cd frontend && echo Frontend will be available at: && echo   - Local: http://localhost:5173 && echo   - Network: http://%LOCAL_IP%:5173 && npm run dev:prod -- --host 0.0.0.0"
) else (
    echo Launch cancelled.
)
pause
goto :eof
