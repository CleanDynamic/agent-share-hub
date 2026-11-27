"""Board 3: shaping tools. Each keeps the canvas full, four-sided and in order."""
from lib import *

CW, CH = 186, 136


def mini(inner, x, y):
    return canvas(x, y, CW, CH, inner, r=8)


def b(x, y, w, h, t="", m="", **k):
    return box(x, y, w, h, t, m, r=6, tsize=11, **k)


def tool(px, py, name, key, before, after, how, refused):
    inner = (label(20, 18, name) + T(20 + len(name) * 8 + 14, 20, key, 11, LAB, mono=True) +
             mini(before, 20, 52) + arrow_r(CW + 30, 52 + CH // 2 - 6, 38) + mini(after, CW + 76, 52) +
             T(20, 52 + CH + 6, "Before", 11, LAB) + T(CW + 76, 52 + CH + 6, "After", 11, LAB) +
             T(20, 220, how, 13, TX, 418, lh=1.5) + no(20, 352, refused, 418))
    return panel(px, py, 458, 418, inner)


def build():
    o = H(48, 40, "Six shaping tools, and none of them can leave a gap")
    o += sub(48, 82, "Each changes the shape of the map while keeping it full, four-sided and in build order. Edges snap to the 12-column grid and to edges elsewhere on the canvas.")
    P = [(48, 140), (522, 140), (996, 140), (48, 574), (522, 574), (996, 574)]
    g = 8  # gutter inside minis
    # Split
    sb = b(g, g, CW - 2 * g, CH - 2 * g, "S2 box", "4 · 5 · 6")
    sa = (b(g, g, 96, CH - 2 * g, "S2 box", "4 · 5") +
          b(g + 104, g, CW - 3 * g - 96, CH - 2 * g, "", "", fill="rgba(107,226,160,.08)", border=f"1.5px dashed {MINT}") +
          T(g + 112, 56, "drop tile 6<br>here", 10.5, MINT, 60))
    o += tool(*P[0], "Split", "S", sb, sa,
              "Select a box, choose Split side by side or top and bottom, and drag the cut. Dropping a tile on a box's right or bottom quarter splits it in one move.",
              "Refused when a half would be narrower than the minimum box width.")
    # Merge
    mb = b(g, g, 80, CH - 2 * g, "S2 · a", "4 · 5") + b(g + 88, g, CW - 3 * g - 80, CH - 2 * g, "S2 · b", "6")
    ma = b(g, g, CW - 2 * g, CH - 2 * g, "S2 box", "4 · 5 · 6")
    o += tool(*P[1], "Merge", "M", mb, ma,
              "Select two neighbours that share a full edge. Tiles join in build order, never in the order you picked them.",
              "Refused for boxes from different sessions: \"These boxes hold different sessions.\"")
    # Shared edge
    eb = b(g, g, 80, CH - 2 * g, "S1", "") + b(g + 88, g, CW - 3 * g - 80, CH - 2 * g, "S2", "")
    ea = (b(g, g, 112, CH - 2 * g, "S1", "") + b(g + 120, g, CW - 3 * g - 112, CH - 2 * g, "S2", "") +
          svg(CW, CH, f'<path d="M{g + 116} 6V{CH - 6}" stroke="{MINT}" stroke-width="2"></path>') +
          T(g + 30, CH - 34, "7 col", 10, MINT, mono=True) + T(g + 128, CH - 34, "5 col", 10, MINT, mono=True))
    o += tool(*P[2], "Shared edge", "drag", eb, ea,
              "Drag the gutter between boxes. Both sides resize together, a readout shows each width, and the edge snaps to grid lines and to edges it passes.",
              "Refused when a box would be shorter than its contents or narrower than the minimum.")
    # Span
    pb = b(g, g, 100, 56, "Result", "9") + b(g + 108, g, CW - 3 * g - 100, 56, "Note", "") + b(g, 72, CW - 2 * g, CH - 72 - g, "S3 box", "7 · 8", fill="rgba(255,255,255,.02)")
    pa = b(g, g, CW - 2 * g, 50, "S3 box", "7 · 8", fill="rgba(255,255,255,.02)") + b(g, 66, CW - 2 * g, CH - 66 - g, "Result", "spans the row")
    o += tool(*P[3], "Span", "", pb, pa,
              "Stretches a box across its whole row. Neighbours move to the next row in reading order.",
              "Refused when the move would put a later tile first, with the tile it would break named.")
    # Even out
    vb = b(g, g, 40, CH - 2 * g) + b(g + 48, g, 80, CH - 2 * g) + b(g + 136, g, CW - 3 * g - 128 - 8, CH - 2 * g)
    w3 = (CW - 2 * g - 16) / 3
    va = b(g, g, w3, CH - 2 * g) + b(g + w3 + 8, g, w3, CH - 2 * g) + b(g + 2 * (w3 + 8), g, w3, CH - 2 * g)
    o += tool(*P[4], "Even out", "", vb, va,
              "Select a row or column of boxes. Their shared edges move until they're equal, inside the space they already take. Nothing outside the selection moves.",
              "Refused when equal sizes would squeeze a box below its contents.")
    # Match
    hb = b(g, g, 80, 60, "A") + b(g + 88, g, CW - 3 * g - 80, 100, "B") + b(g, 76, 80, CH - 76 - g, "C", fill="rgba(255,255,255,.02)")
    ha = b(g, g, 80, 100, "A") + b(g + 88, g, CW - 3 * g - 80, 100, "B") + b(g, 116, CW - 2 * g, CH - 116 - g, "C", fill="rgba(255,255,255,.02)")
    o += tool(*P[5], "Match", "", hb, ha,
              "Select boxes and choose Match height or width to copy the first one's size. Neighbours adjust through shared edges, so the canvas stays full.",
              "Refused when a neighbour would drop below the minimum size, naming the box in the way.")
    page("Shaping.dc.html", "Shaping tools", 1440, 1040, o)


if __name__ == "__main__":
    build()
