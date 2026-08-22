from __future__ import annotations
from typing import Any
from .. import compat_runtime as runtime


def status() -> Any:
    return runtime.call_mcp_tool("automation.status", {})


def list_tasks() -> Any:
    return runtime.call_mcp_tool("automation.task_list", {})
