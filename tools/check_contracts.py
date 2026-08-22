from __future__ import annotations
import json, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
required=['mcp-tools.schema.json','rag.schema.json','storage.schema.json']
for name in required:
    p=ROOT/'contracts'/name
    if not p.exists():
        print(f'Missing contract: {p}'); sys.exit(2)
    try: data=json.loads(p.read_text(encoding='utf-8'))
    except Exception as e:
        print(f'Invalid JSON {p}: {e}'); sys.exit(2)
    if not isinstance(data,dict) or '$schema' not in data:
        print(f'Contract lacks $schema: {p}'); sys.exit(2)
print('Contract JSON validation: PASS')
