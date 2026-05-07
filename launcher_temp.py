def start_new_console(self, title: str, working_dir: str, command: str):
        """Start a new console window with the given command"""
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
{command}
echo.
echo ========================================
echo   {title} process ended.
echo ========================================
pause
"""
            batch_file = os.path.join(os.environ['TEMP'], f"predicto-{title.lower().replace(' ', '-')}.bat")
            with open(batch_file, 'w') as f:
                f.write(batch_content)
            
            # Start in new cmd window
            subprocess.Popen(['cmd', '/c', f'start "Predicto - {title}" cmd /k "{batch_file}"'], cwd=working_dir)
