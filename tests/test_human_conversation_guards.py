from __future__ import annotations
import json, unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

class HumanConversationGuardTests(unittest.TestCase):
    def text(self, rel: str) -> str:
        return (ROOT/rel).read_text(encoding='utf-8')

    def test_human_tuning_patch_loads_last(self):
        manifest=json.loads(self.text('frontend/src/legacy/manifest.json'))
        files=[name for group in manifest['groups'] for name in group['files']]
        self.assertEqual(files[-1], '19-human-conversation-tuning.legacy.js')

    def test_runtime_has_reference_correction_and_tool_first_rules(self):
        src=self.text('frontend/src/legacy/19-human-conversation-tuning.legacy.js')
        for token in (
            'function optionMatch(', 'function resolveReferences(', 'function evolveGoal(',
            'function isCorrection(', 'function isFollowUp(', 'function toolHints(',
            '직전 해석의 부분 수정', '도구로 확인', '같은 질문을 반복하지 마세요',
            "'두번째':1", "'세번째':2", "'네번째':3", '전체(?:로)?'
        ):
            self.assertIn(token, src)

    def test_unified_agent_calls_human_tuning_and_defaults_to_operator(self):
        src=self.text('frontend/src/legacy/18-unified-ai-agent.legacy.js')
        self.assertIn("HumanConversationTuning.enrichPrompt", src)
        self.assertIn("opts.forcePlainChat!==true", src)
        self.assertIn("AIChat.operatorMode=true", src)
        self.assertNotIn("/^(취소|그만|아니|아니야", src)

    def test_typed_conversation_state_keeps_turns_and_corrections(self):
        src=self.text('frontend/src/ts/features/agent.ts')
        for token in (
            'export interface ConversationTurn', 'export interface ReferenceResolution',
            'export function isCorrection', 'export function isFollowUp',
            'export function evolveGoal', 'recordTurn(', 'corrections:'
        ):
            self.assertIn(token, src)

if __name__=='__main__': unittest.main()
