from __future__ import annotations
from typing import Any
from .. import compat_runtime as runtime


def create() -> Any:
    return runtime.call_mcp_tool("backup.create", {})


def list_backups() -> Any:
    return runtime.call_mcp_tool("backup.list", {})
