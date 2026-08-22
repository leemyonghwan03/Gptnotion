#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
python tools/forbidden_scan.py
tsc -p frontend/tsconfig.json --noEmit
python tools/check_contracts.py
python tools/check_legacy_js.py
python -m compileall -q mcp
python -m unittest discover -s tests -p 'test_*.py'
python tests/mcp_smoke.py
python tests/source_integrity.py
echo 'CHECK RESULT: PASS'
