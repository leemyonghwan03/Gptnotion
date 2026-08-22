from __future__ import annotations
import os, sys, tempfile, json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
td=tempfile.TemporaryDirectory(prefix='gptnotion_mcp_smoke_')
os.environ['GPTNOTION_LOCAL_DIR']=td.name
os.environ['GPTNOTION_SQLITE_VEC_DISABLE']='1'
sys.path.insert(0,str(ROOT/'mcp'))
from gptnotion_mcp.server.app import prepare_runtime
from gptnotion_mcp import compat_runtime as runtime
prepare_runtime(); runtime.init_db()
status=runtime.call_mcp_tool('system.modular_status',{})
if not isinstance(status,dict) or status.get('ok') is not True or status.get('compilerFirst') is not True:
    raise SystemExit('modular status failed: '+json.dumps(status,ensure_ascii=False))
if 'system.modular_status' not in runtime.MCP_TOOL_MAP: raise SystemExit('modular tool not registered')
stats=runtime.call_mcp_tool('sqlite.stats',{})
if not isinstance(stats,dict): raise SystemExit('sqlite.stats failed')
rag=runtime.call_mcp_tool('rag.large_status',{})
if not isinstance(rag,dict): raise SystemExit('rag.large_status failed')
with runtime.connect() as con:
    row=con.execute('PRAGMA integrity_check').fetchone()
if not row or row[0] != 'ok': raise SystemExit('SQLite integrity_check failed')
print(f'MCP modular smoke: PASS (tools={len(runtime.MCP_TOOLS)}, indexedChunks={rag.get("indexedChunks",0)})')
td.cleanup()
