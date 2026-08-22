from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Callable

Handler = Callable[[dict[str, Any]], Any]

@dataclass(frozen=True)
class ToolExtension:
    name: str
    title: str
    description: str
    input_schema: dict[str, Any]
    handler: Handler

_EXTENSIONS: dict[str, ToolExtension] = {}
_INSTALLED = False


def register_tool(extension: ToolExtension) -> None:
    if not extension.name.strip():
        raise ValueError("MCP tool extension name is required")
    if extension.name in _EXTENSIONS:
        raise ValueError(f"Duplicate modular MCP tool: {extension.name}")
    _EXTENSIONS[extension.name] = extension


def list_extensions() -> tuple[ToolExtension, ...]:
    return tuple(_EXTENSIONS[name] for name in sorted(_EXTENSIONS))


def install_into_runtime(runtime: Any) -> None:
    global _INSTALLED
    if _INSTALLED:
        return
    base_call = runtime.call_mcp_tool
    for ext in list_extensions():
        runtime.MCP_TOOLS.append({
            "name": ext.name,
            "title": ext.title,
            "description": ext.description,
            "inputSchema": ext.input_schema,
        })
    runtime.MCP_TOOLS.sort(key=lambda row: row.get("name", ""))
    runtime.MCP_TOOL_MAP = {row["name"]: row for row in runtime.MCP_TOOLS}

    def modular_call(name: str, args: dict[str, Any]) -> Any:
        ext = _EXTENSIONS.get(name)
        if ext is not None:
            return ext.handler(args or {})
        return base_call(name, args)

    runtime.call_mcp_tool = modular_call
    _INSTALLED = True
