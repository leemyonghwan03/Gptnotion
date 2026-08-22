# GptNotion v3.3.1 Human Conversation Tuning

## Goal

Make every AI entry point behave like one conversational work partner rather than a command parser.

The user may use short, incomplete, colloquial Korean such as:

- `숙박비만`
- `아니 국내 말고 국외`
- `전체로`
- `두번째`
- `둘다`
- `그걸로`
- `아까 그거 계속`
- `이거 왜 안돼?`

The agent should preserve the ongoing goal, resolve references from current app context and recent conversation, use tools before asking the user to repeat information, and ask only when a decision materially changes the result.

## Runtime changes

- Shared conversation memory across topbar / chat / page AI / selection AI.
- Bounded recent-turn memory (16 turns) and bounded goal/correction history.
- Follow-up detection keeps short replies attached to the current goal.
- Correction handling updates only the misunderstood part instead of resetting the conversation.
- Natural clarification answers: ordinal (`2번`, `두번째`), scope (`전체로`, `현재로`), default (`그걸로`), multi-select (`둘다`).
- Reference resolver for current page, selected text and previous goal (`이거`, `여기`, `그거`, `아까`, `방금`, `그 결과`).
- Tool-first hints for RAG/search, page/selection, write actions, diagnostics and recent/history queries.
- Unified AI defaults to Operator mode so conversational requests can actually use tools and act instead of only returning text.
- Human-conversation policy is added on top of the existing safety/approval rules. Destructive or high-impact writes still use the established approval flow.

## Verification

### Human conversation benchmark

30/30 scenarios passed (100%). The suite covers:

- 6 correction forms
- 7 follow-up forms
- explicit new-goal separation
- ordinal/default/all/scope clarification answers
- goal evolution
- current-page / selection / previous-goal references
- RAG/page/write/diagnostic/history tool-first hints

### Chromium

- Unified AI browser smoke: PASS
- Human conversation browser smoke: PASS
- Existing reliability browser smoke: PASS
- Large RAG lazy/LRU browser smoke: PASS

### Stability / RAG

- Quick soak: 3,741 operations, 188 RAG searches, FD growth 0, thread growth 0.
- 100,000 chunks: index 2.60 s, retrieval p50 11.93 ms, p95 18.77 ms, synthetic target Top-1.
- RAG quality smoke: 20/20, Top-1/Top-3/Top-5 100% on the synthetic regression set.
- MCP restart recovery / HTTP smoke / release smoke: PASS.

These synthetic conversation/RAG results are regression guards, not a claim that arbitrary real-world company conversations or regulations are 100% accurate. Real internal gold-set evaluation remains the next validation step.
