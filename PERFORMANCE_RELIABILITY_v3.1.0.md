# GptNotion v3.1.0 Performance / Reliability Audit

## Branch

`perf-reliability-v3.1.0`

Base: `baseline-v3.0.0-modular`

## Reliability fixes

- IndexedDB multi-store batch now uses one read/write transaction.
- Page/block/inbox/database updates persist before mutating in-memory cache.
- Block + backlink deletion is atomic.
- Database + column + row deletion is atomic.
- Column removal updates affected rows atomically.
- A duplicated page receives an independent embedded database, columns and rows; row value keys are remapped to the new column IDs.
- RAG chat prevents duplicate submit and reset races while a response is running.
- AI streaming no longer replays authentication, permission, rate-limit or server failures as duplicate non-streaming requests.
- MCP adapter fallback is limited to protocol-mismatch HTTP statuses.
- Release launcher waits for the real MCP `/health` response instead of sleeping for a fixed two seconds.

## RAG / SQLite performance

Synthetic 100,000-chunk benchmark, three-run representative medians:

| Metric | v3.0 baseline | v3.1 | Change |
| --- | ---: | ---: | ---: |
| Full RAG index rebuild | ~3.49 s | ~2.39 s | ~31% faster |
| Retrieval p50 | ~9.74 ms | ~8.55 ms | ~12% faster |
| Retrieval p95 | ~22.55 ms | ~13.40 ms | ~41% faster |

Final verification run: index 2.41 s, p50 9.25 ms, p95 15.02 ms, correct synthetic target ranked Top-1.

The full rebuild path avoids 100K per-row existence checks, batches catalog inserts with `executemany`, rebuilds FTS once after catalog creation, and reuses precompiled regulation structure regular expressions. Incremental update behavior remains separate.

## Verification

`verify-all.sh` passed after the final changes:

- forbidden-pattern scan: PASS
- TypeScript strict typecheck: PASS
- contract validation: PASS
- legacy JavaScript syntax: PASS
- Python/unit reliability tests: PASS
- MCP modular smoke: PASS
- source integrity: PASS
- single-file frontend build: PASS
- build integrity: PASS
- Chromium browser smoke: PASS
- Chromium reliability scenarios: PASS
- MCP HTTP smoke: PASS
- 100K RAG smoke: PASS
- release build/smoke: PASS

Browser reliability scenarios explicitly verified independent database duplication, cache consistency after a forced storage failure, RAG chat concurrency protection, and one-request behavior for AI HTTP 401.

## Dependencies

No new required Python library was added.

## Repository strategy

The frozen v3.0 full source archive remains the recovery baseline. This branch tracks the v3.1 changed files directly for review/diff plus the modular performance/reliability extension. Generated `dist/` and `release/` outputs are intentionally not committed.
