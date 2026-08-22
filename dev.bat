@echo off
setlocal
cd /d "%~dp0"
call build.bat || exit /b 1
start "GptNotion" "%CD%\frontend\dist\GptNotion.html"
