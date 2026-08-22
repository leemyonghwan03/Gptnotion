from __future__ import annotations
import json, os, socket, subprocess, tempfile, time, urllib.request, pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]

def free_port() -> int:
    s=socket.socket();s.bind(('127.0.0.1',0));p=s.getsockname()[1];s.close();return p
port=free_port(); td=tempfile.TemporaryDirectory(prefix='gptnotion_http_smoke_')
env=os.environ.copy();env['GPTNOTION_LOCAL_DIR']=td.name;env['GPTNOTION_LOCAL_PORT']=str(port);env['GPTNOTION_SQLITE_VEC_DISABLE']='1'
proc=subprocess.Popen(['python','main.py'],cwd=ROOT/'mcp',env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
    base=f'http://127.0.0.1:{port}'
    health=None
    for _ in range(100):
        try:
            with urllib.request.urlopen(base+'/health',timeout=.5) as r: health=json.load(r)
            if health.get('ok'): break
        except Exception: pass
        time.sleep(.1)
    if not health or not health.get('ok'): raise SystemExit('MCP /health failed')
    body=json.dumps({'name':'system.modular_status','arguments':{}}).encode()
    req=urllib.request.Request(base+'/api/mcp/call',data=body,headers={'Content-Type':'application/json'},method='POST')
    with urllib.request.urlopen(req,timeout=3) as r: result=json.load(r)
    status=result.get('result') if isinstance(result,dict) else None
    if not isinstance(status,dict) or status.get('appVersion')!='3.0.0-modular': raise SystemExit(f'modular tool HTTP failed: {result}')
    body=json.dumps({'name':'rag.large_status','arguments':{}}).encode()
    req=urllib.request.Request(base+'/api/mcp/call',data=body,headers={'Content-Type':'application/json'},method='POST')
    with urllib.request.urlopen(req,timeout=3) as r: rag=json.load(r)
    if not isinstance(rag,dict) or rag.get('ok') is not True: raise SystemExit('RAG status HTTP failed')
    print(f'MCP HTTP smoke: PASS (port={port}, serverVersion={health.get("version")}, modular={status.get("mcpVersion")})')
finally:
    proc.terminate()
    try: proc.wait(timeout=5)
    except subprocess.TimeoutExpired: proc.kill()
    td.cleanup()
