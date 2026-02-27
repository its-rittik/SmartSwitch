@echo off
echo Stopping any existing bridge processes...
taskkill /f /im python.exe 2>nul
timeout /t 2 /nobreak >nul
echo Starting Smart Switch Bridge...
python working_bridge.py
pause