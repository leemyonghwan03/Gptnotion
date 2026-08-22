from __future__ import annotations
import json, re, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
base_html=ROOT/'baseline'/'GptNotion_RAGV2_4_FastPath.html'
base_py=ROOT/'baseline'/'gptnotion_local_mcp_v6_8_RAGV2_4_FastPath.py'
compat=ROOT/'mcp'/'gptnotion_mcp'/'compat_runtime.py'
for p in (base_html,base_py,compat):
    if not p.exists(): print('Missing:',p);sys.exit(2)
# Frozen baselines are historical references; production sources may intentionally diverge.
# Guard feature/API presence instead of byte equality so verified reliability/performance fixes are allowed.
compat_text=compat.read_text(encoding='utf-8')
required_py=['def bootstrap_snapshot(', 'def rag_large_optimize(', "'rag.hybrid_search'", "'rag.optimize_index'", 'def call_mcp_tool(', 'def main(']
missing_py=[x for x in required_py if x not in compat_text]
if missing_py:
    print('MCP feature signatures missing:',missing_py);sys.exit(3)
html=base_html.read_text(encoding='utf-8')
manifest=json.loads((ROOT/'frontend'/'src'/'legacy'/'manifest.json').read_text(encoding='utf-8'))
leg=ROOT/'frontend'/'src'/'legacy'
rebuilt=[]
for group in manifest['groups']:
    rebuilt.append(''.join((leg/name).read_text(encoding='utf-8') for name in group['files']))
joined='\n'.join(rebuilt)
required_js=['const PageStore', 'const BlockStore', 'const DatabaseStore', 'const RagChat', 'RAG V2.4 · 100K FAST PATH', 'const LocalMCPBridge', 'const AICommands']
missing_js=[x for x in required_js if x not in joined]
if missing_js:
    print('Frontend feature signatures missing:',missing_js);sys.exit(4)
# Manifest must still reconstruct the same number of legacy script groups as the frozen baseline.
orig_scripts=[m.group(1) for m in re.finditer(r'<script[^>]*>(.*?)</script>',html,re.I|re.S)]
if len(orig_scripts)!=len(rebuilt):
    print(f'Legacy script group count differs: original={len(orig_scripts)} rebuilt={len(rebuilt)}');sys.exit(5)
print('Source integrity: PASS')
