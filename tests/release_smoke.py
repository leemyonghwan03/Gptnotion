from __future__ import annotations
import json, sys, zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
version=json.loads((ROOT/'VERSION.json').read_text(encoding='utf-8'))['appVersion']
folder=ROOT/'release'/f'GptNotion_{version}'
zpath=ROOT/'release'/f'GptNotion_{version}.zip'
required=[folder/'GptNotion.html',folder/'MCP'/'main.py',folder/'MCP'/'gptnotion_mcp'/'compat_runtime.py',folder/'start.bat',folder/'VERSION.json']
missing=[str(p) for p in required if not p.exists()]
if missing: print('Release missing:',missing);sys.exit(2)
if not zpath.exists(): print('Release zip missing');sys.exit(3)
with zipfile.ZipFile(zpath) as z:
    names=set(z.namelist())
    if not any(n.endswith('/GptNotion.html') for n in names): raise SystemExit('ZIP lacks GptNotion.html')
print(f'Release smoke: PASS ({zpath.stat().st_size:,} bytes)')
