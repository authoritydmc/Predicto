@echo off
setlocal
cls
echo ==========================================
echo    OverlayChat Management Console
echo ==========================================
echo.
echo [0] Start Full Local Stack (Broadcaster + Audience)
echo [1] Start Host App (Broadcaster Electron + Python)
echo [2] Start Audience App (React Web Dev Mode)
echo [3] Deploy Production (Frontend + Firebase)
echo [4] Clean Root node_modules (Maintenance)
echo [5] Exit
echo.
set /p opt="Select an option (0-5): "

if "%opt%"=="0" (
    echo Launching Full Local Stack...
    start cmd /k "echo Launching Host Backend... && cd backend && npm start"
    start cmd /k "echo Launching Audience Frontend... && cd frontend && npm run dev"
    goto :eof
) else if "%opt%"=="1" (
    echo Launching Host Backend...
    cd backend
    if not exist node_modules (
        echo First time setup: Installing node_modules...
        npm install
    )
    npm start
    pause
) else if "%opt%"=="2" (
    echo Launching Audience Frontend...
    cd frontend
    if not exist node_modules (
        echo First time setup: Installing node_modules...
        npm install
    )
    npm run dev
    pause
) else if "%opt%"=="3" (
    echo Building and Deploying to Firebase...
    cd backend
    npm run deploy
    pause
) else if "%opt%"=="4" (
    echo Attempting to clean root artifacts...
    taskkill /F /IM electron.exe /T 2>nul
    del package.json 2>nul
    del package-lock.json 2>nul
    rmdir /s /q node_modules 2>nul
    echo Cleanup attempt finished.
    pause
) else if "%opt%"=="5" (
    exit
) else (
    echo Invalid option.
    pause
    goto :eof
)
