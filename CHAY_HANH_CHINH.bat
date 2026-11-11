@echo off
chcp 65001 >nul
title He Thong Hanh Chinh (Port 3001)
color 0A
echo ========================================================
echo   HE THONG QUAN LY HANH CHINH (PORT 3001)
echo ========================================================
echo.

:: 1. Kiem tra va khoi dong Database Postgres neu chua chay
netstat -ano | findstr :5432 | findstr LISTENING >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [Database] Dang khoi dong PostgreSQL tren port 5432...
    subst K: /d >nul 2>&1
    subst K: "D:\DanhGiaKPI" >nul 2>&1
    start "PostgreSQL Database" /min node K:\apps\backend\start-db.js
    timeout /t 3 /nobreak >nul
) else (
    echo [Database] PostgreSQL dang chay san tren port 5432.
)

:: 2. Khoi dong Next.js
cd /d "D:\HanhChinh"
echo [Web] Dang khoi dong E-Office tren port 3001...
start "Hanh Chinh (Port 3001)" cmd /k "npm run dev"

timeout /t 5 /nobreak >nul
start http://localhost:3001
echo Da mo http://localhost:3001
