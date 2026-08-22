# GptNotion Modular MCP

`gptnotion_mcp/compat_runtime.py`는 MCP 6.8 / RAG V2.4의 안정 동작을 보존하는 호환 코어다.
신규 기능은 `db/`, `rag/`, `ai/`, `filesystem/`, `documents/`, `jobs/`, `automation/`, `backup/`, `security/`, `tools/`에 추가한다.
신규 MCP Tool은 `tools.registry`에 등록하고 `server.app.prepare_runtime()`이 기존 Tool 목록과 안전하게 결합한다.

실행:

```bat
python main.py
```
