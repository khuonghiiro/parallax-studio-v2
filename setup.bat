@echo off
chcp 65001 >nul
title Parallax Studio - Cai dat thu vien
cd /d "%~dp0"
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/

echo ============================================================
echo      Parallax Studio - Cai dat moi truong va thu vien
echo ============================================================
echo.

REM 1. Kiem tra Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [LOI] Khong tim thay Node.js tren may tinh!
    echo.
    echo Vui long tai va cai dat Node.js LTS - phien ban 20 tro len tai:
    echo https://nodejs.org/
    echo.
    echo Sau khi cai xong, hay khoi dong lai Command Prompt hoac may tinh.
    echo.
    pause
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
    echo [OK] Da tim thay pnpm - uu tien pnpm de tiet kiem dung luong o dia.
) else (
    echo [THONG BAO] Khong tim thay pnpm, su dung npm mac dinh.
)
echo.

REM 3. Cai dat thu vien ung dung goc
echo [1/2] Dang cai dat thu vien ung dung chinh [%PKG_MGR% install]...
if "%PKG_MGR%"=="pnpm" (
    call pnpm install
) else (
    call npm install
)

if %errorlevel% neq 0 (
    echo.
    echo [LOI] Cai dat thu vien ung dung chinh that bai!
    echo Vui long kiem tra ket noi mang va thu lai.
    echo.
    pause
    exit /b %errorlevel%
)
echo [OK] Da cai dat xong thu vien chinh.
echo.

REM 4. Cai dat thu vien MCP Server
echo [2/2] Dang cai dat thu vien cho MCP Server [mcp-server]...
if "%PKG_MGR%"=="pnpm" (
    call pnpm --prefix mcp-server install
) else (
    call npm --prefix mcp-server install
)

if %errorlevel% neq 0 (
    echo.
    echo [LOI] Cai dat thu vien MCP Server that bai!
    echo.
    pause
    exit /b %errorlevel%
)
echo [OK] Da cai dat xong thu vien MCP Server.
echo.

REM 5. Kiem tra ho tro FFmpeg cho chuc nang xuat video
set FFMPEG_FOUND=0
if exist "%~dp0bin\ffmpeg.exe" set FFMPEG_FOUND=1
if exist "%~dp0node_modules\ffmpeg-static\ffmpeg.exe" set FFMPEG_FOUND=1
where ffmpeg >nul 2>nul
if %errorlevel% equ 0 set FFMPEG_FOUND=1

if "%FFMPEG_FOUND%"=="0" (
    echo [LUU Y VE XUAT VIDEO MP4]
    echo He thong chua tim thay ffmpeg.exe.
    echo Neu mang noi bo chan tai tu dong, ban chi can tai file ffmpeg.exe
    echo va copy vao thu muc "bin\" trong thu muc du an.
    echo.
)

echo ============================================================
echo   CAI DAT HOAN TAT THANH CONG!
echo   Bay gio ban co the chay "start.bat" de mo ung dung.
echo ============================================================
echo.

if "%~1"=="--no-pause" goto :done
pause
:done
