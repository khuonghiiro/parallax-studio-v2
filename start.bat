@echo off
chcp 65001 >nul
title Parallax Studio
cd /d "%~dp0"

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

REM 2. Tu dong kiem tra va cai dat neu chua co node_modules
if not exist "%~dp0node_modules\" (
    echo [THONG BAO] Phat hien chua cai dat thu vien ung dung.
    echo Dang tu dong tien hanh cai dat lan dau...
    echo.
    call "%~dp0setup.bat" --no-pause
    if %errorlevel% neq 0 (
        echo [LOI] Cai dat tu dong that bai!
        pause
        exit /b 1
    )
    echo.
)

if not exist "%~dp0mcp-server\node_modules\" (
    echo [THONG BAO] Dang cai dat bo sung thu vien MCP Server...
    call npm run mcp:install
    echo.
)

REM 3. Khoi chay ung dung
echo Dang khoi dong Parallax Studio...
echo [Nhan Ctrl+C trong cua so nay neu muon dung ung dung]
echo.

call npm run dev
if %errorlevel% neq 0 (
    echo.
    echo [LOI] Ung dung da dung voi ma loi %errorlevel%.
    pause
)
