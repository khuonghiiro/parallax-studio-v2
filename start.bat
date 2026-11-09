@echo off
chcp 65001 >nul
title Parallax Studio
cd /d "%~dp0"
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set FFMPEG_BINARIES_URL=https://registry.npmmirror.com/-/binary/ffmpeg-static

REM Bo sung cac duong dan chua binary vao PATH (dam bao chay tot ca khi mo tu Windows Explorer)
set "PATH=%USERPROFILE%\.local\bin;%APPDATA%\npm;%ProgramFiles%\nodejs;%PATH%"

echo ============================================================
echo      Parallax Studio - Khoi dong ung dung
echo ============================================================
echo.

REM 1. Kiem tra Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [LOI] Khong tim thay Node.js tren may tinh!
    echo Vui long tai va cai dat Node.js LTS tai: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM 2. Phat hien goi quan ly thu vien (pnpm hoac npm)
set PKG_MGR=npm
where pnpm >nul 2>nul
if %errorlevel% equ 0 (
    set PKG_MGR=pnpm
) else if exist "%USERPROFILE%\.local\bin\pnpm.exe" (
    set PKG_MGR=pnpm
)

echo [Goi quan ly]: %PKG_MGR%
echo.

REM 3. Tu dong cai dat khi chua co node_modules HOAC node_modules cai do dang / bi hong.
REM    Chi kiem tra thu muc node_modules la chua du: lan cai truoc that bai giua chung se de lai
REM    node_modules thieu .bin\electron-vite -> loi "'electron-vite' is not recognized".
set NEED_SETUP=0
if not exist "%~dp0node_modules\" set NEED_SETUP=1
if not exist "%~dp0node_modules\.bin\electron-vite.cmd" set NEED_SETUP=1
if "%NEED_SETUP%"=="1" (
    echo [THONG BAO] Thu vien ung dung chua cai dat hoac cai dat chua hoan tat.
    echo Dang tu dong tien hanh cai dat...
    echo.
    call "%~dp0setup.bat" --no-pause
)
if not exist "%~dp0node_modules\.bin\electron-vite.cmd" (
    echo [LOI] Cai dat tu dong that bai - thieu node_modules\.bin\electron-vite!
    echo Hay chay setup.bat de xem chi tiet loi.
    echo Nhan phim bat ky de thoat...
    pause >nul
    exit /b 1
)

if not exist "%~dp0mcp-server\node_modules\" (
    echo [THONG BAO] Dang cai dat bo sung thu vien MCP Server...
    if "%PKG_MGR%"=="pnpm" (
        call pnpm install
    ) else (
        call npm run mcp:install
    )
    echo.
)

REM 4. Kiem tra va don dep tien trinh cu chay ngam neu co (tranh loi single-instance lock)
tasklist /fi "imagename eq electron.exe" 2>nul | find /i "electron.exe" >nul
if %errorlevel% equ 0 (
    echo [THONG BAO] Phat hien tien trinh Electron cu dang chay ngam.
    echo Dang lam sach de mo cua so ung dung moi...
    taskkill /f /im electron.exe >nul 2>nul
    timeout /t 1 /nobreak >nul
)

REM 5. Khoi chay ung dung
echo Dang khoi dong Parallax Studio (%PKG_MGR%)...
echo [Nhan Ctrl+C trong cua so nay neu muon dung ung dung]
echo.

call %PKG_MGR% run dev
set DEV_EXIT_CODE=%errorlevel%

echo.
echo ============================================================
if %DEV_EXIT_CODE% neq 0 (
    echo [LOI] Ung dung da dung voi ma loi %DEV_EXIT_CODE%.
) else (
    echo [THONG BAO] Ung dung da dong.
)
echo ============================================================
echo Nhan phim bat ky de thoat...
pause >nul
