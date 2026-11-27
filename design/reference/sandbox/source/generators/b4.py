"""Board 4: reading order, bands, and two-way arrows."""
from lib import *


def circ(x, y, n, col=MINT):
    return (f'<div style="position:absolute;left:{x}px;top:{y}px;width:22px;height:22px;border-radius:50%;background:{col};color:#040504;'
            f'{MF};font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center">{n}</div>')


def case(x, y, title, inner, verdict, good=True, w=316, h=270):
    v = ok(16, h - 64, verdict, w - 32) if good else no(16, h - 64, verdict, w - 32)
    return panel(x, y, w, h, label(16, 14, title) + canvas(16, 42, w - 32, 140, inner, r=8) + v)


def build():
    o = H(48, 40, "The map reads left to right, then down, and that order always matches the build")
    o += sub(48, 82, "Bands are worked out per tile. Tiles whose heights overlap share a band and read as simultaneous. A drop that would put a later tile first is never possible.")
    # left: the bands explained on Part A
    L = canvas(0, 0, 660, 520, "", r=10)
    bx1, bx2, by, bw, bh = 70, 360, 30, 270, 470
    inner = box(bx1, by, bw, bh, "S1 · Classify", "", r=8) + box(bx2, by, bw, bh, "S2 · Refund rules", "", r=8, fill="rgba(107,226,160,.06)")
    rows = [110, 240, 370]
    t1 = [("1", "Label emails"), ("2", "labels.json"), ("3", "Merge rules")]
    t2 = [("4", "Write rules"), ("5", "refundRules.ts"), ("6", "Rules pass 30")]
    for i, ry in enumerate(rows):
        inner += chip(bx1 + 70, ry, t1[i][0], t1[i][1], w=184, h=44)
        inner += chip(bx2 + 16 + (24 if i == 2 else 0), ry, t2[i][0], t2[i][1], w=184 - (24 if i == 2 else 0), h=44)
        inner += f'<div style="position:absolute;left:8px;top:{ry + 21}px;width:644px;border-top:1px dashed rgba(255,255,255,.18)"></div>'
        inner += T(10, ry + 2, f"Band {i + 1}", 11, INK3, mono=True)
    order = [(bx1 + 44, rows[0] + 11, 1), (bx2 + 212, rows[0] + 11, 2), (bx1 + 44, rows[1] + 11, 3), (bx2 + 212, rows[1] + 11, 4), (bx1 + 44, rows[2] + 11, 5), (bx2 + 212, rows[2] + 11, 6)]
    for x, y, n in order:
        inner += circ(x, y, n)
    ln = (line(f"M{bx1 + 254} {rows[0] + 22}H{bx2 + 16}", col=MINT, both=True, width=1.6) +
          line(f"M{bx2 + 16} {rows[0] + 36}H{(bx1 + bw + bx2) // 2}V{rows[2] + 22}H{bx1 + 254}"))
    inner += svg(660, 520, ln)
    inner += T((bx1 + bw + bx2) // 2 - 30, rows[0] - 2, "same time", 11, MINT, extra=f"background:{BG};padding:0 4px")
    o += canvas(48, 140, 660, 520, inner, r=12)
    o += T(48, 672, "Mint numbers: the reading order. Band 1 holds tiles 1 and 4 together, then band 2, then band 3.", 13, TX2, 660)
    o += ok(48, 714, "Within a session the order is fixed: tile 6 is never read before tile 5.", 660)
    o += ok(48, 746, "A use is a dependency: Prompt 3 uses Prompt 4, so 4 sits before or level with 3.", 660)
    o += ok(48, 778, "Sessions with no link between them may share a band, so tiles 1 to 6 could all be level.", 660)
    o += ok(48, 810, "The check runs while you drag. Places that would break the order are dimmed, with a reason.", 660)
    # right: six cases
    X, Y = 744, 140
    cw, chh = 284, 140
    def two(xa, ya, xb, yb, col=MINT, both=True):
        return svg(cw, chh, line(f"M{xa} {ya}H{xb}", col=col, both=both, width=1.6))
    c1 = (box(12, 10, 124, 120, "S2", "", r=6, tsize=10.5) + chip(22, 34, "5", "refundRules.ts", w=104, h=24) + chip(22, 64, "6", "Rules pass", w=104, h=24, hl=True) +
          box(148, 10, 124, 120, "S2 · later", "", r=6, tsize=10.5) + chip(158, 64, "6", "Rules pass", w=104, h=24, hl=True, extra="opacity:.55") +
          svg(cw, chh, line("M126 76H158", col=MINT)))
    o += case(X, Y, "Moving a tile later", c1, "Allowed. Later is always fine; the box grows or splits to make room.")
    c2 = (box(12, 10, 260, 120, "S2", "", r=6, tsize=10.5) + chip(24, 34, "5", "refundRules.ts", w=140, h=24) +
          f'<div style="position:absolute;left:24px;top:30px;width:140px;height:32px;border-radius:6px;background:repeating-linear-gradient(45deg,rgba(232,184,107,.2) 0 4px,transparent 4px 8px)"></div>' +
          chip(150, 24, "6", "Rules pass", w=110, h=24, extra=f"box-shadow:0 0 0 1.5px {AMB};transform:rotate(-3deg)") + chip(24, 94, "6", "", w=140, h=24, extra=f"border:1.5px dashed {AMB};background:transparent"))
    o += case(X + 336, Y, "Moving tile 6 above tile 5", c2, "Refused: \"Tile 6 tests tile 5, so it can't come before it.\"", False)
    c3 = (box(12, 10, 124, 120, "S1", "", r=6, tsize=10.5) + box(148, 10, 124, 120, "S2", "", r=6, tsize=10.5) +
          chip(22, 50, "1", "Label emails", w=104, h=28) + chip(158, 50, "4", "Write rules", w=104, h=28) + two(126, 64, 158, 64))
    o += case(X, Y + 290, "Two-way arrow between tiles", c3, "Allowed between simultaneous tiles. Always a straight, level line through the gutter.")
    c4 = (box(12, 10, 124, 120, "S1 box", "", r=6, tsize=10.5) + box(148, 10, 124, 120, "S2 box", "", r=6, tsize=10.5) + two(136, 70, 148, 70) +
          T(116, 46, "same time", 9.5, MINT, extra=f"background:{BG};padding:0 3px"))
    o += case(X + 336, Y + 290, "Two-way arrow between boxes", c4, "Allowed between boxes of sessions that ran side by side, level at the middle of their shared height.")
    c5 = (box(12, 8, 124, 60, "S1", "", r=6, tsize=10.5) + chip(22, 34, "3", "Merge rules", w=104, h=24) +
          box(12, 76, 260, 56, "S3", "", r=6, tsize=10.5) + chip(158, 100, "7", "Reply drafter", w=104, h=24) +
          svg(cw, chh, f'<path d="M126 46H210V100" stroke="{AMB}" stroke-width="1.5" stroke-dasharray="4 4"></path>'))
    o += case(X, Y + 580, "Two-way arrow between steps in sequence", c5, "Refused: \"These happen one after the other.\"", False)
    c6 = (box(12, 10, 124, 120, "S1", "", r=6, tsize=10.5) + box(148, 10, 124, 120, "S2", "", r=6, tsize=10.5) +
          chip(22, 80, "2", "labels.json", w=104, h=26) + chip(158, 30, "4", "Write rules", w=104, h=26) + chip(158, 80, "4", "", w=104, h=26, extra=f"border:1.5px dashed {MINT};background:transparent") +
          svg(cw, chh, f'<path d="M210 56V78" stroke="{MINT}" stroke-width="1.3"></path><path d="M206 72l4 6 4-6" stroke="{MINT}" stroke-width="1.3"></path>'))
    o += case(X + 336, Y + 580, "Ends not level", c6, "The tool offers to slide Prompt 4 into band 2 first, because the order allows it.")
    page("Order.dc.html", "Order and two-way arrows", 1440, 1010, o)


if __name__ == "__main__":
    build()
