# One-time setup: Python venv + dependencies
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$Py = "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe"

if (-not (Test-Path $Py)) {
    Write-Host "Python 3.12 not found. Install with: winget install Python.Python.3.12"
    exit 1
}

Set-Location $Root
if (-not (Test-Path "venv\Scripts\python.exe")) {
    & $Py -m venv venv
}
& ".\venv\Scripts\python.exe" -m pip install --upgrade pip
& ".\venv\Scripts\pip.exe" install -r requirements.txt
Write-Host "Python setup complete. Add GROQ_API_KEY to .env then run start-rag.ps1"
