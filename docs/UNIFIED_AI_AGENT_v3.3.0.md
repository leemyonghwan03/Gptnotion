# GptNotion v3.3.0 Unified AI Agent

Base: `stabilization-v3.2.0`
Target branch: `unified-ai-agent-v3.3.0`

## Goal

All primary AI entry points share one conversation state and one tool-using Agent behavior instead of acting like separate prompt boxes.

## Unified entry points

- Topbar `✨ AI`
- Right-side AI chat
- Selection AI
- Current-page AI

Topbar/selection/page AI now open the same AI panel and preserve the entry context rather than forcing the user into unrelated modal flows.

## Conversation state

The browser Agent keeps:

- conversation ID
- current goal
- pending clarification
- current page/view
- selected block IDs
- selected text
- entry source

Short answers such as `2번`, `전체 자료실`, or an option label are interpreted as answers to the previous clarification and resume the original goal.

## Tool-first policy

The Operator prompt now explicitly requires the Agent to use available workspace tools before giving up on page/RAG/database/file/recent-work facts. Pronouns such as `이거`, `여기`, `현재`, and `방금 것` are resolved against current context and recent conversation first.

If ambiguity can be resolved with search/read/resolve tools, the Agent should use those tools instead of asking the user. A clarification is allowed only when one missing choice materially changes the result.

## Clarification UX

The Operator protocol supports:

```json
{"type":"clarify","question":"...","options":["...","..."],"reason":"..."}
```

The AI panel renders quick-reply buttons, while the user can also answer naturally in the same input box.

## Safety

Existing destructive-action approval, transaction, rollback, provenance, integrity, selection-staleness, and permission policies remain in force. Unified Agent changes routing and conversational context; it does not bypass those controls.

## Verification

- forbidden-pattern scan: PASS
- TypeScript strict: PASS
- legacy JavaScript syntax: PASS
- unit/guard tests: 18 PASS
- browser smoke: PASS
- browser reliability: PASS
- Unified Agent browser smoke: PASS
- 100K lazy RAG browser smoke: PASS
- stability tools: PASS
- SQLite query-plan: PASS
- MCP restart recovery: PASS
- synthetic RAG quality 20/20 Top-1/3/5: PASS
- accelerated soak: PASS
- MCP HTTP: PASS
- 100K RAG: PASS
- release build/smoke: PASS

Latest 100K verification in this environment: index ~3.41 s, p50 ~10.85 ms, p95 ~32.41 ms, synthetic special target Top-1.
