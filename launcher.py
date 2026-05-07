#!/usr/bin/env python3
"""
Predicto Dev Launcher - Python Edition
Cross-platform development launcher with colors and icons.
Supports both interactive mode and command-line arguments.
"""

import os
import sys
import subprocess
import platform
import argparse
import time
import threading
from pathlib import Path
from typing import Dict, Optional, List

# ANSI color codes for cross-platform support
class Colors:
    RESET = '\033[0m'
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    MAGENTA = '\033[95m'
    CYAN = '\033[96m'
    WHITE = '\033[97m'
    
    @classmethod
    def supports_color(cls) -> bool:
        """Check if terminal supports colors"""
        return hasattr(sys.stdout, 'isatty') and sys.stdout.isatty()

# Unicode icons (Windows console may not display all, but fallback to ASCII)
class Icons:
    ROCKET = "^"
    GEAR = "*"
    SERVER = "[=]"
    WEB = "[W]"
    ELECTRON = "[E]"
    TEST = "[T]"
    BUILD = "[B]"
    DEPLOY = "[D]"
    CLEAN = "[C]"
    EXIT = "X"
    INFO = "i"
    SUCCESS = "OK"
    ERROR = "X"
    WARNING = "!"
    START = ">"
    STOP = "_"
    RESTART = "~"
    SETTINGS = "#"
    PACKAGE = "[P]"
    CLOUD = "~"
    ERROR = "[X]"
    WARNING = "[!]"
    START = ">"
    STOP = "[_]"
    RESTART = "[R]"
    SETTINGS = "[*]"
    PACKAGE = "[PK]"
    CLOUD = "[~]"

class PredictoLauncher:
    def __init__(self):
        self.script_dir = Path(__file__).parent
        self.supports_color = True  # Enable colors for Windows
        self.venv_status = self.check_venv_status()
        
    def colorize(self, text: str, color: str) -> str:
        """Apply color to text if supported"""
        if self.supports_color:
            try:
                return f"{color}{text}{Colors.RESET}"
            except:
                return text
        return text
    
    def get_local_ip(self) -> str:
        """Get local IP address"""
        try:
            import socket
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except:
            return "127.0.0.1"
    
    def clear_screen(self):
        """Clear terminal screen"""
        os.system('cls' if platform.system() == 'Windows' else 'clear')
    
    def pause(self):
        """Wait for user input"""
        input("\n> Press Enter to continue...")
    
    def show_loading(self, message: str, duration: float = 1.0):
        """Show loading animation"""
        import time
        chars = ['|', '/', '-', '\\']
        start_time = time.time()
        
        while time.time() - start_time < duration:
            for char in chars:
                if time.time() - start_time >= duration:
                    break
                print(f"\r{char} {message}", end='', flush=True)
                time.sleep(0.1)
        print(f"\r+ {message}")
    
    def show_success(self, message: str):
        """Show success message with animation"""
        print(f"\r[OK] {message}")
    
    def show_error(self, message: str):
        """Show error message"""
        print(f"\r[X] {message}")
    
    def show_info(self, message: str):
        """Show info message"""
        print(f"[i] {message}")
    
    def show_warning(self, message: str):
        """Show warning message"""
        print(f"[!] {message}")
    
    def check_venv_status(self) -> dict:
        """Check status of Python virtual environments"""
        backend_path = self.script_dir / 'backend'
        venv_path = backend_path / 'venv'
        
        status = {
            'exists': venv_path.exists(),
            'python_path': None,
            'pip_path': None,
            'activate_cmd': None,
            'requirements_exist': False
        }
        
        if status['exists']:
            if platform.system() == 'Windows':
                status['python_path'] = venv_path / 'Scripts' / 'python.exe'
                status['pip_path'] = venv_path / 'Scripts' / 'pip.exe'
                status['activate_cmd'] = str(venv_path / 'Scripts' / 'activate')
            else:
                status['python_path'] = venv_path / 'bin' / 'python'
                status['pip_path'] = venv_path / 'bin' / 'pip'
                status['activate_cmd'] = f"source {venv_path / 'bin' / 'activate'}"
        
        # Check requirements.txt
        requirements_file = backend_path / 'requirements.txt'
        status['requirements_exist'] = requirements_file.exists()
        
        return status
    
    def get_venv_command(self, command: str) -> str:
        """Get command with proper venv activation"""
        if self.venv_status['exists'] and self.venv_status['activate_cmd']:
            return f"{self.venv_status['activate_cmd']} && {command}"
        return command
    
    def auto_setup_venv_if_needed(self):
        """Auto-setup venv if it doesn't exist"""
        if not self.venv_status['exists']:
            self.show_info("Virtual environment not found. Setting up automatically...")
            self.setup_python_env()
            self.venv_status = self.check_venv_status()
            return True
        return False
    
    def show_help(self):
        """Display help information"""
        self.clear_screen()
        help_text = f"""
{self.colorize(Icons.INFO + ' Predicto Dev Launcher - Command Line Help', Colors.MAGENTA)}
{self.colorize('=' * 50, Colors.CYAN)}

{self.colorize('USAGE:', Colors.BLUE)}
   python launcher.py                    # Start interactive menu
   python launcher.py <action>             # Run specific action
   python launcher.py --help              # Show this help

{self.colorize('AVAILABLE ACTIONS:', Colors.BLUE)}
   all           Start all services (backend, frontend, host-app)
   frontend      Start frontend in development mode
   backend       Start backend server
   host-app      Start host app (Electron)
   scheduler     Start automation scheduler
   test          Run automation tests
   build-fe      Build frontend
   build-ha      Build host app (EXE)
   deploy        Deploy frontend to Firebase
   logs          View automation logs
   clean         Clean node_modules directories
   setup         Setup Python virtual environment
   status        Show port status

{self.colorize('EXAMPLES:', Colors.BLUE)}
   python launcher.py all
   python launcher.py frontend
   python launcher.py backend

{self.colorize('INTERACTIVE MODE:', Colors.BLUE)}
   Run python launcher.py without arguments to use the interactive menu
        """
        print(help_text)
    
    def show_port_status(self):
        """Display port status"""
        print(f"""
{self.colorize(Icons.INFO + ' Port Status Monitor', Colors.MAGENTA)}
{self.colorize('─' * 40, Colors.CYAN)}

{self.colorize(Icons.SERVER + ' Backend  Port 8765: ', Colors.GREEN)}{self.colorize('Ready to use', Colors.GREEN)}
{self.colorize(Icons.WEB + ' Frontend Port 3456: ', Colors.GREEN)}{self.colorize('Ready to use', Colors.GREEN)}
{self.colorize(Icons.ELECTRON + ' Host App  Electron: ', Colors.GREEN)}{self.colorize('Ready to start', Colors.GREEN)}
        """)
    
    def start_new_console(self, title: str, working_dir: str, command: str):
        """Start a new console window with given command"""
        system = platform.system()
        
        if system == "Windows":
            # Create a batch file for Windows with proper naming
            batch_content = f"""@echo off
title Predicto - {title}
cd /d "{working_dir}"
echo.
echo ========================================
echo   Predicto - {title}
echo ========================================
echo.
echo Working Directory: %CD%
echo.
call {command}
echo.
echo ========================================
echo   {title} process ended.
echo ========================================
pause
"""
            batch_file = os.path.join(os.environ['TEMP'], f"predicto-{title.lower().replace(' ', '-')}.bat")
            with open(batch_file, 'w') as f:
                f.write(batch_content)
            
            # Try different methods to start new console (ordered by reliability)
            methods = [
                # Method 1: Run batch file directly with cmd /c (opens new console)
                lambda: subprocess.Popen(
                    f'cmd /c "{batch_file}"',
                    shell=True,
                    cwd=working_dir
                ),
                
                # Method 2: Start-Process with cmd.exe (PowerShell way)
                lambda: subprocess.Popen([
                    'powershell', '-Command', 
                    f'Start-Process cmd -ArgumentList "/k \\"{batch_file}\\""'
                ], cwd=working_dir),
                
                # Method 3: cmd /c start with cd and command
                lambda: subprocess.Popen(
                    f'cmd /c start cmd /k "cd /d {working_dir} & {command}"',
                    shell=True,
                    cwd=working_dir
                ),
                
                # Method 4: Use os.system (simplest approach)
                lambda: os.system(f'start cmd /k "{batch_file}"'),
            ]
            
            # Try methods in order until one works
            for i, method in enumerate(methods):
                try:
                    method()
                    return
                except Exception as e:
                    if i == len(methods) - 1:
                        raise Exception(f"All {len(methods)} methods failed. Last error: {e}")
            
        elif system == "Darwin":  # macOS
            script_content = f"""#!/bin/bash
cd "{working_dir}"
echo "Predicto - {title}"
echo "Working Directory: $(pwd)"
echo.
{command}
echo.
echo "Press any key to continue..."
read -n 1
"""
            script_file = os.path.join(os.environ['TEMP'], f"predicto-{title.lower().replace(' ', '-')}.sh")
            with open(script_file, 'w') as f:
                f.write(script_content)
            os.chmod(script_file, 0o755)
            
            applescript = f'''
tell application "Terminal"
    do script "{script_file}"
    set custom title of front window to "Predicto - {title}"
    activate
end tell
'''
            subprocess.Popen(['osascript', '-e', applescript])
            
        else:  # Linux
            terminal_commands = [
                ['gnome-terminal', '--title', f'Predicto - {title}', '--', 'bash', '-c', f'cd "{working_dir}" && echo "Predicto - {title}" && echo && {command}; echo && echo "Press Enter to continue..."; read'],
                ['konsole', '--title', f'Predicto - {title}', '-e', f'cd "{working_dir}" && echo "Predicto - {title}" && echo && {command}; echo && echo "Press Enter to continue..."; read'],
                ['xterm', '-title', f'Predicto - {title}', '-e', f'cd "{working_dir}" && echo "Predicto - {title}" && echo && {command}; echo && echo "Press Enter to continue..."; read']
            ]
            
            for cmd in terminal_commands:
                try:
                    subprocess.Popen(cmd)
                    break
                except FileNotFoundError:
                    continue
    
    def start_backend(self):
        """Start backend server"""
        path = self.script_dir / 'backend'
        
        # Auto-setup venv if needed
        self.auto_setup_venv_if_needed()
        
        # Use venv if available
        if self.venv_status['exists']:
            command = self.get_venv_command('set BACKEND_PORT=8765 && python server.py')
        else:
            command = 'set BACKEND_PORT=8765 && python server.py'
            
        self.start_new_console('Backend', str(path), command)
    
    def start_frontend(self):
        """Start frontend development server"""
        path = self.script_dir / 'frontend'
        self.kill_ports_before_start(3456)
        command = 'npm run dev -- --port 3456 --host 0.0.0.0'
        self.start_new_console('Frontend', str(path), command)
    
    def start_backend(self):
        """Start backend server"""
        path = self.script_dir / 'backend'
        self.kill_ports_before_start(8765)
        self.auto_setup_venv_if_needed()
        
        # Use venv if available
        if self.venv_status['exists']:
            command = 'set BACKEND_PORT=8765 && python server.py'
        else:
            command = 'set BACKEND_PORT=8765 && python server.py'
            
        self.start_new_console('Backend', str(path), command)
    
    def start_host_app(self):
        """Start Electron host app"""
        path = self.script_dir / 'host-app'
        # Use proper cmd syntax or just npm start (assuming node_modules exists)
        command = 'npm start'
        self.start_new_console('Host App', str(path), command)
    
    def start_automation_scheduler(self):
        """Start automation scheduler"""
        path = self.script_dir / 'backend'
        
        # Auto-setup venv if needed
        self.auto_setup_venv_if_needed()
        
        # Use venv if available
        if self.venv_status['exists']:
            command = self.get_venv_command('python -m automation.main scheduler start')
        else:
            command = 'python -m automation.main scheduler start'
            
        self.start_new_console('Automation', str(path), command)
    
    def start_automation_tests(self):
        """Start automation tests"""
        path = self.script_dir / 'backend'
        
        # Auto-setup venv if needed
        self.auto_setup_venv_if_needed()
        
        # Use venv if available
        if self.venv_status['exists']:
            command = self.get_venv_command('python test_with_mocks.py')
        else:
            command = 'python test_with_mocks.py'
            
        self.start_new_console('Automation Tests', str(path), command)
    
    def kill_port(self, port: int):
        """Kill process using a specific port"""
        try:
            result = subprocess.run(
                f'netstat -ano | findstr :{port}',
                shell=True,
                capture_output=True,
                text=True
            )
            if result.stdout:
                for line in result.stdout.strip().split('\n'):
                    if 'LISTENING' in line:
                        parts = line.split()
                        if len(parts) >= 5:
                            pid = parts[-1]
                            try:
                                subprocess.run(['taskkill', '/F', '/PID', pid], 
                                             capture_output=True, text=True)
                                print(f"Killed process on port {port} (PID: {pid})")
                            except:
                                pass
        except:
            pass
    
    def kill_ports_before_start(self, port: int):
        """Kill existing process on port before starting"""
        self.kill_port(port)
    
    def build_frontend(self):
        """Build frontend"""
        path = self.script_dir / 'frontend'
        subprocess.run(['npm', 'run', 'build'], cwd=path, check=True)
        print(self.colorize(f"{Icons.SUCCESS} Frontend build completed!", Colors.GREEN))
    
    def deploy_frontend(self):
        """Deploy frontend to Firebase"""
        # Build first
        self.build_frontend()
        # Deploy
        path = self.script_dir / 'backend'
        subprocess.run(['npm', 'run', 'deploy'], cwd=path, check=True)
        print(self.colorize(f"{Icons.SUCCESS} Deployment completed!", Colors.GREEN))
    
    def build_host_app(self):
        """Build host app EXE"""
        path = self.script_dir / 'host-app'
        if not (path / 'node_modules').exists():
            subprocess.run(['npm', 'install'], cwd=path, check=True)
        subprocess.run(['npm', 'run', 'build-win'], cwd=path, check=True)
        print(self.colorize(f"{Icons.SUCCESS} Host App build completed!", Colors.GREEN))
    
    def show_logs(self):
        """View automation logs"""
        log_file = self.script_dir / 'backend' / 'logs' / 'automation.log'
        if log_file.exists():
            if platform.system() == 'Windows':
                subprocess.run(['type', str(log_file)], shell=True)
            else:
                subprocess.run(['tail', '-f', str(log_file)])
        else:
            print(self.colorize(f"{Icons.WARNING} No logs found.", Colors.YELLOW))
    
    def clean_node_modules(self):
        """Clean node_modules directories"""
        targets = [
            self.script_dir / 'frontend' / 'node_modules',
            self.script_dir / 'host-app' / 'node_modules',
            self.script_dir / 'backend' / 'node_modules'
        ]
        
        for target in targets:
            if target.exists():
                import shutil
                shutil.rmtree(target)
                print(f"Removed {target}")
        
        print(self.colorize(f"{Icons.SUCCESS} Cleanup completed!", Colors.GREEN))
    
    def setup_python_env(self):
        """Setup Python virtual environment"""
        backend_path = self.script_dir / 'backend'
        venv_path = backend_path / 'venv'
        
        self.show_loading("Creating Python virtual environment...", 2.0)
        
        if not venv_path.exists():
            subprocess.run([sys.executable, '-m', 'venv', str(venv_path)], check=True)
            self.show_success("Virtual environment created!")
        else:
            self.show_info("Virtual environment already exists.")
        
        # Install dependencies
        if platform.system() == 'Windows':
            pip_path = venv_path / 'Scripts' / 'pip.exe'
        else:
            pip_path = venv_path / 'bin' / 'pip'
        
        requirements_file = backend_path / 'requirements.txt'
        if requirements_file.exists():
            self.show_loading("Installing Python dependencies...", 3.0)
            subprocess.run([str(pip_path), 'install', '-r', str(requirements_file)], check=True)
            self.show_success("Python dependencies installed!")
        else:
            self.show_warning("No requirements.txt found in backend directory.")
        
        # Update venv status
        self.venv_status = self.check_venv_status()
        self.show_success("Python environment setup completed!")
    
    def start_all(self):
        """Start all services"""
        self.show_loading("Starting ALL services...", 2.0)
        
        print(f"\n{self.colorize('🚀 Launching services:', Colors.CYAN)}")
        self.show_loading("  Backend Server...", 1.0)
        self.start_backend()
        
        self.show_loading("  Host App...", 1.0)
        self.start_host_app()
        
        self.show_loading("  Frontend Server...", 1.0)
        self.start_frontend()
        
        print(f"\n{self.colorize('✅ All services started successfully!', Colors.GREEN)}")
        print(f"\n{self.colorize('📍 Service URLs:', Colors.BLUE)}")
        print(f"  {Icons.SERVER}  Backend:  {self.colorize('http://localhost:8765', Colors.YELLOW)}")
        print(f"  {Icons.WEB}    Frontend: {self.colorize('http://localhost:3456', Colors.YELLOW)}")
        print(f"  {Icons.ELECTRON} Host App: {self.colorize('Electron window', Colors.YELLOW)}")
    
    def _start_frontend_action(self):
        self.show_loading("Starting Frontend Server...", 1.5)
        self.start_frontend()
        self.show_success("Frontend started in new window!")
    
    def _start_backend_action(self):
        self.show_loading("Starting Backend Server...", 1.5)
        self.start_backend()
        self.show_success("Backend started in new window!")
    
    def _start_host_app_action(self):
        self.show_loading("Starting Host App...", 1.5)
        self.start_host_app()
        self.show_success("Host App started in new window!")
    
    def _start_scheduler_action(self):
        self.show_loading("Starting Automation Scheduler...", 1.5)
        self.start_automation_scheduler()
        self.show_success("Scheduler started in new window!")
    
    def _start_test_action(self):
        self.show_loading("Running Automation Tests...", 1.5)
        self.start_automation_tests()
        self.show_success("Tests started in new window!")
    
    def _build_frontend_action(self):
        self.show_loading("Building Frontend...", 2.0)
        self.build_frontend()
        self.show_success("Frontend build completed!")
    
    def _build_host_app_action(self):
        self.show_loading("Building Host App EXE...", 2.0)
        self.build_host_app()
        self.show_success("Host App EXE build completed!")
    
    def _deploy_action(self):
        self.show_loading("Deploying to Firebase...", 3.0)
        self.deploy_frontend()
        self.show_success("Deployment completed successfully!")
    
    def _show_logs_action(self):
        self.show_info("Opening automation logs...")
        self.show_logs()
    
    def _clean_action(self):
        self.show_loading("Cleaning node_modules...", 2.0)
        self.clean_node_modules()
        self.show_success("Cleanup completed!")
    
    def _setup_action(self):
        self.show_loading("Setting up Python Virtual Environment...", 3.0)
        self.setup_python_env()
        self.show_success("Python environment setup completed!")

    def execute_action(self, action: str):
        """Execute a specific action"""
        actions = {
            'all': lambda: self.start_all(),
            'frontend': self._start_frontend_action,
            'backend': self._start_backend_action,
            'host-app': self._start_host_app_action,
            'scheduler': self._start_scheduler_action,
            'test': self._start_test_action,
            'build-fe': self._build_frontend_action,
            'build-ha': self._build_host_app_action,
            'deploy': self._deploy_action,
            'logs': self._show_logs_action,
            'clean': self._clean_action,
            'setup': self._setup_action,
            'status': lambda: self.show_port_status()
}
         
        if action in actions:
            actions[action]()
        else:
            print(self.colorize(f"{Icons.ERROR} Unknown action: {action}", Colors.RED))
            print(self.colorize("Use --help to see available actions.", Colors.YELLOW))
            sys.exit(1)
    
    def show_menu(self):
        """Display interactive menu"""
        self.clear_screen()
        
        # Simple ASCII header
        header = f"""
==============================================
   Predicto Dev Console - Interactive Edition
==============================================
"""
        print(header)
        
        # Get venv status text
        venv_status = "[OK]" if self.venv_status['exists'] else "[!] Not Found"
        
        # Simple status bar
        status_bar = f"""
SYSTEM STATUS:
  Backend:   [OK] Ready   Port: 8765
  Frontend: [OK] Ready   Port: 3456
  Host App: [_] Stopped  Electron
  Python:  {venv_status}
"""
        print(status_bar)
        
        # Interactive menu options
        menu_options = """
QUICK ACTIONS:
  [A] Start ALL Services
  [P] Show Status

FRONTEND:
  [1] Start Dev Server
  [2] Build Frontend  
  [3] Deploy to Firebase

BACKEND:
  [4] Start Server
  [5] Start Scheduler
  [6] Run Automation Script
  [7] View Logs
  [8] Run Tests

HOST APP:
  [9] Start Host App
  [0] Build EXE

MANAGEMENT:
  [E] Setup Python Env
  [F] Clean node_modules
  [G] Exit
"""
        print(menu_options)
        
        while True:
            try:
                choice = input("Select option: ").upper().strip()
                
                if choice == 'P':
                    self.show_port_status()
                    self.pause()
                elif choice == 'A':
                    self.start_all()
                    self.pause()
                elif choice == '1':
                    print(self.colorize(f"{Icons.WEB} Starting Frontend...", Colors.BLUE))
                    self.start_frontend()
                    self.pause()
                elif choice == 'R':
                    print(self.colorize(f"{Icons.WARNING} Restarting Frontend...", Colors.YELLOW))
                    # Stop and restart logic would go here
                    self.start_frontend()
                    self.pause()
                elif choice == '2':
                    print(self.colorize(f"{Icons.BUILD} Building Frontend...", Colors.BLUE))
                    self.build_frontend()
                    self.pause()
                elif choice == '3':
                    print(self.colorize(f"{Icons.DEPLOY} Deploying to Firebase...", Colors.BLUE))
                    self.deploy_frontend()
                    self.pause()
                elif choice == '4':
                    print(self.colorize(f"{Icons.SERVER} Starting Backend...", Colors.BLUE))
                    self.start_backend()
                    self.pause()
                elif choice == 'B':
                    print(self.colorize(f"{Icons.WARNING} Restarting Backend...", Colors.YELLOW))
                    # Stop and restart logic would go here
                    self.start_backend()
                    self.pause()
                elif choice == '5':
                    print(self.colorize(f"{Icons.GEAR} Starting Automation Scheduler...", Colors.BLUE))
                    self.start_automation_scheduler()
                    self.pause()
                elif choice == '6':
                    print(self.colorize(f"{Icons.GEAR} Running Automation Script...", Colors.BLUE))
                    path = self.script_dir / 'backend'
                    subprocess.run([sys.executable, '-m', 'automation.main', 'live-matches', '--sport', 'cricket'], cwd=path)
                    self.pause()
                elif choice == '7':
                    print(self.colorize(f"{Icons.INFO} Viewing Logs...", Colors.BLUE))
                    self.show_logs()
                    self.pause()
                elif choice == '8':
                    print(self.colorize(f"{Icons.TEST} Running Automation Tests...", Colors.BLUE))
                    self.start_automation_tests()
                    self.pause()
                elif choice == 'H':
                    print(self.colorize(f"{Icons.WARNING} Restarting Host App...", Colors.YELLOW))
                    # Stop and restart logic would go here
                    self.start_host_app()
                    self.pause()
                elif choice == '9':
                    print(self.colorize(f"{Icons.ELECTRON} Starting Host App...", Colors.BLUE))
                    self.start_host_app()
                    print(self.colorize(f"{Icons.SUCCESS} Host App started in new window!", Colors.GREEN))
                    self.pause()
                elif choice == '0':
                    print(self.colorize(f"{Icons.BUILD} Building Host App EXE...", Colors.BLUE))
                    self.build_host_app()
                    self.pause()
                elif choice == 'E':
                    print(self.colorize(f"{Icons.GEAR} Setting up Python Virtual Environment...", Colors.BLUE))
                    self.setup_python_env()
                    self.pause()
                elif choice == 'F':
                    print(self.colorize(f"{Icons.CLEAN} Cleaning node_modules...", Colors.BLUE))
                    self.clean_node_modules()
                    self.pause()
                elif choice == 'G':
                    print(self.colorize(f"{Icons.EXIT} Goodbye!", Colors.RED))
                    break
                else:
                    print(self.colorize(f"{Icons.ERROR} Invalid selection, please try again.", Colors.RED))
                    self.pause()
                    
            except KeyboardInterrupt:
                print("\n[X] Goodbye!")
                break
            except EOFError:
                break
            except Exception as e:
                print(f"[X] Error: {e}")
                break

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description='Predicto Dev Launcher - Python Edition',
        add_help=False
    )
    parser.add_argument('action', nargs='?', help='Action to execute')
    parser.add_argument('--help', '-h', action='store_true', help='Show help information')
    
    args = parser.parse_args()
    
    launcher = PredictoLauncher()
    
    if args.help:
        launcher.show_help()
        return
    
    if args.action:
        launcher.execute_action(args.action)
    else:
        launcher.show_menu()

if __name__ == '__main__':
    main()
