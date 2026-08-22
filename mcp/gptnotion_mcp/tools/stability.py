from __future__ import annotations

import os
import resource
import time
from typing import Any

from .registry import ToolExtension, register_tool

_STARTED_AT = time.time()


def _rss_bytes() -> int | None:
    try:
        value = int(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)
        return value if value > 10_000_000 else value * 1024
    except Exception:
        return None


def register(runtime: Any) -> None:
    def document_chunks(args: dict[str, Any]) -> dict[str, Any]:
        document_id = str(args.get('documentId') or '').strip()
        if not document_id:
            raise ValueError('documentId가 필요합니다.')
        limit = max(1, min(int(args.get('limit') or 2000), 5000))
        offset = max(0, int(args.get('offset') or 0))
        with runtime.connect() as con:
            runtime._rag23_init_schema(con)
            total = int(con.execute('SELECT COUNT(*) FROM rag_chunk_catalog WHERE document_id=?',(document_id,)).fetchone()[0])
            rows = con.execute('''SELECT chunk_id,document_id,heading,content,search_text,chunk_order,source_updated_at
                   FROM rag_chunk_catalog WHERE document_id=?
                   ORDER BY chunk_order,rid LIMIT ? OFFSET ?''',(document_id, limit, offset)).fetchall()
        items = [{'id':str(row['chunk_id']),'documentId':str(row['document_id']),'headingPath':str(row['heading'] or ''),'content':str(row['content'] or ''),'searchText':str(row['search_text'] or ''),'order':int(row['chunk_order'] or 0),'updatedAt':int(row['source_updated_at'] or 0)} for row in rows]
        return {'ok':True,'documentId':document_id,'items':items,'total':total,'offset':offset,'limit':limit,'hasMore':offset+len(items)<total,'nextOffset':offset+len(items)}

    def document_purge(args: dict[str, Any]) -> dict[str, Any]:
        document_id = str(args.get('documentId') or '').strip()
        if not document_id:
            raise ValueError('documentId가 필요합니다.')
        with runtime._RAG23_INDEX_LOCK, runtime.DB_WRITE_LOCK, runtime.connect() as con:
            runtime._rag23_init_schema(con)
            count = int(con.execute('SELECT COUNT(*) FROM rag_chunk_catalog WHERE document_id=?',(document_id,)).fetchone()[0])
            con.execute("DELETE FROM records WHERE store_name='ragEmbeddings' AND record_key IN (SELECT chunk_id FROM rag_chunk_catalog WHERE document_id=?)",(document_id,))
            con.execute("DELETE FROM records WHERE store_name='ragChunks' AND record_key IN (SELECT chunk_id FROM rag_chunk_catalog WHERE document_id=?)",(document_id,))
            runtime._rag23_remove_document(con, document_id)
        return {'ok':True,'documentId':document_id,'deletedChunks':count}

    def stability_status(_: dict[str, Any]) -> dict[str, Any]:
        with runtime.connect() as con:
            quick = str(con.execute('PRAGMA quick_check').fetchone()[0])
            wal = int(con.execute('PRAGMA wal_autocheckpoint').fetchone()[0])
            counts = {str(r[0]): int(r[1]) for r in con.execute('SELECT store_name,COUNT(*) FROM records GROUP BY store_name')}
        return {'ok':quick=='ok','uptimeSec':round(max(0.0,time.time()-_STARTED_AT),3),'rssBytes':_rss_bytes(),'threads':int(runtime.threading.active_count()),'dbQuickCheck':quick,'walAutoCheckpoint':wal,'dbBytes':runtime.DB_PATH.stat().st_size if runtime.DB_PATH.exists() else 0,'stores':counts,'pid':os.getpid()}

    register_tool(ToolExtension(name='rag.document_chunks',title='Read RAG Document Chunks',description='대형 RAG 자료실에서 특정 문서 청크만 페이지 단위로 읽습니다.',input_schema={'type':'object','properties':{'documentId':{'type':'string'},'limit':{'type':'integer','minimum':1,'maximum':5000},'offset':{'type':'integer','minimum':0}},'required':['documentId'],'additionalProperties':False},handler=document_chunks))
    register_tool(ToolExtension(name='rag.document_purge',title='Purge RAG Document Index Data',description='대형 RAG 자료에서 특정 문서의 청크/임베딩/파생 인덱스만 원자적으로 제거합니다.',input_schema={'type':'object','properties':{'documentId':{'type':'string'}},'required':['documentId'],'additionalProperties':False},handler=document_purge))
    register_tool(ToolExtension(name='system.stability_status',title='Runtime Stability Status',description='MCP 장시간 실행 상태, SQLite quick_check, 메모리/스레드 상태를 진단합니다.',input_schema={'type':'object','properties':{},'additionalProperties':False},handler=stability_status))
