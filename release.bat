@echo off
setlocal EnableExtensions
cd /d "%~dp0"
call verify-all.bat || exit /b 1
echo RELEASE RESULT: PASS
exit /b 0
