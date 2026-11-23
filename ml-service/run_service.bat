@echo off
title Punjab E-Commerce ML & Market Intelligence Service
echo Starting Punjab ML & Market Intelligence Service on port 8000...
cd /d "%~dp0"
..\.venv\Scripts\uvicorn.exe main:app --host 127.0.0.1 --port 8000 --reload
pause
