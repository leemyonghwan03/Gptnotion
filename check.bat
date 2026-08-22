@echo off
setlocal EnableExtensions
cd /d "%~dp0"
echo ============================================================
echo  GptNotion CHECK - Compiler First / No Bypass
echo ============================================================
where python >nul 2>nul || (echo [FAIL] Python not found & exit /b 10)
where node >nul 2>nul || (echo [FAIL] Node.js not found & exit /b 11)
where tsc >nul 2>nul || (echo [FAIL] TypeScript compiler ^(tsc^) not found & exit /b 12)

echo [1/8] Forbidden bypass scan
python tools\forbidden_scan.py || exit /b 21

echo [2/8] TypeScript strict compile
call tsc -p frontend\tsconfig.json --noEmit || exit /b 22

echo [3/8] Contract JSON validation
python tools\check_contracts.py || exit /b 23

echo [4/8] Legacy compatibility JS syntax
python tools\check_legacy_js.py || exit /b 24

echo [5/8] Python MCP compile
python -m compileall -q mcp || exit /b 25

echo [6/8] Unit and contract tests
python -m unittest discover -s tests -p "test_*.py" || exit /b 26

echo [7/8] MCP modular smoke
python tests\mcp_smoke.py || exit /b 27

echo [8/8] Source integrity
python tests\source_integrity.py || exit /b 28

echo ============================================================
echo  CHECK RESULT: PASS
echo ============================================================
exit /b 0
