#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
./check.sh
tsc -p frontend/tsconfig.json
python tools/build_frontend.py
python tests/build_integrity.py
echo 'BUILD RESULT: PASS'
