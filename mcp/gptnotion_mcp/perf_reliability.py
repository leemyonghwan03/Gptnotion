from __future__ import annotations

import hashlib
import json
import re
import sqlite3
import time
import unicodedata
from typing import Any

_INSTALLED = False
_ARTICLE_RE = re.compile(r'(?:제\s*)?(\d+)\s*조(?:\s*의\s*(\d+))?')
_PARAGRAPH_RE = re.compile(r'(?:제\s*)?(\d+)\s*항')
_ANNEX_RE = re.compile(r'(별표|별지)\s*(?:제\s*)?(\d+)')
_PROTOCOL_FALLBACK_HTTP = {404, 405, 415, 422, 501}


def _structure(text: object):
    value = unicodedata.normalize('NFKC', str(text or ''))
    article = _ARTICLE_RE.search(value)
    paragraph = _PARAGRAPH_RE.search(value)
    annex = _ANNEX_RE.search(value)
    return (
        int(article.group(1)) if article else None,
        int(article.group(2)) if article and article.group(2) else None,
        int(paragraph.group(1)) if paragraph else None,
        annex.group(1) if annex else '',
        int(annex.group(2)) if annex else None,
    )


def _adapter_fallback_allowed(exc: BaseException) -> bool:
    match = re.search(r'UPSTREAM_HTTP_(\d{3})', str(exc or ''))
    return bool(match and int(match.group(1)) in _PROTOCOL_FALLBACK_HTTP)


def install(runtime: Any) -> None:
    global _INSTALLED
    if _INSTALLED:
        return

    runtime._RAG23_ARTICLE_RE = _ARTICLE_RE
    runtime._RAG23_PARAGRAPH_RE = _PARAGRAPH_RE
    runtime._RAG23_ANNEX_RE = _ANNEX_RE
    runtime._rag23_structure = _structure
    runtime.gateway_adapter_fallback_allowed = _adapter_fallback_allowed

    def catalog_record(key, chunk, updated, docs, folders):
        document_id = str(chunk.get('documentId') or '')
        document = runtime._rag23_effective_doc(docs.get(document_id, {}), folders)
        text = str(chunk.get('content') or chunk.get('searchText') or '').strip()
        search = str(chunk.get('searchText') or text).strip()
        title = str(document.get('name') or '')
        heading = str(chunk.get('headingPath') or '')
        folder_id = str(document.get('folderId') or '')
        governance = ' '.join([
            str(document.get('folderPath') or ''),
            str(document.get('documentTypeLabel') or ''),
            str(document.get('applicabilityScope') or ''),
            title,
        ]).strip()
        full_search = (governance + ' ' + heading + ' ' + search).strip()
        article, article_sub, paragraph, annex_type, annex_no = _structure(heading + ' ' + text[:800])
        chunk_id = str(chunk.get('id') or key)
        digest = hashlib.sha256((document_id + '\0' + title + '\0' + heading + '\0' + full_search).encode('utf-8', 'ignore')).hexdigest()[:24]
        return (
            chunk_id, document_id, folder_id, title, heading, text, full_search,
            int(chunk.get('order') or 0), article, article_sub, paragraph,
            annex_type, annex_no, digest, int(updated or 0),
        )

    runtime._rag23_catalog_record = catalog_record

    def catalog_upsert(con, key, chunk, updated, docs, folders, sync_fts=True):
        (chunk_id, document_id, folder_id, title, heading, text, full_search,
         chunk_order, article, article_sub, paragraph, annex_type, annex_no,
         digest, source_updated) = catalog_record(key, chunk, updated, docs, folders)
        row = con.execute(
            'SELECT rid,content_hash,source_updated_at FROM rag_chunk_catalog WHERE chunk_id=?',
            (chunk_id,),
        ).fetchone()
        if row and row['content_hash'] == digest and int(row['source_updated_at'] or 0) == source_updated:
            return int(row['rid']), False
        if row:
            rid = int(row['rid'])
            con.execute(
                '''UPDATE rag_chunk_catalog SET document_id=?,folder_id=?,title=?,heading=?,content=?,search_text=?,chunk_order=?,article_no=?,article_sub_no=?,paragraph_no=?,annex_type=?,annex_no=?,content_hash=?,source_updated_at=? WHERE rid=?''',
                (document_id, folder_id, title, heading, text, full_search, chunk_order,
                 article, article_sub, paragraph, annex_type, annex_no, digest, source_updated, rid),
            )
        else:
            cur = con.execute(
                '''INSERT INTO rag_chunk_catalog(chunk_id,document_id,folder_id,title,heading,content,search_text,chunk_order,article_no,article_sub_no,paragraph_no,annex_type,annex_no,content_hash,source_updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',
                (chunk_id, document_id, folder_id, title, heading, text, full_search, chunk_order,
                 article, article_sub, paragraph, annex_type, annex_no, digest, source_updated),
            )
            rid = int(cur.lastrowid)
        if sync_fts:
            try:
                con.execute('DELETE FROM rag_chunk_fts WHERE rowid=?', (rid,))
                con.execute(
                    'INSERT INTO rag_chunk_fts(rowid,chunk_id,document_id,folder_id,title,heading,search_text) VALUES(?,?,?,?,?,?,?)',
                    (rid, chunk_id, document_id, folder_id, title, heading, full_search),
                )
            except sqlite3.OperationalError:
                pass
        return rid, True

    runtime._rag23_catalog_upsert = catalog_upsert

    def optimize(args=None):
        args = args if isinstance(args, dict) else {}
        full = bool(args.get('full', False))
        missing = bool(args.get('buildMissingVectors', False))
        started = time.perf_counter()
        folders = runtime._rag_v22_load_folders()
        with runtime._RAG23_INDEX_LOCK, runtime.DB_WRITE_LOCK, runtime.connect() as con:
            runtime._rag23_init_schema(con)
            docs = {str(d.get('id') or key): d for key, d, _ in runtime._record_payload_rows(con, 'ragDocuments')}
            if full:
                try:
                    con.execute('DELETE FROM rag_chunk_fts')
                except Exception:
                    pass
                try:
                    con.execute('DELETE FROM rag_vec_index_384')
                except Exception:
                    pass
                con.execute('DELETE FROM rag_vector_lsh')
                con.execute('DELETE FROM rag_vector_blob')
                con.execute('DELETE FROM rag_chunk_catalog')

            changed = 0
            stale: list[str] = []
            if full:
                batch: list[tuple[object, ...]] = []
                insert_sql = '''INSERT INTO rag_chunk_catalog(chunk_id,document_id,folder_id,title,heading,content,search_text,chunk_order,article_no,article_sub_no,paragraph_no,annex_type,annex_no,content_hash,source_updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'''
                for row in con.execute("SELECT record_key,payload,updated_at FROM records WHERE store_name='ragChunks'"):
                    try:
                        chunk = json.loads(row['payload']) if row['payload'] else {}
                    except Exception:
                        continue
                    if not isinstance(chunk, dict):
                        continue
                    batch.append(catalog_record(row['record_key'], chunk, row['updated_at'], docs, folders))
                    if len(batch) >= 2000:
                        con.executemany(insert_sql, batch)
                        changed += len(batch)
                        batch.clear()
                if batch:
                    con.executemany(insert_sql, batch)
                    changed += len(batch)
                try:
                    con.execute('DELETE FROM rag_chunk_fts')
                    con.execute('''INSERT INTO rag_chunk_fts(rowid,chunk_id,document_id,folder_id,title,heading,search_text)
                                   SELECT rid,chunk_id,document_id,folder_id,title,heading,search_text FROM rag_chunk_catalog''')
                except sqlite3.OperationalError:
                    pass
            else:
                source_ids: set[str] = set()
                for row in con.execute("SELECT record_key,payload,updated_at FROM records WHERE store_name='ragChunks'"):
                    try:
                        chunk = json.loads(row['payload']) if row['payload'] else {}
                    except Exception:
                        continue
                    if not isinstance(chunk, dict):
                        continue
                    key = row['record_key']
                    chunk_id = str(chunk.get('id') or key)
                    source_ids.add(chunk_id)
                    _, did_change = catalog_upsert(con, key, chunk, row['updated_at'], docs, folders)
                    changed += int(did_change)
                stale = [str(row[0]) for row in con.execute('SELECT chunk_id FROM rag_chunk_catalog').fetchall() if str(row[0]) not in source_ids]
                for chunk_id in stale:
                    runtime._rag23_remove_chunk(con, chunk_id)

            vector_changed = 0
            have: set[str] = set()
            for row in con.execute("SELECT record_key,payload,updated_at FROM records WHERE store_name='ragEmbeddings'"):
                try:
                    embedding = json.loads(row['payload']) if row['payload'] else {}
                except Exception:
                    continue
                if isinstance(embedding, dict):
                    have.add(str(embedding.get('chunkId') or row['record_key']))
                    vector_changed += int(runtime._rag23_vector_upsert(con, row['record_key'], embedding, row['updated_at']))
            if missing:
                for row in con.execute("SELECT record_key,payload,updated_at FROM records WHERE store_name='ragChunks'"):
                    try:
                        chunk = json.loads(row['payload']) if row['payload'] else {}
                    except Exception:
                        continue
                    if not isinstance(chunk, dict):
                        continue
                    chunk_id = str(chunk.get('id') or row['record_key'])
                    if chunk_id in have:
                        continue
                    text = str(chunk.get('searchText') or chunk.get('content') or '').strip()
                    if not text:
                        continue
                    vector = runtime._hash_embedding(text, 384)
                    embedding = {
                        'chunkId': chunk_id,
                        'provider': 'local-mcp:local-hash-ngram',
                        'vector': vector,
                        'hash': hashlib.sha256(text.encode('utf-8', 'ignore')).hexdigest()[:24],
                    }
                    vector_changed += int(runtime._rag23_vector_upsert(con, chunk_id, embedding, row['updated_at']))
            counts = {
                'chunks': con.execute('SELECT COUNT(*) FROM rag_chunk_catalog').fetchone()[0],
                'vectors': con.execute('SELECT COUNT(*) FROM rag_vector_blob').fetchone()[0],
                'lshRows': con.execute('SELECT COUNT(*) FROM rag_vector_lsh').fetchone()[0],
            }
            runtime._rag23_meta_set(con, 'lastOptimize', {'at': runtime.now_ms(), 'counts': counts, 'full': full})
            try:
                con.execute('PRAGMA optimize')
            except Exception:
                pass
        elapsed = (time.perf_counter() - started) * 1000.0
        return {
            'ok': True, 'version': '2.3', 'targetChunks': runtime.RAG_V23_TARGET_CHUNKS,
            'full': full, 'catalogChanged': changed, 'vectorChanged': vector_changed,
            'deleted': len(stale), 'counts': counts, 'sqliteVec': bool(runtime._RAG23_VEC_LOADER),
            'sqliteVecPartition': runtime._RAG23_VEC_PARTITION, 'elapsedMs': round(elapsed, 2),
        }

    runtime.rag_large_optimize = optimize

    base_gateway_chat = runtime.gateway_chat
    base_model_probe = runtime.model_probe

    def gateway_chat(args: dict):
        settings = args.get('settings') if isinstance(args.get('settings'), dict) else {}
        messages = args.get('messages') if isinstance(args.get('messages'), list) else []
        task_kind = str(args.get('taskKind') or 'chat').lower()
        adapter_req = str(args.get('adapterMode') or 'auto').lower()
        endpoint = str(settings.get('endpoint') or '')
        model = str(settings.get('model') or '')
        fp = runtime.model_fingerprint(endpoint, model)
        profile = runtime.model_profile_get({'fingerprint': fp, 'endpoint': endpoint, 'model': model}) or {'score': 70}
        strat = runtime.strategy_for_score(int(profile.get('score') or 70))
        messages, pack_meta = runtime.shrink_operator_catalog(messages, profile)
        prefix = runtime.compatibility_prefix(strat, task_kind)
        if prefix:
            messages = [{'role': 'system', 'content': prefix}] + list(messages)
        json_expected = bool(args.get('forceJson', task_kind in runtime.JSON_TASK_KINDS))
        errors: list[str] = []
        result = None
        started = time.time()
        for mode in runtime.adapter_order(settings, adapter_req):
            try:
                result = runtime.request_upstream(settings, messages, mode, task_kind, timeout=int(args.get('timeoutSec') or 120))
                break
            except Exception as exc:
                errors.append(mode + ': ' + str(exc)[:600])
                if not _adapter_fallback_allowed(exc):
                    break
        if not result:
            runtime.update_gateway_metrics(fp, json_expected=json_expected, failed=True, adapter='', latency_ms=int((time.time() - started) * 1000))
            raise ValueError('MODEL_GATEWAY_FAILED: ' + ' | '.join(errors))

        forwarded = dict(args)
        forwarded['adapterMode'] = result['adapter']
        if not json_expected:
            runtime.update_gateway_metrics(fp, json_expected=False, failed=False, adapter=result['adapter'], latency_ms=result['latencyMs'])
            return {
                'ok': True, 'text': str(result.get('text') or ''), 'adapter': result['adapter'],
                'latencyMs': result['latencyMs'], 'systemFallback': bool(result.get('systemFallback')),
                'jsonExpected': False, 'jsonValid': True, 'repaired': False,
                'profile': runtime.model_profile_get({'fingerprint': fp, 'endpoint': endpoint, 'model': model}),
                'toolPack': pack_meta, 'errors': errors,
            }
        return base_gateway_chat(forwarded)

    runtime.gateway_chat = gateway_chat

    def model_probe(args: dict):
        original_order = runtime.adapter_order
        settings = args.get('settings') if isinstance(args.get('settings'), dict) else args
        requested = str(args.get('adapterMode') or 'auto')
        order = list(original_order(settings, requested))
        if requested != 'auto' or len(order) <= 1:
            return base_model_probe(args)
        errors = []
        for mode in order:
            try:
                probe_args = dict(args)
                probe_args['adapterMode'] = mode
                result = base_model_probe(probe_args)
                tests = (result or {}).get('payload', {}).get('tests', []) if isinstance(result, dict) else []
                if any(t.get('ok') for t in tests if isinstance(t, dict)):
                    return result
                return result
            except Exception as exc:
                errors.append(str(exc))
                if not _adapter_fallback_allowed(exc):
                    raise
        return base_model_probe(args)

    runtime.model_probe = model_probe
    _INSTALLED = True
