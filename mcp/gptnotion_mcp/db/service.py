from __future__ import annotations
from typing import Any
from .. import compat_runtime as runtime


def stats() -> dict[str, Any]:
    result = runtime.call_mcp_tool("sqlite.stats", {})
    return result if isinstance(result, dict) else {"result": result}


def backup() -> Any:
    return runtime.call_mcp_tool("sqlite.backup", {})


def integrity_check() -> Any:
    try:
        return runtime.call_mcp_tool("sqlite.integrity_check", {})
    except Exception:
        with runtime.connect() as con:
            row = con.execute("PRAGMA integrity_check").fetchone()
        return {"ok": bool(row and row[0] == "ok"), "result": row[0] if row else "unknown"}
