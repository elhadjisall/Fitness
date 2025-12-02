@echo off
echo Starting Fitness Game Frontend Server...
echo.
echo The game will be available at:
echo http://localhost:8001/index.html
echo.
echo Press Ctrl+C to stop the server
echo.
cd /d "c:\Users\raiya\Desktop\Fit Ninjas\Fitness"
python -m http.server 8001
pause
