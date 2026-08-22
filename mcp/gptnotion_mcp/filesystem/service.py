from __future__ import annotations
from typing import Any
from .. import compat_runtime as runtime


def roots() -> Any:
    return runtime.call_mcp_tool("filesystem.roots_list", {})


def search(query: str, root_id: str | None = None, limit: int = 100) -> Any:
    args: dict[str, Any] = {"query": query, "limit": limit}
    if root_id:
        args["rootId"] = root_id
    return runtime.call_mcp_tool("filesystem.search", args)
