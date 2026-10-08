@echo off
REM Don dep assets\manifest.json sau khi xoa tai nguyen trong thu muc assets\
REM Tham so tuy chon: --dry-run (chi xem truoc), --keep-empty (giu danh muc rong), --add-new (them file moi)
chcp 65001 >nul
setlocal
cd /d "%~dp0.."
where node >nul 2>nul
if errorlevel 1 (
  echo [prune] Khong tim thay Node.js trong PATH. Hay cai Node.js truoc.
  pause
  exit /b 1
)
node "scripts\prune-assets-manifest.mjs" %*
set EXITCODE=%ERRORLEVEL%
echo.
pause
exit /b %EXITCODE%
