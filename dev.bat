@echo off
set "ROOT=C:\Users\EDRICK\Desktop\instructai"
set "WT_EXE=%LOCALAPPDATA%\Microsoft\WindowsApps\wt.exe"

:: 1. Open VS Code Maximized
start /B "" code "%ROOT%"

:: 2. Launch Windows Terminal with 2 tabs:
::    - Tab 1: Python (left pane) and Frontend (right pane) split
::    - Tab 2: Claude Code CLI
start "" "%WT_EXE%" ^
  -p "Command Prompt" -d "%ROOT%\backend" cmd /k "php artisan serve" ; ^
  sp -V -p "Command Prompt" -d "%ROOT%\frontend" cmd /k "npm run dev" ; ^
  sp -V -p "Command Prompt" -d "%ROOT%\instruct-ai-service" cmd /k "venv\Scripts\activate && python main.py" ; ^
  new-tab -p "Command Prompt" -d "%ROOT%" cmd /k "claude"

:: 3. Immediate Exit
exit
