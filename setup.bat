@echo off
chcp 65001 >nul
title Parallax Studio - Cai dat thu vien
cd /d "%~dp0"
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set FFMPEG_BINARIES_URL=https://registry.npmmirror.com/-/binary/ffmpeg-static
set "PATH=%USERPROFILE%\.local\bin;%APPDATA%\npm;%ProgramFiles%\nodejs;%PATH%"

echo ============================================================
echo      Parallax Studio - Cai dat moi truong va thu vien
echo ============================================================
echo.

REM 1. Kiem tra Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [LOI] Khong tim thay Node.js tren may tinh!
    echo.
    echo Vui long tai va cai dat Node.js LTS - phien ban 22 tro len tai:
    echo https://nodejs.org/
    echo.
    echo Sau khi cai xong, hay khoi dong lai Command Prompt hoac may tinh.
    echo.
    if not "%~1"=="--no-pause" pause
    exit /b 1
)

echo [OK] Da tim thay Node.js:
node -v
echo.

REM 2. Phat hien goi quan ly thu vien (pnpm hoac npm)
set PKG_MGR=npm
where pnpm >nul 2>nul
if %errorlevel% equ 0 (
    set PKG_MGR=pnpm
) else if exist "%USERPROFILE%\.local\bin\pnpm.exe" (
    set PKG_MGR=pnpm
)

if "%PKG_MGR%"=="pnpm" (
    echo [OK] Da tim thay pnpm - uu tien pnpm de tiet kiem dung luong o dia.
) else (
    echo [THONG BAO] Khong tim thay pnpm, su dung npm mac dinh.
)
echo.

REM 3. Cai dat thu vien ung dung goc (pnpm workspace cai luon ca mcp-server)
echo [1/3] Dang cai dat thu vien ung dung chinh [%PKG_MGR% install]...
call :install_deps
if %errorlevel% equ 0 goto :deps_ok

REM 3b. Tu dong sua loi: node_modules hong do lan cai truoc bi ngat giua chung
REM     (VD: ENOENT ... node_modules\.pnpm\...\package.json) -> xoa sach va cai lai co --force
echo.
echo [SUA LOI] Cai dat that bai - co the do node_modules bi hong tu lan cai truoc.
echo           Dang xoa node_modules va cai dat lai tu dau...
call :clean_node_modules
call :install_deps --force
if %errorlevel% neq 0 (
    echo.
    echo [LOI] Cai dat thu vien ung dung chinh that bai!
    echo  - Kiem tra ket noi mang / proxy roi chay lai setup.bat.
    echo  - Dong het cua so Parallax Studio / Electron dang mo truoc khi cai.
    echo  - Neu van loi: xoa thu muc node_modules thu cong roi chay lai.
    echo.
    if not "%~1"=="--no-pause" pause
    exit /b 1
)

:deps_ok
call :verify_bins
if %errorlevel% neq 0 (
    echo.
    echo [LOI] Thieu cong cu electron-vite trong node_modules\.bin sau khi cai dat!
    echo       Hay xoa thu muc node_modules roi chay lai setup.bat.
    echo.
    if not "%~1"=="--no-pause" pause
    exit /b 1
)
echo [OK] Da cai dat xong thu vien chinh.
echo.

REM 3c. Tai truoc binary Electron (Electron 44 tai lazy o lan chay dau - tai ngay de bao loi som, dung ELECTRON_MIRROR)
echo [1/3] Dang kiem tra binary Electron...
node "%~dp0node_modules\electron\install.js"
if errorlevel 1 (
    echo.
    echo [LOI] Khong tai duoc binary Electron! Kiem tra mang / proxy roi chay lai setup.bat.
    echo.
    if not "%~1"=="--no-pause" pause
    exit /b 1
)
echo [OK] Binary Electron san sang.
echo.

REM 4. Cai dat thu vien MCP Server (npm khong co workspace nen cai rieng)
echo [2/3] Dang kiem tra thu vien cho MCP Server [mcp-server]...
if "%PKG_MGR%"=="npm" (
    call npm --prefix mcp-server install
    if errorlevel 1 (
        echo [CANH BAO] Cai dat thu vien MCP Server that bai - ung dung van chay duoc, chi thieu MCP.
    )
)
echo [OK] Thu vien MCP Server san sang.
echo.

REM 5. FFmpeg cho chuc nang xuat video (tuy chon, KHONG lam hong cai dat)
echo [3/3] Dang kiem tra FFmpeg cho chuc nang xuat video MP4...
node "%~dp0scripts\ensure-ffmpeg.mjs"
echo.

echo ============================================================
echo   CAI DAT HOAN TAT THANH CONG!
echo   Bay gio ban co the chay "start.bat" de mo ung dung.
echo ============================================================
echo.

if "%~1"=="--no-pause" exit /b 0
pause
exit /b 0

REM ------------------------------------------------------------
REM Ham con
REM ------------------------------------------------------------
:install_deps
if "%PKG_MGR%"=="pnpm" (
    call pnpm install %~1
) else (
    call npm install %~1
)
exit /b %errorlevel%

:clean_node_modules
if exist "%~dp0node_modules\" rmdir /s /q "%~dp0node_modules"
if exist "%~dp0mcp-server\node_modules\" rmdir /s /q "%~dp0mcp-server\node_modules"
exit /b 0

:verify_bins
if exist "%~dp0node_modules\.bin\electron-vite.cmd" exit /b 0
exit /b 1
