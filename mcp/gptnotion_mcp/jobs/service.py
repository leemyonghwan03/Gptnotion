from __future__ import annotations
from typing import Any
from .. import compat_runtime as runtime


def status() -> Any:
    return runtime.call_mcp_tool("agent.job_list", {})
