from __future__ import annotations
import json, shutil, zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
version=json.loads((ROOT/'VERSION.json').read_text(encoding='utf-8'))
app_version=version['appVersion'].replace('/','-')
release_root=ROOT/'release'
package=release_root/f'GptNotion_{app_version}'
if package.exists(): shutil.rmtree(package)
package.mkdir(parents=True)
frontend=ROOT/'frontend'/'dist'/'GptNotion.html'
if not frontend.exists(): raise SystemExit('Build frontend first')
shutil.copy2(frontend,package/'GptNotion.html')
shutil.copy2(ROOT/'VERSION.json',package/'VERSION.json')
# MCP source distribution: modular package + thin launcher. No pip/npm dependency is required at runtime.
mcp_out=package/'MCP'; mcp_out.mkdir()
shutil.copy2(ROOT/'mcp'/'main.py',mcp_out/'main.py')
shutil.copytree(ROOT/'mcp'/'gptnotion_mcp',mcp_out/'gptnotion_mcp',ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
(package/'start_mcp.bat').write_text(r'''@echo off
setlocal
cd /d "%~dp0MCP"
where python >nul 2>nul || (echo Python not found. & pause & exit /b 1)
python main.py
''',encoding='utf-8')
(package/'start.bat').write_text(r'''@echo off
setlocal
cd /d "%~dp0"
start "GptNotion MCP" /min cmd /c call "%CD%\start_mcp.bat"
set "MCP_READY="
for /L %%I in (1,1,30) do (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:37841/health' -TimeoutSec 1; if($r.StatusCode -eq 200){exit 0}else{exit 1} } catch { exit 1 }" >nul 2>nul
  if not errorlevel 1 (
    set "MCP_READY=1"
    goto :mcp_ready
  )
  timeout /t 1 /nobreak >nul
)
echo GptNotion MCP health check failed. Check start_mcp.bat output.
pause
exit /b 1
:mcp_ready
start "" "%CD%\GptNotion.html"
''',encoding='utf-8')
(package/'README.txt').write_text(
    'GptNotion Modular Release\n'
    f'Frontend: {version["appVersion"]}\nMCP: {version["mcpVersion"]}\nRAG: {version["ragVersion"]}\n\n'
    '1) start.bat 실행: MCP를 시작하고 GptNotion.html을 엽니다.\n'
    '2) MCP만 실행하려면 start_mcp.bat을 사용합니다.\n'
    '3) 인터넷/CDN 의존성 없이 로컬 실행을 목표로 빌드되었습니다.\n',encoding='utf-8')
zip_path=release_root/f'GptNotion_{app_version}.zip'
if zip_path.exists(): zip_path.unlink()
with zipfile.ZipFile(zip_path,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    for p in package.rglob('*'):
        if p.is_file(): z.write(p,p.relative_to(release_root))
print(f'Release package: {package}')
print(f'Release zip: {zip_path} ({zip_path.stat().st_size:,} bytes)')
