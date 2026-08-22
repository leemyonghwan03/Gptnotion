# GptNotion Modular Migration Policy

- 기준선은 baseline/ 폴더의 RAG V2.4 FAST PATH + MCP 6.8이다.
- 기존 기능을 삭제하거나 동작을 바꾸는 방식으로 컴파일 오류를 해결하지 않는다.
- TypeScript 신규/개선 코드는 strict 검사를 통과해야 한다.
- 금지: @ts-ignore, @ts-nocheck, `as any`, 명시적 `: any`, strict 완화, tsconfig exclude를 이용한 오류 은폐.
- 기존 대형 JavaScript는 위험한 전면 재작성 대신 `frontend/src/legacy` 호환 계층으로 격리하고 빌드시 원래 순서로 재결합한다.
- 이후 기능 개선은 원칙적으로 TypeScript 모듈 또는 Python 모듈에 추가한다. compat_runtime.py와 legacy JS는 회귀 수정/이전 작업 외에는 직접 확장하지 않는다.
- Python MCP는 compat_runtime을 보존한 채 모듈형 facade/extension registry를 통해 신규 기능을 확장한다.
- `check.bat` 실패 상태는 완료로 인정하지 않는다. `build.bat`은 check 통과 후에만 release 산출물을 만든다.
