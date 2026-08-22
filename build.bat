@echo off
setlocal EnableExtensions
cd /d "%~dp0"
call check.bat || (echo [FAIL] Build blocked because check.bat failed. & exit /b 30)
echo [BUILD] TypeScript emit
call tsc -p frontend\tsconfig.json || exit /b 31
echo [BUILD] Single HTML bundle
python tools\build_frontend.py || exit /b 32
echo [BUILD] Validate built artifact
python tests\build_integrity.py || exit /b 33
echo ============================================================
echo  BUILD RESULT: PASS
echo  Output: frontend\dist\GptNotion.html
echo ============================================================
exit /b 0
