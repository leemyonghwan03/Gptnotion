from __future__ import annotations
import json, unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

class ContractTests(unittest.TestCase):
    def test_contract_version(self) -> None:
        version=json.loads((ROOT/'VERSION.json').read_text(encoding='utf-8'))
        self.assertEqual(version['contractVersion'],'1.0.0')

    def test_rag_fast_and_deep(self) -> None:
        rag=json.loads((ROOT/'contracts'/'rag.schema.json').read_text(encoding='utf-8'))
        self.assertEqual(rag['$defs']['searchMode']['enum'],['fast','deep'])

    def test_strict_tsconfig(self) -> None:
        ts=json.loads((ROOT/'frontend'/'tsconfig.json').read_text(encoding='utf-8'))['compilerOptions']
        self.assertTrue(ts['strict']);self.assertTrue(ts['noImplicitAny']);self.assertTrue(ts['strictNullChecks']);self.assertFalse(ts['skipLibCheck'])

if __name__=='__main__': unittest.main()
