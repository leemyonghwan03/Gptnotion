from __future__ import annotations
from typing import Any
from .. import compat_runtime as runtime


def chat(payload: dict[str, Any]) -> Any:
    return runtime.gateway_chat(payload)


def models(payload: dict[str, Any]) -> Any:
    return runtime.model_models_list(payload)


def probe(payload: dict[str, Any]) -> Any:
    return runtime.model_probe(payload)
