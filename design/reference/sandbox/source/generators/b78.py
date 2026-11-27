"""Board 7: inside a box. Board 8: lines."""
from lib import *


def inside():
    o = H(48, 40, "Inside a box, contents are laid out by rules: three layouts, ordered tiles, three levels")
    o += sub(48, 82, "Every box has a title, an explanation line, then its tiles. The maker arranges them; spacing, sizes and the tile format stay fixed.")
    # layouts
    def lay(name, inner, x):
        return label(x, 0, name) + canvas(x, 26, 200, 150, inner, r=8)
    st = box(10, 10, 180, 130, "S2", "Stack", r=6, tsize=10.5) + "".join(chip(20, 36 + i * 32, str(4 + i), "", w=160, h=26) for i in range(3))
    ac = box(10, 10, 180, 130, "S3", "Across", r=6, tsize=10.5) + chip(20, 50, "7", "", w=76, h=60) + chip(104, 50, "8", "", w=76, h=60)
    gr = box(10, 10, 180, 130, "S2", "Grid · 2", r=6, tsize=10.5) + chip(20, 36, "4", "", w=76, h=44) + chip(104, 36, "5", "", w=76, h=44) + chip(20, 88, "6", "", w=76, h=44)
    o += panel(48, 140, 680, 300, A(20, 16, lay("Stack", st, 0) + lay("Across", ac, 220) + lay("Grid", gr, 440), 640, 190) +
               T(20, 224, "Switching re-flows the tiles in build order with the same spacing. The box changes height and its neighbours adjust through shared edges. Across offers to widen the box if tiles would get too narrow.", 13, TX2, 640))
    # reorder
    r = (box(10, 10, 280, 210, "S3", "Stack", r=6, tsize=10.5) + chip(22, 40, "7", "Reply drafter", w=256, h=34) +
         f'<div style="position:absolute;left:22px;top:80px;width:256px;height:3px;border-radius:2px;background:{MINT}"></div>' +
         chip(22, 88, "8", "Gmail", w=256, h=34, extra="opacity:.45") + chip(60, 70, "8", "Gmail", w=220, h=30, extra=f"box-shadow:0 0 0 1.5px {MINT},0 12px 24px rgba(0,0,0,.5);transform:rotate(-1.5deg)") +
         chip(22, 136, "9", "Support inbox", w=256, h=34) +
         f'<div style="position:absolute;left:22px;top:174px;width:256px;height:30px;border-radius:6px;background:repeating-linear-gradient(45deg,rgba(255,255,255,.06) 0 4px,transparent 4px 8px)"></div>' +
         T(30, 180, "skipped: tile 9 must stay last", 10.5, INK3))
    o += panel(752, 140, 640, 300, label(20, 16, "Reorder") + canvas(20, 48, 300, 230, r, r=8) +
               ok(344, 52, "Drag a tile up or down. A mint line shows where it lands.", 276) +
               ok(344, 112, "Tiles 7 and 8 ran together, so either can go first.", 276) +
               no(344, 172, "Places that would break the order are skipped, so tile 9 can't move above them.", 276))
    # indent
    ind = (box(10, 10, 280, 210, "S2", "Stack", r=6, tsize=10.5) + chip(22, 40, "4", "Write rules", w=256, h=34) +
           chip(22, 86, "5", "refundRules.ts", w=256, h=34) + chip(50, 132, "6", "Rules pass 30 cases", w=228, h=30) +
           svg(300, 230, f'<path d="M36 120V147H50" stroke="{INK3}" stroke-width="1.2"></path>') +
           T(22, 178, "level 1 · level 2 · level 3 at most", 10.5, INK3, mono=True))
    o += panel(48, 464, 680, 300, label(20, 16, "Indent") + canvas(20, 48, 300, 230, ind, r=8) +
               ok(344, 52, "Drag right, or press Tab, to place a tile under the one above. Shift and Tab brings it back.", 316) +
               ok(344, 124, "A check sits under what it tests; a file under the prompt that made it.", 316) +
               ok(344, 182, "Indenting never changes the order: an indented tile still follows the one above.", 316))
    # show
    sh = (box(10, 10, 280, 210, "S2", "", r=6, tsize=10.5) +
          f'<div style="position:absolute;left:22px;top:38px;width:256px;height:150px;box-sizing:border-box;border-radius:8px;background:#161917;padding:10px 12px">'
          f'<div style="display:flex;gap:6px;align-items:center"><span style="{MF};font-size:9.5px;color:#EDEFEC;background:#2A2E2B;border-radius:4px;padding:1px 5px">4</span><span style="{MF};font-size:9px;color:#858C87">PROMPT</span><span style="font-size:11.5px;color:#EDEFEC">Write the refund rules</span></div>'
          f'<div style="margin-top:6px;font-size:10.5px;color:#A4AAA5">Turn the refund policy into rules a script can check.</div>'
          f'<div style="margin-top:8px;display:flex;flex-direction:column;gap:3px">'
          + "".join(f'<div style="display:flex;gap:6px;height:16px;align-items:center"><span style="width:70px;font-size:9px;color:#858C87">{a}</span><span style="flex-grow:1;height:16px;border-radius:3px;background:#232624;{MF};font-size:9px;color:#D2D5D3;display:flex;align-items:center;padding:0 5px">{b}</span></div>' for a, b in (("Model", "Opus 5.5"), ("Reasoning effort", "High"))) +
          '</div></div>')
    bar = (f'<div style="position:absolute;left:344px;top:52px;display:flex;gap:6px;flex-wrap:wrap;width:280px">' +
           "".join(f'<span style="height:30px;padding:0 10px;border-radius:7px;background:{SURF};display:flex;align-items:center;gap:6px;font-size:12.5px;color:{TX}"><i style="font-style:normal;width:13px;height:13px;border-radius:3px;{("background:" + MINT) if on else ("border:1.5px solid " + LAB)};font-size:9px;color:#040504;display:flex;align-items:center;justify-content:center">{"✓" if on else ""}</i>{n}</span>' for n, on in (("Text", True), ("Settings", True), ("Files", False))) + '</div>')
    o += panel(752, 464, 640, 300, label(20, 16, "Show") + canvas(20, 48, 300, 230, sh, r=8) + bar +
               T(344, 100, "Only parts the tile really has are offered (this prompt has no code or picture). Each part has a fixed place in the tile, so tiles always read the same way.", 13, TX2, 276))
    # notes
    nb = (box(10, 10, 620, 150, "Classify", "S1", r=6, tsize=12) + T(20, 34, "Every email gets one label before anything else.", 12, INK2) +
          chip(320, 64, "1", "Label the last 200 emails", w=290, h=40) +
          svg(640, 170, line("M320 84H290", end=False)) + T(70, 70, "Starts the build", 12, INK, 214, extra="text-align:right") + T(70, 88, "Runs at the same time as Prompt 4.", 11, INK3, 214, extra="text-align:right"))
    o += panel(48, 788, 1344, 220, label(20, 16, "Explanations and notes") + canvas(20, 48, 640, 160, nb, r=8) +
               ok(692, 52, "Click the line under a title to write its explanation.", 620) +
               ok(692, 90, "Add note on a tile attaches a short note beside it, with a leader the box lays out.", 620) +
               ok(692, 128, "Notes belong to their tile and move with it. Empty placeholders never appear for readers.", 620))
    page("Inside.dc.html", "Inside a box", 1440, 1040, o)


def lines():
    o = H(48, 40, "Lines come only from the build, travel only through gutters, and always turn at right angles")
    o += sub(48, 82, "Every use can be shown as a line from the tile that is used to the tile that uses it. Two-way arrows are the only lines a maker adds, and only between simultaneous items.")
    g = (box(16, 16, 260, 200, "S1", "", r=6, tsize=10.5) + box(300, 16, 260, 200, "S2", "", r=6, tsize=10.5) +
         box(16, 240, 544, 130, "S3", "", r=6, tsize=10.5) +
         f'<div style="position:absolute;left:276px;top:16px;width:24px;height:200px;background:rgba(107,226,160,.08)"></div>'
         f'<div style="position:absolute;left:16px;top:216px;width:544px;height:24px;background:rgba(107,226,160,.08)"></div>' +
         chip(130, 50, "1", "", w=130, h=34) + chip(130, 110, "2", "", w=130, h=34) + chip(130, 166, "3", "", w=130, h=34) +
         chip(316, 50, "4", "", w=130, h=34) + chip(316, 110, "5", "", w=130, h=34) + chip(340, 166, "6", "", w=106, h=34) +
         chip(130, 290, "7", "", w=130, h=40) + chip(316, 290, "8", "", w=130, h=40))
    ln = (line("M316 76H288V183H260") +
          line("M195 200V228H140V290") + line("M210 200V232H160V290", col=INK3) + line("M225 200V236H180V290", col=INK3) +
          line("M260 67H316", col=MINT, both=True, width=1.6) + line("M316 310H260"))
    o += canvas(48, 140, 576, 386, g + svg(576, 386, ln), r=12)
    o += T(48, 538, "Gutters (tinted) are the only place lines run. Three links share the lower gutter at an even spacing.", 13, TX2, 576)
    o += ok(660, 150, "Routed for you: out of a tile's edge, through gutters, into the other tile's edge. Never across a box.", 700)
    o += ok(660, 196, "Several lines in one gutter run side by side, evenly spaced.", 700)
    o += ok(660, 236, "Drag a line's middle segment to another gutter. It keeps its right angles and snaps to the gutter's centre.", 700)
    o += ok(660, 282, "Moving a box re-routes its lines at once.", 700)
    o += ok(660, 322, "Checks get a dashed line to what they test. Two-way arrows are mint and always level.", 700)
    o += no(660, 368, "No line can be drawn between tiles with no link, so the map never claims a dependency the build doesn't have.", 700)
    o += (f'<div style="position:absolute;left:660px;top:430px;display:flex;align-items:center;gap:12px">'
          f'<span style="height:34px;padding:0 12px;border-radius:8px;background:{RAISED};border:1px solid {EDGE};display:flex;align-items:center;gap:8px;font-size:13px;color:{TX}">Lines<span style="{MF};font-size:11px;color:{AMB}">2 hidden</span></span>'
          f'<span style="font-size:13px;color:{TX2}">Any line can be hidden. The counter means readers know a link exists.</span></div>')
    page("Lines.dc.html", "Lines", 1440, 600, o)


if __name__ == "__main__":
    inside(); lines()
