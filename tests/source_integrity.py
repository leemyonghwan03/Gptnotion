from __future__ import annotations
import json, re, hashlib, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
base_html=ROOT/'baseline'/'GptNotion_RAGV2_4_FastPath.html'
base_py=ROOT/'baseline'/'gptnotion_local_mcp_v6_8_RAGV2_4_FastPath.py'
compat=ROOT/'mcp'/'gptnotion_mcp'/'compat_runtime.py'
for p in (base_html,base_py,compat):
    if not p.exists(): print('Missing:',p);sys.exit(2)
if hashlib.sha256(base_py.read_bytes()).digest()!=hashlib.sha256(compat.read_bytes()).digest():
    print('compat_runtime.py differs from frozen MCP baseline');sys.exit(3)
html=base_html.read_text(encoding='utf-8')
orig_scripts=[m.group(1) for m in re.finditer(r'<script[^>]*>(.*?)</script>',html,re.I|re.S)]
manifest=json.loads((ROOT/'frontend'/'src'/'legacy'/'manifest.json').read_text(encoding='utf-8'))
rebuilt=[]
leg=ROOT/'frontend'/'src'/'legacy'
for group in manifest['groups']:
    rebuilt.append(''.join((leg/name).read_text(encoding='utf-8') for name in group['files']))
if orig_scripts!=rebuilt:
    print(f'Legacy script reconstruction differs: original={len(orig_scripts)} rebuilt={len(rebuilt)}');sys.exit(4)
if 'RAG V2.4 · 100K FAST PATH' not in html or 'const PageStore' not in html or 'const BlockStore' not in html:
    print('Baseline feature signatures missing');sys.exit(5)
print('Source integrity: PASS')
