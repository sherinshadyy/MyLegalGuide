# Start RAG API + LegalGuide web server (two windows)
$ErrorActionPreference = "Stop"
$RagDir = Join-Path (Split-Path $PSScriptRoot -Parent) "Final_grad_project"
$FrontDir = $PSScriptRoot

Start-Process powershell -ArgumentList "-NoExit", "-File", (Join-Path $RagDir "start-rag.ps1")
Write-Host "Waiting for RAG API to start (up to 3 min on first run)..."
$ready = $false
for ($i = 0; $i -lt 36; $i++) {
  try {
    $h = Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -TimeoutSec 3
    if ($h.ok) { $ready = $true; break }
  } catch { }
  Start-Sleep -Seconds 5
}
if (-not $ready) { Write-Host "RAG API not ready yet — open chat after you see 'ML models ready' in the RAG window." }
Start-Sleep -Seconds 2
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$FrontDir'; npm start"

Write-Host "Started RAG API (port 8000) and web app (port 3000). Open http://localhost:3000"
