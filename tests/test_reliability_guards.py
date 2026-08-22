from __future__ import annotations
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

class ReliabilityGuardTests(unittest.TestCase):
    def text(self, rel: str) -> str:
        return (ROOT/rel).read_text(encoding='utf-8')

    def test_indexeddb_atomic_batch_uses_single_transaction(self):
        src=self.text('frontend/src/legacy/00-06-05-indexeddb-layer.legacy.js')
        self.assertIn("const t=tx(stores,'readwrite')",src)
        opt=self.text('frontend/src/legacy/04-patch.legacy.js')
        self.assertIn('return DBM.rawIDBAtomicBatch(payload)',opt)

    def test_rag_chat_has_concurrency_guard(self):
        src=self.text('frontend/src/legacy/00-42-27-7d-rag-전용-채팅-뷰-별도-ui-대화형-검색-범위-지정.legacy.js')
        self.assertIn('busy:false, requestSeq:0',src)
        self.assertIn('if(RagChat.busy) return;',src)
        self.assertIn('if(RagChat.busy){toast(',src)

    def test_ai_adapter_retry_only_for_protocol_mismatch(self):
        src=self.text('mcp/gptnotion_mcp/perf_reliability.py')
        self.assertIn('def _adapter_fallback_allowed(exc: BaseException) -> bool:',src)
        self.assertIn('{404, 405, 415, 422, 501}',src)
        front=self.text('frontend/src/legacy/00-30-23-ai-architecture.legacy.js')
        self.assertIn('streamFallbackStatuses = new Set([400,404,405,415,422,501])',front)
        self.assertIn('throw await AI.httpError(res)',front)

    def test_release_waits_for_mcp_health_instead_of_fixed_delay(self):
        src=self.text('tools/build_release.py')
        self.assertIn("http://127.0.0.1:37841/health",src)
        self.assertIn('MCP health check failed',src)
        self.assertNotIn('timeout /t 2 /nobreak >nul',src)

    def test_full_rag_rebuild_defers_per_row_fts(self):
        src=self.text('mcp/gptnotion_mcp/perf_reliability.py')
        self.assertIn('def catalog_upsert(con, key, chunk, updated, docs, folders, sync_fts=True):',src)
        self.assertIn('def catalog_record(key, chunk, updated, docs, folders):',src)
        self.assertIn('con.executemany(insert_sql, batch)',src)
        self.assertIn('SELECT rid,chunk_id,document_id,folder_id,title,heading,search_text FROM rag_chunk_catalog',src)

if __name__=='__main__':
    unittest.main()
