# DayApp installer - Windows. No security dialogs.
#
#   irm https://getdayapp.vercel.app/install.ps1 | iex
#
# Installs the Windows dev build (the rolling windows-dev prerelease). It
# tracks the dev channel until Windows joins the versioned release channel,
# then the URL below switches to releases/latest.
# The file downloads with curl.exe, which stamps no Mark-of-the-Web on the
# download, so the installer runs without a zone warning. A failed or
# interrupted run keeps its .part file; re-running the installer resumes
# from where it stopped.
# Your tasks live in %APPDATA% and are never touched by this script.
# ASCII only: PowerShell 5.1 decodes a served script without a charset as
# ANSI, so any non-ASCII byte would arrive garbled.

$ErrorActionPreference = 'Stop'

function Install-DayApp {
  if ($env:OS -ne 'Windows_NT') {
    Write-Host "!! this installer is for Windows. On macOS/Linux run:" -ForegroundColor Red
    Write-Host "   curl -fsSL https://getdayapp.vercel.app/install.sh | sh"
    return
  }

  Write-Host ">> resolving the latest Windows build"
  try {
    $rel = Invoke-RestMethod 'https://api.github.com/repos/faraz-35/dayapp/releases/tags/windows-dev'
  } catch {
    Write-Host "!! could not reach github - $($_.Exception.Message)" -ForegroundColor Red
    return
  }
  $asset = $rel.assets | Where-Object { $_.name -like 'DayApp_*-setup.exe' } | Select-Object -First 1
  if (-not $asset) {
    Write-Host "!! no Windows build found - is the windows-dev release up?" -ForegroundColor Red
    return
  }

  # A running DayApp holds the old exe; ask it to close, then force.
  $proc = Get-Process -Name 'DayApp' -ErrorAction SilentlyContinue
  if ($proc) {
    Write-Host ">> closing the running DayApp"
    $proc | ForEach-Object { $null = $_.CloseMainWindow() }
    Start-Sleep -Seconds 2
    $proc | Stop-Process -Force -ErrorAction SilentlyContinue
  }

  Write-Host ">> downloading $($asset.name)"
  $part = Join-Path $env:TEMP 'DayApp-setup.exe.part'
  curl.exe -fL --http1.1 --retry 5 --retry-all-errors -C - `
    --speed-limit 10240 --speed-time 30 --progress-bar -o $part $asset.browser_download_url
  if ($LASTEXITCODE -ne 0) {
    Write-Host "!! download failed - run this installer again, it resumes from where it stopped" -ForegroundColor Red
    return
  }
  $exe = $part -replace '\.part$', ''
  Move-Item $part $exe -Force

  Write-Host ">> installing (per-user, no admin prompt)"
  Start-Process -FilePath $exe -ArgumentList '/S' -Wait
  Remove-Item $exe -ErrorAction SilentlyContinue

  Write-Host ">> done - DayApp is in your Start menu."
}

Install-DayApp
