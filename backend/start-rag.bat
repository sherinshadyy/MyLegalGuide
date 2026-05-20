@echo off
title Legal RAG API (port 8000)
cd /d "%~dp0"
echo Starting RAG API on http://127.0.0.1:8000
echo First run: wait 1-3 minutes while models download.
echo Keep this window open.
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0start-rag.ps1"
pause
