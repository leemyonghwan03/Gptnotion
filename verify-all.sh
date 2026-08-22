#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
./build.sh
python tests/browser_smoke.py
python tests/browser_reliability_smoke.py
python tests/mcp_http_smoke.py
python tests/rag_100k_smoke.py
python tools/build_release.py
python tests/release_smoke.py
echo 'VERIFY-ALL RESULT: PASS'
