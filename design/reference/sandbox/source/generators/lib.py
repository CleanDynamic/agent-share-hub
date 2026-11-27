"""Shared drawing pieces for the structured-sandbox canvas."""
import os, re

ROOT = "/mnt/user-data/outputs/artifacts/2b62c948/project"
os.makedirs(ROOT, exist_ok=True)
GEIST = "/_blob/892e988e002169cfe0b7b64b8ebf2104"
MONO = "/_blob/b1b554415468c74abd124c7e0c720d61"

PAGE, SURF, MOD, RAISED = "#0F0F10", "#141416", "#1E1E21", "#27272B"
HAIR, HAIRM, EDGE = "#232327", "#2A2A2E", "#303035"
TX, TX2, LAB = "#EDEDEF", "#A0A0A6", "#8E8E94"
BG = "#3A3D3B"
INK, INK2, INK3 = "#F2F3F2", "#D2D5D3", "#B3B7B4"
MINT, AMB = "#6BE2A0", "#E8B86B"
MF = "font-family:'Geist Mono',monospace"


def page(name, title, w, h, body, bg=SURF):
    html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<style>
@font-face{{font-family:Geist;src:url({GEIST}) format("woff2");font-weight:100 900}}
@font-face{{font-family:"Geist Mono";src:url({MONO}) format("woff2");font-weight:100 900}}
body{{margin:0}}
</style>
</helmet>
<div style="width:{w}px;height:{h}px;box-sizing:border-box;background:{bg};color:{TX};font-family:Geist,sans-serif;position:relative;overflow:hidden">
{body}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":{w},"height":{h}}}}}'>
class Component extends DCLogic {{
renderVals() {{ return {{}}; }}
}}
</script>
</body>
</html>
"""
    open(os.path.join(ROOT, name), "w").write(html)


def A(x, y, inner, w=None, h=None, style=""):
    wh = (f"width:{w}px;" if w is not None else "") + (f"height:{h}px;" if h is not None else "")
    return f'<div style="position:absolute;left:{x}px;top:{y}px;{wh}{style}">{inner}</div>'


def T(x, y, text, size=13, col=TX2, w=None, weight=400, mono=False, lh=1.45, extra=""):
    ff = MF + ";" if mono else ""
    ww = f"width:{w}px;" if w else "white-space:nowrap;"
    return f'<div style="position:absolute;left:{x}px;top:{y}px;{ww}{ff}font-size:{size}px;font-weight:{weight};color:{col};line-height:{lh};{extra}">{text}</div>'


def H(x, y, text, w=1300):
    return T(x, y, text, 26, TX, w, 600, lh=1.25, extra="letter-spacing:-0.01em")


def sub(x, y, text, w=1300):
    return T(x, y, text, 15, TX2, w, lh=1.5)


def label(x, y, text, w=None):
    return T(x, y, text, 13, TX, w, 600)


def svg(w, h, inner, x=0, y=0):
    return f'<svg aria-hidden="true" width="{w}" height="{h}" viewBox="0 0 {w} {h}" style="position:absolute;left:{x}px;top:{y}px;overflow:visible" fill="none">{inner}</svg>'


def _ends(d):
    n = [float(v) for v in re.findall(r"-?\d+(?:\.\d+)?", d)]
    # walk M/H/V to find last point and the direction of the last segment
    x = y = 0.0
    px = py = 0.0
    for cmd, a, b in re.findall(r"([MHVL])\s*(-?[\d.]+)(?:\s+(-?[\d.]+))?", d):
        px, py = x, y
        if cmd in "ML":
            x, y = float(a), float(b)
        elif cmd == "H":
            x = float(a)
        else:
            y = float(a)
    return (n[0], n[1]), (x, y), (px, py)


def head(x, y, fx, fy, col):
    if abs(x - fx) > abs(y - fy):
        s = 1 if x > fx else -1
        return f'<path d="M{x - 7 * s} {y - 4}L{x} {y}L{x - 7 * s} {y + 4}" stroke="{col}" stroke-width="1.3"></path>'
    s = 1 if y > fy else -1
    return f'<path d="M{x - 4} {y - 7 * s}L{x} {y}L{x + 4} {y - 7 * s}" stroke="{col}" stroke-width="1.3"></path>'


def line(d, col=INK2, dash=False, end=True, start_dot=True, both=False, width=1.3):
    (x1, y1), (x2, y2), (px, py) = _ends(d)
    da = ' stroke-dasharray="4 4"' if dash else ""
    out = f'<path d="{d}" stroke="{col}" stroke-width="{width}"{da}></path>'
    if end:
        out += head(x2, y2, px, py, col)
    if both:
        # second point of path, for the start head's direction
        pts = re.findall(r"([MHVL])\s*(-?[\d.]+)(?:\s+(-?[\d.]+))?", d)
        c, a, b = pts[1]
        nx, ny = (float(a), y1) if c == "H" else ((x1, float(a)) if c == "V" else (float(a), float(b)))
        out += head(x1, y1, nx, ny, col)
    elif start_dot:
        out += f'<circle cx="{x1}" cy="{y1}" r="2.4" fill="{col}"></circle>'
    return out


def canvas(x, y, w, h, inner, bg=BG, r=10, extra=""):
    return f'<div style="position:absolute;left:{x}px;top:{y}px;width:{w}px;height:{h}px;border-radius:{r}px;background:{bg};overflow:hidden;{extra}">{inner}</div>'


def box(x, y, w, h, title="", meta="", fill="rgba(255,255,255,.045)", border="1px solid #5E635F", r=8, extra="", tcol=INK, tsize=12):
    t = (f'<div style="position:absolute;left:10px;top:8px;right:10px;display:flex;justify-content:space-between;gap:8px;white-space:nowrap">'
         f'<span style="font-size:{tsize}px;font-weight:600;color:{tcol};overflow:hidden;text-overflow:ellipsis">{title}</span>'
         f'<span style="{MF};font-size:10px;color:{INK3}">{meta}</span></div>') if (title or meta) else ""
    return f'<div style="position:absolute;left:{x}px;top:{y}px;width:{w}px;height:{h}px;box-sizing:border-box;border-radius:{r}px;border:{border};background:{fill};{extra}">{t}</div>'


def chip(x, y, num, text="", w=None, h=26, hl=False, extra=""):
    """A small tile, in the live tile's paint: Card #1B1F1C radius 8, a round number badge, the title."""
    ww = f"width:{w}px;" if w else ""
    sh = f"box-shadow:0 0 0 1.5px {MINT};" if hl else ""
    bd = max(16, min(20, h - 8))
    return (f'<div style="position:absolute;left:{x}px;top:{y}px;{ww}height:{h}px;box-sizing:border-box;border-radius:8px;background:#1B1F1C;'
            f'display:flex;align-items:center;gap:6px;padding:0 7px 0 4px;white-space:nowrap;overflow:hidden;{sh}{extra}">'
            f'<span style="{MF};flex-shrink:0;min-width:{bd}px;height:{bd}px;border-radius:{bd // 2}px;background:#242925;font-size:9.5px;color:#A4AAA5;display:flex;align-items:center;justify-content:center;padding:0 3px;box-sizing:border-box">{num}</span>'
            f'<span style="font-size:11px;font-weight:600;color:#EDEFEC;overflow:hidden;text-overflow:ellipsis">{text}</span></div>')


def frame(x, y, w, h, name, dashed=False, col="rgba(242,243,242,.7)"):
    st = "dashed" if dashed else "solid"
    return (f'<div style="position:absolute;left:{x}px;top:{y}px;width:{w}px;height:{h}px;box-sizing:border-box;border-radius:12px;border:1.5px {st} {col}"></div>'
            f'<div style="position:absolute;left:{x + 12}px;top:{y - 11}px;height:20px;padding:0 8px;border-radius:5px;background:{INK};color:#141416;font-size:11px;font-weight:600;display:flex;align-items:center;white-space:nowrap">{name}</div>')


def ok(x, y, text, w=380):
    return (f'<div style="position:absolute;left:{x}px;top:{y}px;width:{w}px;display:flex;gap:8px;align-items:flex-start;font-size:13px;color:{TX};line-height:1.45">'
            f'<span style="flex-shrink:0;width:18px;height:18px;border-radius:50%;background:rgba(107,226,160,.16);color:{MINT};display:flex;align-items:center;justify-content:center;font-size:11px;margin-top:1px">✓</span><span>{text}</span></div>')


def no(x, y, text, w=380):
    return (f'<div style="position:absolute;left:{x}px;top:{y}px;width:{w}px;display:flex;gap:8px;align-items:flex-start;font-size:13px;color:{TX};line-height:1.45">'
            f'<span style="flex-shrink:0;width:18px;height:18px;border-radius:50%;background:rgba(232,184,107,.16);color:{AMB};display:flex;align-items:center;justify-content:center;font-size:11px;margin-top:1px">✕</span><span>{text}</span></div>')


def msg(x, y, text, col=AMB, size=12):
    return (f'<div style="position:absolute;left:{x}px;top:{y}px;height:28px;padding:0 10px;border-radius:7px;background:#141416;box-shadow:0 0 0 1px {col},0 8px 20px rgba(0,0,0,.45);'
            f'display:flex;align-items:center;font-size:{size}px;color:#EDEFEC;white-space:nowrap;z-index:3">{text}</div>')


def panel(x, y, w, h, inner):
    return f'<section style="position:absolute;left:{x}px;top:{y}px;width:{w}px;height:{h}px;box-sizing:border-box;border-radius:14px;background:{MOD};border:1px solid {HAIRM}">{inner}</section>'


def pill(x, y, text, on=False):
    return (f'<div style="position:absolute;left:{x}px;top:{y}px;height:28px;padding:0 11px;border-radius:7px;background:{MINT if on else RAISED};'
            f'color:{"#040504" if on else TX};font-size:12.5px;font-weight:{600 if on else 400};display:flex;align-items:center;white-space:nowrap">{text}</div>')


def arrow_r(x, y, w=40):
    return svg(w, 12, f'<path d="M0 6H{w - 2}M{w - 8} 1l6 5-6 5" stroke="{TX2}" stroke-width="1.4"></path>', x, y)


# ---- the live step tile (BuildList / tileRecipes), measured on the running app, dusk ----
TL = dict(module="#1B1F1C", control="#242925", border="#2A2F2B", text="#EDEFEC", text2="#A4AAA5", label="#8C938E", well="#121513", hair="#262B27", mint="#6BE2A0", green="#86D193")
TILE_H = {"prompt": 113, "file": 118, "code": 145, "check": 148, "agent": 140, "tool": 118, "result": 118}


def tile(x, y, w, num, kind, eyebrow, title, body="", code=None, foot="", status=None, criteria=None, hl=False, extra="", settings=None, h=None):
    """A step tile exactly as the List draws it: Card #1B1F1C, radius 12, padded 12 14, parts 8 apart; a round 24 number
    badge (mono 13), the eyebrow 13 label above the title 15/600; then the body, a code well, or a check's lines; a mono foot."""
    T = TL
    if kind == "result":
        mark = (f'<span style="flex-shrink:0;width:24px;height:24px;border-radius:7px;background:rgba(107,226,160,.16);display:flex;align-items:center;justify-content:center">'
                f'<svg width="12" height="12" viewBox="0 0 12 12"><path d="M2.5 6.2l2.3 2.3 4.7-5" stroke="{T["mint"]}" stroke-width="1.6" fill="none"/></svg></span>')
    else:
        mark = (f'<span style="flex-shrink:0;min-width:24px;height:24px;border-radius:12px;background:{T["control"]};{MF};font-size:13px;color:{T["text2"]};'
                f'display:flex;align-items:center;justify-content:center;padding:0 4px;box-sizing:border-box">{num}</span>')
    head = (f'<div style="display:flex;gap:8px;align-items:flex-start;min-width:0">{mark}'
            f'<div style="display:flex;flex-direction:column;flex-grow:1;min-width:0"><span style="font-size:13px;line-height:17px;color:{T["label"]};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{eyebrow}</span>'
            f'<span style="font-size:15px;font-weight:600;line-height:20px;color:{T["text"]};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{title}</span></div>'
            f'<span style="flex-shrink:0;width:26px;height:24px;display:flex;align-items:center;justify-content:center;color:{T["label"]};font-size:14px;letter-spacing:1px">···</span></div>')
    parts = ""
    if criteria:
        parts += f'<div style="font-size:15px;line-height:22px;color:{T["text"]};white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><span style="font-size:13px;color:{T["text2"]}">Pass criteria: </span>{criteria}</div>'
    if status:
        parts += f'<div style="display:flex;align-items:center;gap:7px;font-size:15px;line-height:22px;color:{T["text"]}"><span style="width:7px;height:7px;border-radius:50%;background:{T["green"]}"></span>{status}</div>'
    if body:
        parts += f'<div style="font-size:15px;line-height:22px;color:{T["text"]};display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">{body}</div>'
    if code:
        lines = code.split("\n")[:3]
        parts += (f'<div style="display:grid;grid-template-columns:28px minmax(0,1fr);background:{T["well"]};border:1px solid {T["border"]};border-radius:8px;padding:8px 0;{MF};font-size:13px;line-height:18px;overflow:hidden">'
                  f'<span style="white-space:pre;text-align:right;padding-right:8px;color:{T["label"]};border-right:1px solid {T["hair"]}">' + "\n".join(str(i + 1) for i in range(len(lines))) + '</span>'
                  f'<pre style="margin:0;padding-left:8px;color:{T["text"]};white-space:pre;overflow:hidden;{MF};font-size:13px;line-height:18px">' + "\n".join(lines) + '</pre></div>')
    if settings:
        parts += (f'<div style="background:{T["well"]};border-radius:10px;overflow:hidden">' + "".join(
            f'<div style="display:flex;justify-content:space-between;gap:12px;padding:8px 12px;{"" if i == 0 else "border-top:1px solid " + T["hair"] + ";"}font-size:13px;line-height:17px">'
            f'<span style="color:{T["text2"]}">{a}</span><span style="{MF};color:{T["text"]}">{b}</span></div>' for i, (a, b) in enumerate(settings)) + '</div>')
    if foot:
        parts += f'<div style="{MF};font-size:13px;line-height:19px;color:{T["label"]};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{foot}</div>'
    ring = f"box-shadow:0 0 0 2px #3A3D3B,0 0 0 4px {T['mint']};" if hl else ""
    return (f'<div style="position:absolute;left:{x}px;top:{y}px;width:{w}px;height:{h or TILE_H.get(kind, 113)}px;box-sizing:border-box;border-radius:12px;background:{T["module"]};'
            f'padding:12px 14px;display:flex;flex-direction:column;gap:8px;overflow:hidden;{ring}{extra}">{head}{parts}</div>')
