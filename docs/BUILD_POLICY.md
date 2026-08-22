# Compiler First Build Policy

## 완료 조건

`check.bat` 또는 `check.sh`가 PASS하지 않으면 작업 완료가 아니다.

## 금지

- `@ts-ignore`
- `@ts-nocheck`
- `as any`
- 명시적 `: any`
- `as unknown as ...`
- `strict: false`
- `noImplicitAny: false`
- `strictNullChecks: false`
- `skipLibCheck: true`
- 문제 파일을 tsconfig exclude에 넣어 오류 숨기기
- 기능 삭제로 컴파일 성공시키기

## build.bat

1. 금지 우회 검사
2. TypeScript strict compile
3. Contract JSON 검사
4. 기존 JS script group syntax 검사
5. Python compile
6. Unit tests
7. MCP modular smoke
8. Source integrity
9. TypeScript emit
10. 단일 HTML 생성
11. Build artifact 검사

## verify-all.bat

`build.bat`에 더해 Browser runtime smoke, MCP HTTP smoke, 100K RAG benchmark, Release ZIP 검사를 실행한다.
