@echo off
setlocal EnableExtensions
cd /d "%~dp0"
call build.bat || exit /b 1
echo [VERIFY] Browser runtime smoke
python tests\browser_smoke.py || exit /b 41
echo [VERIFY] MCP HTTP smoke
python tests\mcp_http_smoke.py || exit /b 42
echo [VERIFY] 100K RAG smoke / performance
python tests\rag_100k_smoke.py || exit /b 43
echo [VERIFY] Release package
python tools\build_release.py || exit /b 44
python tests\release_smoke.py || exit /b 45
echo ============================================================
echo  VERIFY-ALL RESULT: PASS
echo ============================================================
exit /b 0
