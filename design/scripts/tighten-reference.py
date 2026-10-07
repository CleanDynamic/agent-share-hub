#!/usr/bin/env python3
"""Density pass for the buildgallery.ai reference kit (design/reference/**).

Rewrites the inline style values of every reference board IN PLACE so the kit
becomes the tightened source of truth. Standard library only. Deterministic:
running it twice would tighten twice, so it refuses a file already marked.

Rules (the same ones the design canvas used):
  font-size / px line-height : >=28 x0.75 | 18-27 x0.85 | 14-17 -1 | 13 -> 12 | 10-12 kept | 9 -> 10
  padding / margin / gap     : <6 kept | otherwise round(x0.72), never below 4
  height / min-height        : 20-64 -> round(x0.82); <20 and >64 kept
                               (width too, when width == height: square controls, avatars)
  mobile boards              : an interactive element (a, button, input, select,
                               textarea, label, role=button|tab|link|checkbox)
                               that was >=44 tall stays >=44 (touch target)
  never touched              : the PRESENTATION-ONLY browser frame, widths, radii,
                               colours, positions, grid tracks
Usage: python3 design/scripts/tighten-reference.py [--dry-run]
"""
import re, sys, pathlib

MARK = "<!-- density: tightened (UI-P52) -->"
ROOT = pathlib.Path(__file__).resolve().parents[1] / "reference"
INTERACTIVE_TAGS = {"a", "button", "input", "select", "textarea", "label"}
INTERACTIVE_ROLES = {"button", "tab", "link", "checkbox"}
SPACING = {"padding", "padding-top", "padding-bottom", "padding-left", "padding-right",
           "padding-inline", "padding-block", "gap", "row-gap", "column-gap", "margin",
           "margin-top", "margin-bottom", "margin-left", "margin-right"}

def fs(v):
    if v >= 28: return round(v * 0.75)
    if v >= 18: return round(v * 0.85)
    if v >= 14: return v - 1
    if v == 13: return 12
    if v < 10: return 10
    return v

def sp(v):
    return v if v < 6 else max(4, round(v * 0.72))

def ht(v, mobile, interactive):
    if v < 20 or v > 64: return v
    n = round(v * 0.82)
    if mobile and interactive and v >= 44: n = max(n, 44)
    return n

PX = re.compile(r"(?<![\w.#-])(\d+(?:\.\d+)?)px")

def scale(value, fn):
    def rep(m):
        x = float(m.group(1))
        return m.group(0) if x != int(x) else f"{fn(int(x))}px"
    return PX.sub(rep, value)

def tighten_style(style, mobile, interactive):
    parts = style.split(";")
    props = {}
    for p in parts:
        if ":" in p:
            k, v = p.split(":", 1)
            props[k.strip().lower()] = v.strip()
    square = props.get("width") and props.get("height") and props["width"] == props["height"]
    out = []
    for p in parts:
        if ":" not in p:
            out.append(p); continue
        k, v = p.split(":", 1)
        key = k.strip().lower()
        if key in ("font-size", "line-height"): v = scale(v, fs)
        elif key in SPACING: v = scale(v, sp)
        elif key in ("height", "min-height") or (key == "width" and square):
            v = scale(v, lambda x: ht(x, mobile, interactive))
        out.append(f"{k}:{v}")
    return ";".join(out)

def presentation_spans(text):
    spans = []
    for m in re.finditer(r'data-ui="[^"]*PRESENTATION[^"]*"', text):
        start = text.rfind("<div", 0, m.start())
        depth, i = 0, start
        for t in re.finditer(r"<div\b|</div>", text[start:]):
            depth += 1 if t.group(0) == "<div" else -1
            if depth == 0:
                spans.append((start, start + t.end())); break
    return spans

TAG = re.compile(r'<([a-zA-Z][\w-]*)(\s[^>]*?)?\sstyle="([^"]*)"')

def tighten(text, mobile):
    spans = presentation_spans(text)
    def rep(m):
        if any(a <= m.start() < b for a, b in spans): return m.group(0)
        tag, attrs = m.group(1).lower(), m.group(2) or ""
        role = re.search(r'\srole="([^"]*)"', attrs)
        interactive = tag in INTERACTIVE_TAGS or (role and role.group(1) in INTERACTIVE_ROLES)
        new = tighten_style(m.group(3), mobile, bool(interactive))
        return m.group(0)[: m.start(3) - m.start()] + new + '"'
    return TAG.sub(rep, text)

def main():
    dry = "--dry-run" in sys.argv
    files = sorted(ROOT.glob("**/*.html"))
    changed = 0
    for f in files:
        text = f.read_text()
        if MARK in text:
            print(f"skip (already tightened): {f.relative_to(ROOT)}"); continue
        mobile = "/mobile/" in f.as_posix()
        new = tighten(text, mobile).replace("<head>", "<head>\n" + MARK, 1)
        if new != text:
            changed += 1
            if not dry: f.write_text(new)
            print(f"{'would tighten' if dry else 'tightened'}: {f.relative_to(ROOT)}")
    print(f"{changed} file(s)")

if __name__ == "__main__":
    main()
