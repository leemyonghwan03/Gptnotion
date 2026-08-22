# Future Feature / Optimization Rules

1. 신규 Frontend 기능은 `frontend/src/ts`에 작성한다.
2. 신규 MCP 기능은 `mcp/gptnotion_mcp` 하위 적절한 도메인 모듈에 작성한다.
3. MCP 신규 Tool은 `tools.registry`를 사용한다.
4. legacy 파일에 기능을 누적하지 않는다.
5. 기존 legacy 기능을 크게 수정해야 하면 그 기능 경계를 TS로 먼저 이동한다.
6. Frontend가 MCP endpoint를 직접 `fetch`하지 않고 `Infrastructure.McpClient`를 사용한다.
7. RAG 기본 검색은 FAST이며 외부 embedding/rerank를 hot path에 강제하지 않는다.
8. 모든 변경 후 `check.bat`; Release 전 `verify-all.bat`.
9. `build.bat`이 실패한 산출물은 배포하지 않는다.
10. 최종 Frontend 배포물은 계속 `GptNotion.html` 단일 파일로 유지한다.
