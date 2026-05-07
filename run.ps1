# Predicto Dev Launcher (PowerShell)
# Migrated from run.bat to a PowerShell-based interactive menu.

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Get-LocalIp {
    try {
        $addr = Get-NetIPAddress -AddressFamily IPv4 |
            Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.IPAddress -notlike '169.*' -and $_.IPAddress -notlike '::1' } |
            Select-Object -ExpandProperty IPAddress -First 1
        if ($addr) { return $addr }
    } catch {
        # Fallback to ipconfig parsing
    }

    $ipconfig = ipconfig | Select-String 'IPv4 Address' | Select-Object -First 1
    if ($ipconfig) {
        return ($ipconfig.ToString() -split ':')[1].Trim()
    }
    return '127.0.0.1'
}

function Pause-Host {
    Write-Host
    Write-Host 'Press any key to continue...' -NoNewline
    [System.Console]::ReadKey($true) | Out-Null
    Write-Host
}

function Read-MenuKey {
    Write-Host -NoNewline 'Select option: '
    $key = [System.Console]::ReadKey($true)
    Write-Host $key.KeyChar
    return $key.KeyChar.ToString().ToUpperInvariant()
}

function Show-PortStatus {
    Write-Host
    Write-Host ' =========================================='
    Write-Host '   Port Status Monitor'
    Write-Host ' =========================================='
    Write-Host
    Write-Host ' [Backend] Port 8765: Ready to use'
    Write-Host ' [Frontend] Port 3456: Ready to use'
    Write-Host ' [Host App] Electron: Ready to start'
    Write-Host
}

function Start-NewConsole {
    param(
        [Parameter(Mandatory)] [string] $Title,
        [Parameter(Mandatory)] [string] $WorkingDirectory,
        [Parameter(Mandatory)] [string] $Command
    )

    $cmd = "title $Title && cd /d `"$WorkingDirectory`" && $Command"
    Start-Process -FilePath 'cmd.exe' -ArgumentList '/k', $cmd
}

function Stop-ConsoleByTitle {
    param(
        [Parameter(Mandatory)] [string] $Title
    )

    $processes = Get-Process -Name cmd -ErrorAction SilentlyContinue |
        Where-Object { $_.MainWindowTitle -eq $Title }
    if ($processes) {
        $processes | Stop-Process -Force
        Write-Host "Stopped console window titled '$Title'."
    } else {
        Write-Host "No running console window found for '$Title'."
    }
}

function Start-Backend {
    $path = Join-Path $ScriptDir 'backend'
    $command = 'if exist venv\Scripts\activate call venv\Scripts\activate && set BACKEND_PORT=8765 && python server.py'
    Start-NewConsole -Title 'Backend' -WorkingDirectory $path -Command $command
}

function Start-Frontend {
    $path = Join-Path $ScriptDir 'frontend'
    $command = 'echo Frontend: http://localhost:3456 && npm run dev -- --port 3456 --host 0.0.0.0'
    Start-NewConsole -Title 'Frontend' -WorkingDirectory $path -Command $command
}

function Start-HostApp {
    $path = Join-Path $ScriptDir 'host-app'
    $command = 'if not exist node_modules npm install && npm start'
    Start-NewConsole -Title 'Host App' -WorkingDirectory $path -Command $command
}

function Start-AutomationScheduler {
    $path = Join-Path $ScriptDir 'backend'
    $command = 'if exist venv\Scripts\activate call venv\Scripts\activate && python -m automation.main scheduler start'
    Start-NewConsole -Title 'Automation' -WorkingDirectory $path -Command $command
}

function Start-AutomationTests {
    $path = Join-Path $ScriptDir 'backend'
    $command = 'if exist venv\Scripts\activate call venv\Scripts\activate && python test_with_mocks.py'
    Start-NewConsole -Title 'Automation Tests' -WorkingDirectory $path -Command $command
}

function Show-Menu {
    Clear-Host
    Write-Host
    Write-Host ' =========================================='
    Write-Host '   Predicto Dev Console'
    Write-Host ' =========================================='
    Write-Host
    Show-PortStatus
    Write-Host ' =========================================='
    Write-Host
    Write-Host " Local IP: $(Get-LocalIp)"
    Write-Host
    Write-Host ' Fixed Ports: Backend=8765, Frontend=3456'
    Write-Host
    Write-Host ' [A] Start ALL (Backend + Host App + Frontend)'
    Write-Host ' [P] Show Port Status'
    Write-Host
    Write-Host ' ----- Frontend (Audience) -----'
    Write-Host ' [1] Start Frontend (Dev Mode)'
    Write-Host ' [R] Restart Frontend'
    Write-Host ' [2] Build Frontend'
    Write-Host ' [3] Deploy to Firebase'
    Write-Host
    Write-Host ' ----- Backend (FastAPI + Automation) -----'
    Write-Host ' [4] Start Backend Server'
    Write-Host ' [B] Restart Backend'
    Write-Host ' [5] Start Automation Scheduler'
    Write-Host ' [6] Run Automation Script'
    Write-Host ' [7] View Logs'
    Write-Host ' [8] Test Automation'
    Write-Host
    Write-Host ' ----- Host App (Electron - Admin) -----'
    Write-Host ' [9] Start Host App (Dev)'
    Write-Host ' [H] Restart Host App'
    Write-Host ' [0] Build Host App (EXE)'
    Write-Host
    Write-Host ' ----- Management -----'
    Write-Host ' [E] Setup Python Venv'
    Write-Host ' [F] Clean node_modules'
    Write-Host ' [G] Exit'
    Write-Host
}

function Install-PythonDependencies {
    $backendPath = Join-Path $ScriptDir 'backend'
    $venvPath = Join-Path $backendPath 'venv'

    if (-not (Test-Path $venvPath)) {
        python -m venv $venvPath
        if ($LASTEXITCODE -ne 0) {
            Write-Host 'ERROR: Failed to create virtual environment.' -ForegroundColor Red
            return
        }
    }

    $pipPath = Join-Path $venvPath 'Scripts\pip.exe'
    if (-not (Test-Path $pipPath)) {
        Write-Host 'ERROR: pip not found in virtual environment.' -ForegroundColor Red
        return
    }

    & $pipPath install -r (Join-Path $backendPath 'requirements.txt')
}

function Clean-NodeModules {
    $targets = @(
        Join-Path $ScriptDir 'frontend\node_modules',
        Join-Path $ScriptDir 'host-app\node_modules',
        Join-Path $ScriptDir 'backend\node_modules'
    )
    foreach ($target in $targets) {
        if (Test-Path $target) {
            Remove-Item -Recurse -Force -LiteralPath $target
            Write-Host "Removed $target"
        }
    }
}

function Build-Frontend {
    Push-Location (Join-Path $ScriptDir 'frontend')
    npm run build
    Pop-Location
}

function Deploy-Frontend {
    Push-Location (Join-Path $ScriptDir 'frontend')
    npm run build
    Pop-Location
    Push-Location (Join-Path $ScriptDir 'backend')
    npm run deploy
    Pop-Location
}

function Build-HostApp {
    Push-Location (Join-Path $ScriptDir 'host-app')
    if (-not (Test-Path 'node_modules')) {
        npm install
    }
    npm run build-win
    Pop-Location
}

function Show-Logs {
    $logFile = Join-Path $ScriptDir 'backend\logs\automation.log'
    if (Test-Path $logFile) {
        Get-Content $logFile -Wait
    } else {
        Write-Host 'No logs found.'
    }
}

function Start-All {
    Start-Backend
    Start-HostApp
    Start-Frontend
    Write-Host
    Write-Host 'All services started in separate windows!'
    Write-Host ' Backend: http://localhost:8765'
    Write-Host ' Frontend: http://localhost:3456'
    Write-Host ' Host App: Electron window'
}

# Main menu loop
while ($true) {
    Show-Menu
    $opt = Read-MenuKey
    switch ($opt) {
        'P' {
            Show-PortStatus
            Pause-Host
        }
        'A' {
            Start-All
            Pause-Host
        }
        '1' {
            Start-Frontend
            Pause-Host
        }
        'R' {
            Stop-ConsoleByTitle -Title 'Frontend'
            Start-Frontend
            Pause-Host
        }
        '2' {
            Build-Frontend
            Pause-Host
        }
        '3' {
            Deploy-Frontend
            Pause-Host
        }
        '4' {
            Start-Backend
            Pause-Host
        }
        'B' {
            Stop-ConsoleByTitle -Title 'Backend'
            Start-Backend
            Pause-Host
        }
        '5' {
            Start-AutomationScheduler
            Pause-Host
        }
        '6' {
            Push-Location (Join-Path $ScriptDir 'backend')
            python -m automation.main live-matches --sport cricket
            Pop-Location
            Pause-Host
        }
        '7' {
            Show-Logs
            Pause-Host
        }
        '8' {
            Start-AutomationTests
            Pause-Host
        }
        'H' {
            Stop-ConsoleByTitle -Title 'Host App'
            Start-HostApp
            Pause-Host
        }
        '9' {
            Start-HostApp
            Pause-Host
        }
        '0' {
            Build-HostApp
            Pause-Host
        }
        'E' {
            Install-PythonDependencies
            Pause-Host
        }
        'F' {
            Clean-NodeModules
            Pause-Host
        }
        'G' {
            break
        }
        Default {
            Write-Host 'Invalid selection, try again.' -ForegroundColor Yellow
            Pause-Host
        }
    }
}
