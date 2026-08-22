#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
./build.sh
python tests/browser_smoke.py
python tests/browser_reliability_smoke.py
python tests/browser_unified_agent_smoke.py
python tests/browser_human_conversation_smoke.py
python tests/human_conversation_benchmark.py
python tests/browser_large_rag_smoke.py
python tests/stability_tools_smoke.py
python tests/sqlite_query_plan_smoke.py
python tests/mcp_restart_recovery_smoke.py
python tests/rag_quality_smoke.py
GPTNOTION_SOAK_SECONDS=5 python tests/soak_stability.py
python tests/mcp_http_smoke.py
python tests/rag_100k_smoke.py
python tools/build_release.py
python tests/release_smoke.py
echo 'VERIFY-ALL RESULT: PASS'
