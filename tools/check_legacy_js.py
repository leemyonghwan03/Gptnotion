from __future__ import annotations
import json, subprocess, tempfile, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
leg=ROOT/'frontend'/'src'/'legacy'
manifest=json.loads((leg/'manifest.json').read_text(encoding='utf-8'))
with tempfile.TemporaryDirectory(prefix='gptnotion_jscheck_') as td:
    for i,group in enumerate(manifest['groups']):
        code=''.join((leg/name).read_text(encoding='utf-8') for name in group['files'])
        p=Path(td)/f'group_{i:02d}.js'; p.write_text(code,encoding='utf-8')
        r=subprocess.run(['node','--check',str(p)],capture_output=True,text=True)
        if r.returncode:
            print(f'Legacy JS syntax FAIL: {group["name"]}\n{r.stdout}\n{r.stderr}');sys.exit(r.returncode)
print(f'Legacy JS syntax: PASS ({len(manifest["groups"])} script groups)')
