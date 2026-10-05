@echo off
chcp 65001 >nul
title Parallax Studio - Build Production
cd /d "%~dp0"

echo ============================================================
echo      Parallax Studio - Build Production Bundle
echo ============================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [LOI] Khong tim thay Node.js!
    pause
    exit /b 1
)

set PKG_MGR=npm
where pnpm >nul 2>nul
if %errorlevel% equ 0 set PKG_MGR=pnpm

if not exist "%~dp0node_modules\" (
    echo [THONG BAO] Dang cai dat thu vien truoc khi build...
    call "%~dp0setup.bat" --no-pause
)

echo Dang build ung dung [%PKG_MGR% run build]...
call %PKG_MGR% run build
if %errorlevel% neq 0 (
    echo.
    echo [LOI] Qua trinh build that bai!
    pause
    exit /b %errorlevel%
)

echo.
echo ============================================================
echo   BUILD THANH CONG! File dau ra nam trong thu muc: out/
echo ============================================================
echo.
pause
