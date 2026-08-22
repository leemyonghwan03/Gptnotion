from __future__ import annotations
from .. import compat_runtime as runtime
from ..tools.registry import install_into_runtime
from ..tools.modular_status import register as register_modular_status
from ..tools.stability import register as register_stability
from ..perf_reliability import install as install_perf_reliability
from ..stabilization_v32 import install as install_stabilization_v32

_REGISTERED = False


def prepare_runtime() -> None:
    global _REGISTERED
    install_perf_reliability(runtime)
    install_stabilization_v32(runtime)
    if not _REGISTERED:
        register_modular_status()
        register_stability(runtime)
        _REGISTERED = True
    install_into_runtime(runtime)


def main() -> None:
    prepare_runtime()
    runtime.main()
