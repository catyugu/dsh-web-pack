"""Extract the inline portrait-CSS array out of mobile-adapt.ts into a CSS file.

The array is the single source of the injected stylesheet; moving it to a real
CSS file keeps the rule comments (they explain non-obvious workarounds) while
the TypeScript module keeps only behavior. Run once from the repository root:

    uv run python scripts/extract-mobile-css.py
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "packages" / "dsh-remote-web" / "src" / "client" / "mobile-adapt.ts"
TARGET = ROOT / "packages" / "dsh-remote-web" / "src" / "client" / "mobile-adapt.css"

START = "const ADAPT_CSS: readonly string[] = ["
SUBSTITUTIONS = {
    "${ACTIVE_CLASS}": "dsh-remote-portrait",
    "${RAIL_HIDDEN_CLASS}": "dsh-remote-rail-hidden",
    "${WHALE_ID}": "dshRemoteWhale",
    "${HEADER_SEATED_CLASS}": "dsh-remote-header-seated",
    "${HEADER_RESERVE_VAR}": "--dsh-remote-header-actions-reserve",
}


def rule_text(line: str) -> str:
    """Return the CSS inside one array entry, or raise when the line is not one."""
    stripped = line.strip()
    if stripped.startswith("`"):
        body = stripped[1:]
        closing = body.rindex("`")
    elif stripped.startswith("'"):
        body = stripped[1:]
        closing = body.rindex("'")
    else:
        raise ValueError(f"not a string entry: {stripped}")
    text = body[:closing]
    # A template literal's `\"` is a plain quote by the time it reaches the DOM.
    text = text.replace('\\"', '"')
    for token, value in SUBSTITUTIONS.items():
        text = text.replace(token, value)
    return text


def main() -> None:
    lines = SOURCE.read_text(encoding="utf-8").splitlines()
    start = next(index for index, line in enumerate(lines) if line.strip() == START)
    end = next(index for index in range(start + 1, len(lines)) if lines[index].strip() == "]")

    out: list[str] = [
        "/* Portrait-touch adaptation rules, injected while a touch device is in",
        " * portrait. Selector strategy: CSS Modules class names carry their semantic",
        " * name as a stable suffix, so attribute suffix selectors survive official",
        " * rebuilds that only change the hash. Version comments trace rules back to",
        " * the dsh-LAN reference they were ported from. */",
        "",
    ]
    rules = 0
    comment: list[str] = []

    def flush_comment() -> None:
        if not comment:
            return
        out.append("/* " + " ".join(comment) + " */")
        comment.clear()

    for line in lines[start + 1:end]:
        stripped = line.strip()
        if stripped == "":
            flush_comment()
            continue
        if stripped.startswith("//"):
            comment.append(stripped[2:].strip())
            continue
        flush_comment()
        out.append(rule_text(line))
        rules += 1
    flush_comment()

    TARGET.write_text("\n".join(out) + "\n", encoding="utf-8")
    print(f"wrote {rules} rules to {TARGET.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
