from __future__ import annotations
import json, re, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
p=ROOT/'frontend'/'dist'/'GptNotion.html'
if not p.exists(): print('Built HTML missing');sys.exit(2)
s=p.read_text(encoding='utf-8')
app_version=json.loads((ROOT/'VERSION.json').read_text(encoding='utf-8'))['appVersion']
checks={
    'single HTML TS marker':'GptNotion TypeScript Modular Bundle '+app_version,
    'legacy bridge':'window.__GPT_LEGACY__',
    'public modular api':'GptNotionModular',
    'PageStore':'const PageStore',
    'BlockStore':'const BlockStore',
    'RAG Library':'const RagLibraryStore',
    'FAST PATH':'RAG V2.4 · 100K FAST PATH',
    'app build meta':'gptnotion-build',
}
missing=[name for name,needle in checks.items() if needle not in s]
if missing: print('Build missing signatures:',', '.join(missing));sys.exit(3)
if re.search(r'<script[^>]+src\s*=',s,re.I): print('External script found');sys.exit(4)
if re.search(r'<link[^>]+rel=["\']stylesheet["\']',s,re.I): print('External stylesheet found');sys.exit(5)
if '<!--GPTNOTION_STYLE-->' in s or '<!--GPTNOTION_SCRIPTS-->' in s:
    print('Unresolved build placeholder');sys.exit(6)
print(f'Build integrity: PASS ({p.stat().st_size:,} bytes)')
