@echo off
setlocal EnableExtensions
cd /d "%~dp0"
call build.bat || exit /b 1
echo [VERIFY] Browser runtime smoke
python tests\browser_smoke.py || exit /b 41
echo [VERIFY] Browser reliability
python tests\browser_reliability_smoke.py || exit /b 42
echo [VERIFY] Unified AI Agent
python tests\browser_unified_agent_smoke.py || exit /b 43
echo [VERIFY] Human conversation tuning
python tests\browser_human_conversation_smoke.py || exit /b 44
python tests\human_conversation_benchmark.py || exit /b 45
echo [VERIFY] Browser large RAG lazy/LRU
python tests\browser_large_rag_smoke.py || exit /b 46
echo [VERIFY] Stability tools
python tests\stability_tools_smoke.py || exit /b 47
echo [VERIFY] SQLite query plans
python tests\sqlite_query_plan_smoke.py || exit /b 48
echo [VERIFY] MCP restart recovery
python tests\mcp_restart_recovery_smoke.py || exit /b 49
echo [VERIFY] RAG quality
python tests\rag_quality_smoke.py || exit /b 50
echo [VERIFY] Quick soak
set "GPTNOTION_SOAK_SECONDS=5"
python tests\soak_stability.py || exit /b 51
echo [VERIFY] MCP HTTP smoke
python tests\mcp_http_smoke.py || exit /b 52
echo [VERIFY] 100K RAG smoke / performance
python tests\rag_100k_smoke.py || exit /b 53
echo [VERIFY] Release package
python tools\build_release.py || exit /b 54
python tests\release_smoke.py || exit /b 55
echo ============================================================
echo  VERIFY-ALL RESULT: PASS
echo ============================================================
exit /b 0
