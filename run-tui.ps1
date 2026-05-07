# OverlayChat TUI (PowerShell)
# Requires: Windows Terminal or PowerShell 5.1+ for colors

# Color definitions
$colors = @{
    Primary = 'Cyan'
    Success = 'Green'
    Warning = 'Yellow'
    Error = 'Red'
    Info = 'White'
    Header = 'Magenta'
    Dim = 'Gray'
}

function Write-Color {
    param(
        [string]$Text,
        [string]$Color = 'White',
        [switch]$NoNewLine
    )
    Write-Host $Text -ForegroundColor $Color -NoNewline:$NoNewLine
}

function Show-Header {
    Clear-Host
    Write-Color "=" -Color $colors.Header
    Write-Color "=" -Color $colors.Header
    Write-Color "=" -Color $colors.Header
    Write-Host ""
    Write-Color "   OverlayChat Dev Console" -Color $colors.Header
    Write-Host ""
    Write-Color "=" -Color $colors.Header
    Write-Color "=" -Color $colors.Header
    Write-Color "=" -Color $colors.Header
    Write-Host ""
    
    # Get IP
    $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -ne '127.0.0.1' } | Select-Object -First 1).IPAddress
    Write-Color "   Local IP: " -Color $colors.Dim -NoNewLine
    Write-Color $ip -Color $colors.Info
    Write-Host ""
    Write-Host ""
}

function Show-Menu {
    param($MenuItems, $Title)
    
    Write-Color "   $Title" -Color $colors.Primary
    Write-Host "   " -NoNewline
    Write-Color "-" -Color $colors.Dim -NoNewLine
    Write-Host "" 
    $i = 1
    foreach ($item in $MenuItems) {
        Write-Color "   [$i] " -Color $colors.Dim -NoNewLine
        Write-Color $item -Color $colors.Info
        $i++
    }
    Write-Host ""
}

function Test-Prerequisites {
    $errors = @()
    
    # Check Python
    try {
        $pyVersion = python --version 2>&1
        if ($LASTEXITCODE -ne 0) { $errors += "Python not found" }
    } catch {
        $errors += "Python not found"
    }
    
    # Check Node
    try {
        $nodeVersion = node --version 2>&1
        if ($LASTEXITCODE -ne 0) { $errors += "Node.js not found" }
    } catch {
        $errors += "Node.js not found"
    }
    
    return $errors
}

function Start-AllServices {
    Write-Color "   Starting ALL services..." -Color $colors.Warning
    Write-Host ""
    
    # Backend
    Start-Process "cmd.exe" -ArgumentList "/k", "cd backend && python server.py" -WindowStyle Normal
    Start-Sleep -Seconds 2
    
    # Host App
    Start-Process "cmd.exe" -ArgumentList "/k", "cd host-app && npm start" -WindowStyle Normal
    Start-Sleep -Seconds 2
    
    # Frontend
    Start-Process "cmd.exe" -ArgumentList "/k", "cd frontend && npm run dev -- --host 0.0.0.0" -WindowStyle Normal
    
    Write-Host ""
    Write-Color "   All services started!" -Color $colors.Success
    Write-Color "   - Backend: http://localhost:4173" -Color $colors.Info
    Write-Color "   - Frontend: http://localhost:5173" -Color $colors.Info
    Write-Color "   - Host App: Electron window" -Color $colors.Info
    Write-Host ""
    pause
}

function Start-Frontend {
    Start-Process "cmd.exe" -ArgumentList "/k", "cd frontend && npm run dev -- --host 0.0.0.0"
    Write-Color "   Frontend starting..." -Color $colors.Success
    Start-Sleep -Seconds 1
}

function Start-Backend {
    Start-Process "cmd.exe" -ArgumentList "/k", "cd backend && python server.py"
    Write-Color "   Backend starting..." -Color $colors.Success
    Start-Sleep -Seconds 1
}

function Start-HostApp {
    Start-Process "cmd.exe" -ArgumentList "/k", "cd host-app && npm start"
    Write-Color "   Host App starting..." -Color $colors.Success
    Start-Sleep -Seconds 1
}

function Build-Frontend {
    Write-Color "   Building frontend..." -Color $colors.Warning
    Set-Location frontend
    npm run build
    Set-Location ..
    Write-Color "   Build complete! Check frontend/dist/" -Color $colors.Success
    pause
}

function Show-AutomationMenu {
    $running = $true
    while ($running) {
        Show-Header
        Show-Menu -Title "Automation Scripts" -MenuItems @(
            "Get Live Matches",
            "Run Scraper",
            "Process Match Status",
            "Auto-Schedule Matches",
            "Calculate Scores",
            "Update Leaderboard",
            "Run Reconciliation",
            "Back to Main Menu"
        )
        
        Write-Host ""
        $choice = Read-Host "   Select option"
        
        switch ($choice) {
            1 { 
                Set-Location backend
                python -m automation.main live-matches
                Set-Location ..
                pause
            }
            2 {
                Set-Location backend
                python -m automation.main run-scraper
                Set-Location ..
                pause
            }
            3 {
                Set-Location backend
                python -m automation.main match-status
                Set-Location ..
                pause
            }
            4 {
                Set-Location backend
                python -m automation.main auto-schedule --days 3
                Set-Location ..
                pause
            }
            5 {
                $tid = Read-Host "   Tournament ID"
                $mid = Read-Host "   Match ID"
                Set-Location backend
                python -m automation.main calculate-scores --tournament-id $tid --match-id $mid
                Set-Location ..
                pause
            }
            6 {
                $tid = Read-Host "   Tournament ID"
                Set-Location backend
                python -m automation.main update-leaderboard --tournament-id $tid
                Set-Location ..
                pause
            }
            7 {
                Set-Location backend
                python -m automation.main run --script reconciliation
                Set-Location ..
                pause
            }
            8 { $running = $false }
        }
    }
}

# Main loop
$running = $true
while ($running) {
    Show-Header
    
    # Check pre-reqs
    $errors = Test-Prerequisites
    if ($errors.Count -gt 0) {
        Write-Color "   WARNING: Prerequisites missing:" -Color $colors.Error
        foreach ($err in $errors) {
            Write-Color "   - $err" -Color $colors.Error
        }
        Write-Host ""
    }
    
    # Main menu
    Show-Menu -Title "Main Menu" -MenuItems @(
        "Start ALL Services (Dev)",
        "Frontend (Audience)",
        "Backend (FastAPI + Automation)",
        "Host App (Electron - Admin)",
        "Automation Scripts",
        "Build Frontend",
        "Setup Python Venv",
        "Clean node_modules",
        "Exit"
    )
    
    Write-Host ""
    $choice = Read-Host "   Select option"
    
    switch ($choice) {
        1 { Start-AllServices }
        2 { Start-Frontend }
        3 { Start-Backend }
        4 { Start-HostApp }
        5 { Show-AutomationMenu }
        6 { Build-Frontend }
        7 {
            Set-Location backend
            python -m venv venv
            .\venv\Scripts\activate
            pip install -r requirements.txt
            Set-Location ..
            pause
        }
        8 {
            Remove-Item -Path frontend\node_modules, host-app\node_modules, backend\node_modules -Recurse -Force -ErrorAction SilentlyContinue
            Write-Color "   Cleaned node_modules!" -Color $colors.Success
            pause
        }
        9 { 
            Write-Color "   Goodbye!" -Color $colors.Primary
            $running = $false 
        }
    }
}
