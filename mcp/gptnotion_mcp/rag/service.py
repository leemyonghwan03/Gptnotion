from __future__ import annotations
from typing import Any
from .. import compat_runtime as runtime


def hybrid_search(query: str, *, limit: int = 12, search_mode: str = "fast", **options: Any) -> Any:
    args: dict[str, Any] = {"query": query, "limit": limit, "searchMode": search_mode, **options}
    if search_mode == "fast":
        args.setdefault("allowRemoteEmbedding", False)
        args.setdefault("adaptiveRerank", False)
    return runtime.call_mcp_tool("rag.hybrid_search", args)


def status() -> Any:
    return runtime.call_mcp_tool("rag.large_status", {})


def optimize(*, full: bool = False, build_missing_vectors: bool = False) -> Any:
    return runtime.call_mcp_tool("rag.optimize_index", {"full": full, "buildMissingVectors": build_missing_vectors})


def benchmark(query: str, *, repeat: int = 5, limit: int = 12) -> Any:
    return runtime.call_mcp_tool("rag.benchmark_search", {"query": query, "repeat": repeat, "limit": limit, "parentExpansion": False})
