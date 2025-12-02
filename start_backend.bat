@echo off
echo Starting Fitness Game Backend Server...
echo.
echo Using Python 3.12...
echo.
"C:\Users\raiya\AppData\Local\Programs\Python\Python312\python.exe" -m uvicorn Fitness.server:app --host 0.0.0.0 --port 8000 --reload
pause
