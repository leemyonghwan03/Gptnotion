@echo off
setlocal
cd /d "%~dp0"
python -m unittest discover -s tests -p "test_*.py" || exit /b 1
python tests\mcp_smoke.py || exit /b 1
exit /b 0
