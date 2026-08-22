from __future__ import annotations
from typing import Any
from .. import compat_runtime as runtime


def capabilities() -> Any:
    return runtime.call_mcp_tool("document.capabilities", {})


def extract(path: str, **options: Any) -> Any:
    return runtime.call_mcp_tool("document.extract", {"path": path, **options})
