@echo off
setlocal
cls
echo ==========================================
echo    OverlayChat Management Console
echo ==========================================
echo.
echo  [0]  Start FULL STACK (LOCAL)
echo  [P]  Start FULL STACK (PROD) - !DANGER!
echo.
echo  [1]  Broadcaster App Only (Local)
echo  [2]  Audience App Only (Local)
echo.
echo  [3]  Deploy Frontend to Firebase
echo  [4]  Maintenance (Clean node_modules)
echo  [5]  Exit
echo.
set /p opt="Select an option: "

if "%opt%"=="0" (
    echo Launching FULL STACK in LOCAL mode...
    start cmd /k "echo Broadcaster (Local) && cd backend && npm start -- --mode=local"
    start cmd /k "echo Audience (Local) && cd frontend && npm run dev"
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
    cd frontend
    npm run dev
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
    echo Attempting to clean root artifacts...
    taskkill /F /IM electron.exe /T 2>nul
    rmdir /s /q backend\node_modules 2>nul
    rmdir /s /q frontend\node_modules 2>nul
    echo Cleanup attempt finished.
    pause
    goto :eof
)

if "%opt%"=="5" exit
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
    start cmd /k "echo Audience (PROD) && cd frontend && npm run dev"
) else (
    echo Launch cancelled.
)
pause
goto :eof
