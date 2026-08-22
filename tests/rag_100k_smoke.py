from __future__ import annotations
import json, os, sys, tempfile, time, pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
td=tempfile.TemporaryDirectory(prefix='gptnotion_100k_')
os.environ['GPTNOTION_LOCAL_DIR']=td.name
os.environ['GPTNOTION_SQLITE_VEC_DISABLE']='1'
sys.path.insert(0,str(ROOT/'mcp'))
from gptnotion_mcp.server.app import prepare_runtime
from gptnotion_mcp import compat_runtime as runtime
prepare_runtime();runtime.init_db()
now=runtime.now_ms()
docs=[]
for d in range(100):
    did=f'doc-{d:03d}'
    docs.append(('ragDocuments',did,runtime.json_dumps({'id':did,'name':f'보안업무 규정 {d:03d}','folderId':'','createdAt':now,'updatedAt':now}),now))
chunks=[]
for i in range(100_000):
    d=i//1000; did=f'doc-{d:03d}'; article=i%250+1
    special=(i%997==0)
    content=(f'제{article}조 특별점검 주기는 매월 1회 실시하고 결과를 보안담당자에게 보고한다.' if special else f'제{article}조 일반 보안업무 처리절차와 기록 관리 기준 {i}.')
    cid=f'chunk-{i:06d}'
    payload={'id':cid,'documentId':did,'headingPath':f'제{article}조','content':content,'searchText':content,'order':i%1000,'createdAt':now,'updatedAt':now}
    chunks.append(('ragChunks',cid,runtime.json_dumps(payload),now))
start=time.perf_counter()
with runtime.DB_WRITE_LOCK, runtime.connect() as con:
    con.executemany('INSERT INTO records(store_name,record_key,payload,updated_at) VALUES(?,?,?,?)',docs)
    batch=5000
    for pos in range(0,len(chunks),batch):
        con.executemany('INSERT INTO records(store_name,record_key,payload,updated_at) VALUES(?,?,?,?)',chunks[pos:pos+batch])
insert_ms=(time.perf_counter()-start)*1000
start=time.perf_counter(); opt=runtime.call_mcp_tool('rag.optimize_index',{'full':True,'buildMissingVectors':False}); index_ms=(time.perf_counter()-start)*1000
bench=runtime.call_mcp_tool('rag.benchmark_search',{'query':'특별점검 주기는 어떻게 되나요','repeat':7,'limit':12,'parentExpansion':False})
result=runtime.call_mcp_tool('rag.hybrid_search',{'query':'특별점검 주기는 어떻게 되나요','limit':12,'searchMode':'fast','allowRemoteEmbedding':False,'adaptiveRerank':False,'parentExpansion':False})
items=result.get('items') if isinstance(result,dict) else None
if not isinstance(items,list) or not items: raise SystemExit('100K search returned no items')
first=' '.join(str(items[0].get(k,'')) for k in ('title','headingPath','text','anchorText','contextText'))
if '특별점검' not in first: raise SystemExit('100K relevance smoke failed: top result does not contain 특별점검')
status=runtime.call_mcp_tool('rag.large_status',{})
indexed=int(status.get('indexedChunks',0)) if isinstance(status,dict) else 0
if indexed < 100_000: raise SystemExit(f'Expected 100000 indexed chunks, got {indexed}')
print(json.dumps({'ok':True,'chunks':indexed,'insertMs':round(insert_ms,1),'indexMs':round(index_ms,1),'p50Ms':bench.get('p50Ms'),'p95Ms':bench.get('p95Ms'),'avgMs':bench.get('avgMs'),'topContainsSpecial':True},ensure_ascii=False))
td.cleanup()
