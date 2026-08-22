from __future__ import annotations

FORBIDDEN_TS_BYPASSES = (
    "@ts-ignore", "@ts-nocheck", "as any", ": any", "as unknown as",
)


def compiler_first_policy() -> dict[str, object]:
    return {
        "compilerFirst": True,
        "strictTypeScript": True,
        "forbiddenBypasses": FORBIDDEN_TS_BYPASSES,
        "featureDeletionAsFix": False,
    }
