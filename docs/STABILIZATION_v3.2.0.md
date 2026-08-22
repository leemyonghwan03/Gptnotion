# GptNotion v3.2.0 Stabilization

Base branch: `perf-reliability-v3.1.0`
Target branch: `stabilization-v3.2.0`

## Goals

- Push automated operational-readiness coverage toward ~90%.
- Preserve existing features and UI behavior.
- Add measurable guards for large RAG, restart recovery, SQLite query plans, long-running resource growth, and retrieval quality.

## Key fixes

1. Fixed FTS5 BM25 score-direction bug. SQLite FTS5 `bm25()` ranks better matches with smaller/more-negative values; the old fallback score used `abs(rank)` and could rank near-zero irrelevant matches above strong matches.
2. Added large-library lazy RAG chunk loading. In Local SQLite mode, more than 12,000 RAG chunks are no longer bootstrapped into Chrome at startup.
3. Added a bounded browser RAG chunk resident set (`maxResident=7000`) with request coalescing and document-level eviction.
4. Added `rag.document_chunks` for indexed document-scoped chunk paging and `rag.document_purge` for document-scoped chunk/embedding/index removal without loading the full vector library into the browser.
5. Added `system.stability_status` with uptime, process RSS where supported, thread count, SQLite quick check, DB size and store counts.
6. Unified v3.2 version metadata across TypeScript, Python/MCP, package metadata and release metadata.

## Current measured results

- 100K full index median ~2.55 s in the stabilization environment.
- Retrieval p50 ~11 ms, p95 ~17.5 ms representative median.
- 100K metadata-only browser bootstrap ~11.7 KB.
- Synthetic regulation quality set: Top-1/Top-3/Top-5 = 100% / 100% / 100%, MRR = 1.0.
- Accelerated soak showed FD growth 0 and thread growth 0.

These are synthetic/local measurements, not claims about every office PC or real business-data recall.

## Operator commands

- `verify-all.bat`
- `stability-quick.bat`
- `soak-24h.bat`
