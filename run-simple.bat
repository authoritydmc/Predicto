@echo off
cls
echo ================================
echo    OverlayChat Dev Console
echo ================================
echo.
echo [1] Start ALL Services
echo [2] Frontend (Dev)
echo [3] Backend (FastAPI)
echo [4] Host App (Electron)
echo [5] Automation Tests
echo [6] Exit
echo.
set /p opt="Select option: "

if "%opt%"=="1" (
    echo Starting ALL...
    start "Backend" cmd /k "cd backend && python server.py"
    timeout /t 2 >nul
    start "HostApp" cmd /k "cd host-app && npm start"
    timeout /t 2 >nul
    start "Frontend" cmd /k "cd frontend && npm run dev"
    echo Done! Check the 3 new windows.
    pause
    goto :eof
)

if "%opt%"=="2" (
    cd frontend
    npm run dev
    goto :eof
)

if "%opt%"=="3" (
    cd backend
    python server.py
    goto :eof
)

if "%opt%"=="4" (
    cd host-app
    npm start
    goto :eof
)

if "%opt%"=="5" (
    cd backend
    python test_with_mocks.py
    pause
    goto :eof
)

if "%opt%"=="6" exit
goto :eof
