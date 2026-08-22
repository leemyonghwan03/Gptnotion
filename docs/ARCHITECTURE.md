# Architecture

## Frontend dependency direction

```text
UI
 ↓
Feature
 ↓
Domain / Contract
 ↓
Infrastructure
 ↓
Local MCP / Storage
```

금지 방향: Domain → DOM, Store → UI, RAG Engine → UI, Feature 내부에서 임의 localhost fetch.

## Frontend modules

- `core`: 공통 타입, 오류, 이벤트, 버전
- `contracts`: MCP/RAG 응답 타입 및 런타임 validator
- `domain`: Page / Block / Link / Database / Settings
- `infrastructure`: MCP client / storage / legacy bridge
- `features`: Editor / RAG / AI / Search / Inbox / Export / Automation / Operator / Team
- `ui`: App shell 및 공통 UI 계층
- `app`: Public API 및 bootstrap

## Compatibility strategy

기존 1.1MB급 안정 HTML 로직을 한 번에 TypeScript로 재작성하면 회귀 위험이 크다. 따라서 안정 동작은 `frontend/src/legacy`에 격리하고 주요 기능 경계로 소스 분리한다. 빌더는 원래 script group 순서와 lexical semantics를 보존해 재결합한다.

신규 기능/개선은 TypeScript 모듈에 작성한다. 기존 legacy 기능을 수정해야 할 때는 해당 기능을 TS 모듈로 옮긴 뒤 호환 코드를 제거하는 strangler 방식으로 점진 이전한다.

## MCP

`compat_runtime.py`는 MCP 6.8 + RAG V2.4의 동결 호환 코어다.

신규 기능은 다음 모듈에 추가한다.

```text
gptnotion_mcp/
  db/
  rag/
  ai/
  filesystem/
  documents/
  jobs/
  automation/
  backup/
  security/
  tools/
  server/
```

`tools.registry`는 신규 MCP Tool을 기존 서버에 등록한다. 따라서 앞으로 새 Tool 때문에 대형 `compat_runtime.py`를 계속 수정할 필요가 없다.
