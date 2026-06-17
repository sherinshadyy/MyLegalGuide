# Start the legal RAG API (port 8000)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
        }
    }
}

if (-not $env:GROQ_API_KEY) {
    Write-Host "WARNING: GROQ_API_KEY is not set. Create .env from .env.example"
}

# Avoid HF xet downloads stalling on Windows (use standard HTTP instead)
$env:HF_HUB_ENABLE_HF_TRANSFER = "0"

& ".\venv\Scripts\python.exe" rag_api.py
