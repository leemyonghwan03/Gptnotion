from __future__ import annotations
from .. import compat_runtime as runtime
from ..tools.registry import install_into_runtime
from ..tools.modular_status import register as register_modular_status

_REGISTERED = False


def prepare_runtime() -> None:
    global _REGISTERED
    if not _REGISTERED:
        register_modular_status()
        _REGISTERED = True
    install_into_runtime(runtime)


def main() -> None:
    prepare_runtime()
    runtime.main()
