@echo off
chcp 65001 >nul
title Day code len GitHub
color 0A
echo ========================================================
echo   DANG DONG BO VA DAY TOAN BO CODE LEN GITHUB
echo ========================================================
echo.
cd /d "%~dp0"

echo [1/3] Them tat ca thay doi vao Git...
git add -A

echo [2/3] Commit cac cap nhat moi nhat...
git commit -m "feat(admin): toi uu hoa 4 vai tro, 4 chuc danh va dong nhat menu Phan quyen nguoi dung"

echo [3/3] Day code len remote repository...
git push -u origin main
echo.
if %ERRORLEVEL% equ 0 (
    echo ========================================================
    echo   THANH CONG! TOAN BO CODE DA DUOC LUU VA CO TREN GITHUB!
    echo ========================================================
) else (
    echo [Loi] Chua day duoc code len GitHub. Vui long kiem tra lai ket noi hoac dang nhap.
)
echo.
pause
