# GptNotion Modular TS v3.0.0

기준선: **RAG V2.4 FAST PATH / Local MCP 6.8**

이 프로젝트는 기존 단일 대형 HTML/Python 런타임의 기능을 보존하면서 앞으로의 기능 추가·최적화를 모듈 단위로 관리하기 위한 전환 구조다.

## 핵심 원칙

- Frontend 신규/개선 코드: **TypeScript strict**
- MCP: **Python 모듈** + 안정된 MCP 6.8 호환 코어
- DB: SQLite / IndexedDB 기존 정책 보존
- RAG: V2.4 100K FAST PATH 보존
- 배포 Frontend: `GptNotion.html` 단일 파일
- 인터넷/CDN 필수 의존성 없음
- 컴파일 오류 우회 금지
- `check.bat` 실패 시 `build.bat`이 빌드하지 않음
- 전체 검증은 `verify-all.bat`

## Windows

```bat
check.bat
build.bat
verify-all.bat
release.bat
```

`build.bat` 결과:

```text
frontend\dist\GptNotion.html
```

`release.bat` 결과:

```text
release\GptNotion_3.0.0-modular\
release\GptNotion_3.0.0-modular.zip
```

## Linux

Windows BAT과 동일한 검증 체계를 확인할 수 있도록 `.sh`도 제공한다.

```bash
./check.sh
./build.sh
./verify-all.sh
./release.sh
```

## 구조

```text
frontend/src/ts/       신규 TypeScript 모듈
frontend/src/legacy/   동작 보존용 기존 JS 호환 모듈(소스 분리)
mcp/gptnotion_mcp/    Python MCP 모듈
contracts/             Frontend ↔ MCP 계약
tests/                 컴파일/무결성/MCP/브라우저/100K RAG 검증
tools/                 빌드/검사/단일 HTML 번들러
baseline/              동결된 기준본
```

기존 JS는 위험한 일괄 재작성 대신 52개 주요 기능 구간 + 기존 후속 패치 스크립트로 소스 분리하고, 빌드시 원래 스크립트 실행 의미를 보존하도록 재결합한다. 신규 기능은 원칙적으로 TypeScript/Python 모듈에 추가한다.
