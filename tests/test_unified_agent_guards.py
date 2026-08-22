from __future__ import annotations
import json, unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

class UnifiedAgentGuardTests(unittest.TestCase):
    def text(self, rel: str) -> str:
        return (ROOT/rel).read_text(encoding='utf-8')

    def test_manifest_loads_unified_agent_last(self):
        manifest=json.loads(self.text('frontend/src/legacy/manifest.json'))
        files=[name for group in manifest['groups'] for name in group['files']]
        self.assertEqual(files[-2:], ['18-unified-ai-agent.legacy.js', '19-human-conversation-tuning.legacy.js'])

    def test_agent_keeps_shared_goal_pending_and_context(self):
        src=self.text('frontend/src/legacy/18-unified-ai-agent.legacy.js')
        for token in ('currentGoal:null','pendingQuestion:null','captureContext(source)','const baseOperatorTurn','openUnifiedAIAction=async function'):
            self.assertIn(token,src)
        self.assertIn('관련 Tool로 먼저 확인',src)
        self.assertIn('바로 "모르겠습니다"로 끝내지 않습니다',src)
        self.assertIn('직전 확인 질문에 대한 사용자 답변',src)

    def test_unified_layer_supports_structured_clarification_without_rewriting_operator(self):
        src=self.text('frontend/src/legacy/18-unified-ai-agent.legacy.js')
        self.assertIn('[[GPTN_CLARIFY]]',src)
        self.assertIn('parseCompatClarification',src)
        self.assertIn('const baseOperatorTurn',src)
        self.assertIn('result.clarification=clarification',src)

    def test_typed_agent_contract_exists(self):
        src=self.text('frontend/src/ts/features/agent.ts')
        tsconfig=json.loads(self.text('frontend/tsconfig.json'))
        self.assertIn("export type AgentSource",src)
        self.assertIn('export interface AgentRequest',src)
        self.assertIn('export class ConversationState',src)
        self.assertIn('src/ts/features/agent.ts',tsconfig['files'])

if __name__=='__main__': unittest.main()
