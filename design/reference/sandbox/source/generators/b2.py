"""Board 2: the layout is a tree of splits; columns come from shared edges."""
from lib import *
import b1

S = 0.42


def wire(sx=S, hl=True):
    b1.finished()  # fills b1.G
    G = b1.G
    B, x1, x2, cw, y3, yr, y0 = G["B"], G["xS1"], G["xS2"], G["cw"], G["y3"], G["yr"], G["y0"]
    def r(x, y, w, h, **k):
        return box(x * sx, y * sx, w * sx, h * sx, **k)
    def t(x, y, w, h):
        return f'<div style="position:absolute;left:{x * sx}px;top:{y * sx}px;width:{w * sx}px;height:{h * sx}px;border-radius:4px;background:#161917"></div>'
    o = r(16, 16, 1568, 132, title="Intro", r=8)
    o += r(16, 172, 1568, 598, border="1.5px solid rgba(242,243,242,.6)", fill="transparent", r=10)
    o += T(26, 172 * sx - 9, "Part A", 10, "#141416", extra=f"background:{INK};padding:0 5px;border-radius:4px;font-weight:600")
    o += r(32, y0, 756, 530, title="S1 box", meta="Stack")
    o += r(812, y0, 756, 530, title="S2 box", meta="Stack")
    for b in B:
        o += t(x1, b, cw, 110) + t(x2, b, cw, 110)
    o += r(16, 794, 1568, 570, border="1.5px solid rgba(242,243,242,.6)", fill="transparent", r=10)
    o += T(26, 794 * sx - 9, "Part B", 10, "#141416", extra=f"background:{INK};padding:0 5px;border-radius:4px;font-weight:600")
    o += r(32, y3, 1536, 246, title="S3 box", meta="Across")
    o += t(x1, y3 + 92, cw, 120) + t(x2, y3 + 92, cw, 120)
    o += r(32, yr, 1536, 232, title="Result box", meta="Span")
    o += t(x1, yr + 56, x2 + cw - x1, 150)
    if hl:
        ln = "".join(f'<path d="M{x * sx} {(y0 + 80) * sx}V{(yr + 210) * sx}" stroke="{MINT}" stroke-width="1.4" stroke-dasharray="5 4"></path>' for x in (x1, x1 + cw, x2, x2 + cw))
        o += svg(1600 * sx, 1380 * sx, ln)
    return o


def node(x, y, title, meta, w=280, hl=False):
    sh = f"box-shadow:0 0 0 1.5px {MINT};" if hl else ""
    return (f'<div style="position:absolute;left:{x}px;top:{y}px;width:{w}px;height:46px;box-sizing:border-box;border-radius:9px;background:{RAISED};border:1px solid {EDGE};{sh}'
            f'padding:0 12px;display:flex;flex-direction:column;justify-content:center;gap:2px"><span style="font-size:13.5px;color:{TX}">{title}</span>'
            f'<span style="{MF};font-size:10.5px;color:{TX2}">{meta}</span></div>')


def build():
    o = H(48, 40, "The layout is a tree of splits, so the canvas is always one full rectangle")
    o += sub(48, 82, "Each split divides a region completely, side by side or one above the other, at proportions the maker drags. Leaves are boxes. Columns are never drawn: they appear where edges line up.")
    o += canvas(48, 140, int(1600 * S), int(1380 * S), wire(), bg=BG)
    o += T(48, 140 + int(1380 * S) + 14, "Mint lines: card edges in Part A and Part B line up, so the map reads as two columns. Nobody drew a lane.", 13, TX2, 680)
    # tree
    X0, Y0 = 790, 150
    nodes = [
        (0, 0, "Canvas", "stacked · 3 rows", False),
        (1, 1, "Intro", "row 1 · full width", False),
        (1, 2, "Part A region", "side by side · 50 / 50", True),
        (2, 3, "S1 box", "Stack · tiles 1, 2, 3", False),
        (2, 4, "S2 box", "Stack · tiles 4, 5, 6", False),
        (1, 5, "Part B region", "stacked · 2 rows", True),
        (2, 6, "S3 box", "Across · tiles 7, 8", False),
        (2, 7, "Result box", "Span · tile 9", False),
    ]
    lines = ""
    pos = {}
    for d, i, ttl, meta, hl in nodes:
        x, y = X0 + d * 56, Y0 + i * 66
        pos[i] = (x, y)
        o += node(x, y, ttl, meta, 300 - d * 20, hl)
    for parent, kids in {0: [1, 2, 5], 2: [3, 4], 5: [6, 7]}.items():
        px, py = pos[parent]
        for k in kids:
            kx, ky = pos[k]
            lines += f'<path d="M{px + 22} {py + 46}V{ky + 23}H{kx}" stroke="{TX2}" stroke-width="1.2"></path>'
    o += svg(1440, 900, lines)
    o += T(X0, Y0 + 8 * 66 + 6, "Saved as this tree in builds.making.map_layout, with proportions, not pixels.", 13, TX2, 560, mono=False)
    o += ok(X0, Y0 + 8 * 66 + 50, "Every split fills its region, so the canvas never has a hole or a floating box.", 560)
    o += ok(X0, Y0 + 8 * 66 + 82, "Proportions work at any width, so the same map fits a laptop or a wide screen.", 560)
    o += ok(X0, Y0 + 8 * 66 + 114, "Moving a box rewrites the tree. The outline stays four-sided.", 560)
    page("Tree.dc.html", "Tree of splits", 1440, 900, o)


if __name__ == "__main__":
    build()
