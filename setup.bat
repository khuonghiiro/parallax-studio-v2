@echo off
chcp 65001 >nul
title Parallax Studio - Cai dat thu vien
cd /d "%~dp0"

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

REM 2. Cai dat thu vien ung dung goc
echo [1/2] Dang cai dat thu vien ung dung chinh [npm install]...
call npm install
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

REM 3. Cai dat thu vien MCP Server
echo [2/2] Dang cai dat thu vien cho MCP Server [mcp-server]...
call npm run mcp:install
if %errorlevel% neq 0 (
    echo.
    echo [LOI] Cai dat thu vien MCP Server that bai!
    echo.
    pause
    exit /b %errorlevel%
)
echo [OK] Da cai dat xong thu vien MCP Server.
echo.

echo ============================================================
echo   CAI DAT HOAN TAT THANH CONG!
echo   Bay gio ban co the chay "start.bat" de mo ung dung.
echo ============================================================
echo.

if "%~1"=="--no-pause" goto :done
pause
:done
