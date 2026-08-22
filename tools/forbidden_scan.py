from __future__ import annotations
import re, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
patterns=[
    (re.compile(r'@ts-ignore'), '@ts-ignore'),
    (re.compile(r'@ts-nocheck'), '@ts-nocheck'),
    (re.compile(r'\bas\s+any\b'), 'as any'),
    (re.compile(r':\s*any\b'), ': any'),
    (re.compile(r'\bas\s+unknown\s+as\b'), 'as unknown as'),
]
violations=[]
for p in sorted((ROOT/'frontend'/'src'/'ts').rglob('*.ts')):
    text=p.read_text(encoding='utf-8')
    for rx,label in patterns:
        for m in rx.finditer(text):
            line=text.count('\n',0,m.start())+1
            violations.append(f'{p.relative_to(ROOT)}:{line}: forbidden {label}')
config=(ROOT/'frontend'/'tsconfig.json').read_text(encoding='utf-8')
config_checks=[
    ('"strict": false','strict=false'),('"noImplicitAny": false','noImplicitAny=false'),
    ('"strictNullChecks": false','strictNullChecks=false'),('"skipLibCheck": true','skipLibCheck=true')
]
for needle,label in config_checks:
    if needle in config: violations.append(f'frontend/tsconfig.json: forbidden {label}')
if violations:
    print('\n'.join(violations)); sys.exit(2)
print('Forbidden-pattern scan: PASS')
