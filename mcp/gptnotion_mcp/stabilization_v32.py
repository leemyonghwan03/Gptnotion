from __future__ import annotations

from typing import Any

_INSTALLED = False


def install(runtime: Any) -> None:
    global _INSTALLED
    if _INSTALLED:
        return

    runtime._RAG_V2_STOPWORDS.update({
        '정해져','정해진','정해졌나요','정해져있나요','정해져있어','정하나요','됩니까','되나요',
        '누가','누구','무슨','어떤','몇','얼마','왜','설명해줘','말해줘','알고싶어'
    })

    def stable_fts_query(variants, limit, document_ids=None, folder_ids=None):
        original = variants[0] if variants else ''
        strict_tokens = []
        for token in runtime._rag_v2_tokens(original):
            if len(token) >= 2 and token not in strict_tokens:
                strict_tokens.append(token)
        all_tokens = []
        for variant in variants[:4]:
            for token in runtime._rag_v2_tokens(variant):
                if len(token) >= 2 and token not in all_tokens:
                    all_tokens.append(token)
        if not all_tokens:
            return []
        base = """SELECT c.rid,c.chunk_id,c.document_id,c.folder_id,c.title,c.heading,c.content,c.search_text,c.chunk_order,
                         0.0 AS rank
                  FROM rag_chunk_fts JOIN rag_chunk_catalog c ON c.rid=rag_chunk_fts.rowid
                  WHERE rag_chunk_fts MATCH ?"""
        def scope_sql(sql, params):
            if document_ids:
                vals = list(dict.fromkeys(str(x) for x in document_ids if str(x)))[:900]
                if vals:
                    sql += ' AND c.document_id IN (' + ','.join('?' * len(vals)) + ')'
                    params += vals
            if folder_ids:
                vals = list(dict.fromkeys(str(x) for x in folder_ids if str(x)))[:900]
                if vals:
                    sql += ' AND c.folder_id IN (' + ','.join('?' * len(vals)) + ')'
                    params += vals
            return sql, params
        rows = []
        if strict_tokens:
            expr = ' AND '.join(token.replace('"','') + '*' for token in strict_tokens[:10])
            sql, params = scope_sql(base, [expr]); sql += ' LIMIT ?'; params.append(int(limit))
            try:
                with runtime.connect() as con:
                    rows = [dict(row) for row in con.execute(sql, params).fetchall()]
            except Exception:
                rows = []
        scored = []; seen = set()
        for chunk in rows:
            cid = str(chunk.get('chunk_id') or ''); seen.add(cid)
            hay = (str(chunk.get('title') or '')+' '+str(chunk.get('heading') or '')+' '+str(chunk.get('search_text') or '')).lower()
            overlap = runtime._rag_v2_overlap_score(original, hay)
            title = runtime._rag_v2_overlap_score(original, (str(chunk.get('title') or '')+' '+str(chunk.get('heading') or '')).lower())
            phrase = 1.0 if str(original).lower() in hay else 0.0
            scored.append((0.62*overlap + 0.23*title + 0.15*phrase, chunk))
        floor = min(int(limit), 40)
        if scored:
            scored.sort(key=lambda x:x[0], reverse=True)
            if len(scored) >= floor or (len(scored) >= 3 and scored[0][0] >= 0.60):
                return scored[:int(limit)]
        expr = ' OR '.join(token.replace('"','')+'*' for token in all_tokens[:24])
        sql = """SELECT c.rid,c.chunk_id,c.document_id,c.folder_id,c.title,c.heading,c.content,c.search_text,c.chunk_order,
                        bm25(rag_chunk_fts,0.0,0.0,0.0,5.0,3.0,1.0) AS rank
                 FROM rag_chunk_fts JOIN rag_chunk_catalog c ON c.rid=rag_chunk_fts.rowid
                 WHERE rag_chunk_fts MATCH ?"""
        params = [expr]; sql, params = scope_sql(sql, params); sql += ' ORDER BY rank LIMIT ?'; params.append(int(limit))
        try:
            with runtime.connect() as con:
                extra = con.execute(sql, params).fetchall()
        except Exception:
            extra = []
        for row in extra:
            chunk = dict(row); cid = str(chunk.get('chunk_id') or '')
            if cid in seen:
                continue
            seen.add(cid)
            bm25_value = float(row['rank'] or 0.0)
            magnitude = max(0.0, -bm25_value)
            raw = magnitude / (1.0 + magnitude)
            hay = (str(chunk.get('title') or '')+' '+str(chunk.get('heading') or '')+' '+str(chunk.get('search_text') or '')).lower()
            overlap = runtime._rag_v2_overlap_score(original, hay)
            phrase = 1.0 if str(original).lower() in hay else 0.0
            score = 0.58*overlap + 0.32*raw + 0.10*phrase
            scored.append((score, chunk))
        scored.sort(key=lambda x:x[0], reverse=True)
        return scored[:int(limit)]

    runtime._rag23_fts_query = stable_fts_query
    _INSTALLED = True
