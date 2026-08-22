from __future__ import annotations
from typing import Any
from ..config import APP_VERSION, MCP_VERSION, RAG_VERSION, CONTRACT_VERSION, BASELINE
from .registry import ToolExtension, register_tool


def _status(_: dict[str, Any]) -> dict[str, Any]:
    return {
        "ok": True,
        "architecture": "typescript-frontend + modular-python-mcp + compatibility-core",
        "appVersion": APP_VERSION,
        "mcpVersion": MCP_VERSION,
        "ragVersion": RAG_VERSION,
        "contractVersion": CONTRACT_VERSION,
        "baseline": BASELINE,
        "compilerFirst": True,
        "legacyCoreFrozen": True,
    }


def register() -> None:
    register_tool(ToolExtension(
        name="system.modular_status",
        title="GptNotion Modular Architecture Status",
        description="모듈화/계약/버전 상태를 반환합니다.",
        input_schema={"type": "object", "properties": {}, "additionalProperties": False},
        handler=_status,
    ))
