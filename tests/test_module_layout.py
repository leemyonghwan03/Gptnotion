from __future__ import annotations
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

class LayoutTests(unittest.TestCase):
    def test_frontend_domains(self) -> None:
        for rel in ['domain/page.ts','domain/block.ts','domain/database.ts','features/editor.ts','features/rag.ts','infrastructure/mcp-client.ts']:
            self.assertTrue((ROOT/'frontend'/'src'/'ts'/rel).exists(),rel)

    def test_mcp_domains(self) -> None:
        for rel in ['db/service.py','rag/service.py','ai/service.py','filesystem/service.py','documents/service.py','automation/service.py','tools/registry.py']:
            self.assertTrue((ROOT/'mcp'/'gptnotion_mcp'/rel).exists(),rel)

if __name__=='__main__': unittest.main()
