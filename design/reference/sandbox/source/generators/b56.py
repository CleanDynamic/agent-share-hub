"""Board 5: moving things. Board 6: grouping sessions and parts."""
from lib import *


def p2(x, y, title, inner, notes, w=652, h=330, cvw=300):
    body = label(20, 16, title) + canvas(20, 48, cvw, 220, inner, r=8)
    yy = 52
    for kind, text in notes:
        body += (ok if kind else no)(cvw + 44, yy, text, w - cvw - 64)
        yy += 66
    return panel(x, y, w, h, body)


def moving():
    o = H(48, 40, "Moving boxes and tiles: every drop place is shown, and every bad one is explained")
    o += sub(48, 82, "Dragging lifts the item and lights the places it can go. Dropping splits space there, and the space it left goes to its neighbour, so the canvas stays full.")
    # drag a box
    d = (box(10, 10, 136, 96, "S1 box", "1–3", r=6, tsize=10.5) + box(154, 10, 136, 96, "S2 box", "4–6", r=6, tsize=10.5) +
         box(10, 114, 280, 96, "Result", "9", r=6, tsize=10.5, extra="opacity:.45") +
         f'<div style="position:absolute;left:146px;top:14px;width:8px;height:88px;border-radius:3px;background:{MINT}"></div>' +
         f'<div style="position:absolute;left:14px;top:206px;width:272px;height:5px;border-radius:3px;background:{MINT}"></div>' +
         f'<div style="position:absolute;left:14px;top:4px;width:272px;height:5px;border-radius:3px;background:repeating-linear-gradient(90deg,{AMB} 0 6px,transparent 6px 10px)"></div>' +
         box(60, 140, 180, 54, "S3 box", "7 · 8", r=6, tsize=10.5, fill="#3F4441", extra=f"box-shadow:0 0 0 1.5px {MINT},0 14px 30px rgba(0,0,0,.5);transform:rotate(-2deg)"))
    o += panel(48, 140, 652, 330, label(20, 16, "Dragging a box") + canvas(20, 48, 300, 220, d, r=8) +
               ok(344, 52, "Mint bars are places it can go: between S1 and S2, or below the Result.", 288) +
               no(344, 118, "The top edge is striped amber: S3 can't sit above sessions it uses.", 288) +
               ok(344, 184, "Its explanation, style and tiles come with it. The old space closes up.", 288))
    # swap
    s = (box(10, 10, 136, 200, "S1 box", "1–3", r=6, tsize=10.5, extra=f"box-shadow:0 0 0 2px {MINT}") +
         box(154, 10, 136, 200, "S2 box", "4–6", r=6, tsize=10.5, fill="#3F4441", extra="transform:rotate(-1.5deg) translate(-6px,4px);box-shadow:0 14px 30px rgba(0,0,0,.5)") +
         svg(300, 220, line("M150 110H120", col=MINT, both=True, width=1.6)))
    o += panel(740, 140, 652, 330, label(20, 16, "Swap") + canvas(20, 48, 300, 220, s, r=8) +
               ok(344, 52, "Drop one box on another to trade places and sizes.", 288) +
               ok(344, 118, "Offered here because S1 and S2 ran side by side.", 288) +
               no(344, 184, "Not offered between sessions in sequence, for example S3 with S1.", 288))
    # tiles between boxes
    t = (box(10, 10, 136, 200, "S2 · a", "4 · 5", r=6, tsize=10.5) + chip(20, 40, "4", "Write rules", w=116) + chip(20, 72, "5", "refundRules.ts", w=116) +
         f'<div style="position:absolute;left:20px;top:104px;width:116px;height:3px;border-radius:2px;background:{MINT}"></div>' +
         box(154, 10, 136, 96, "S2 · b", "6", r=6, tsize=10.5) + chip(164, 40, "6", "Rules pass", w=116, hl=True, extra="opacity:.5") +
         box(154, 114, 136, 96, "S1", "1–3", r=6, tsize=10.5, extra=f"border:1.5px dashed {AMB}") +
         chip(150, 150, "6", "Rules pass", w=116, extra=f"box-shadow:0 0 0 1.5px {AMB};transform:rotate(-3deg)"))
    o += panel(48, 500, 652, 330, label(20, 16, "Dragging a tile to another box") + canvas(20, 48, 300, 220, t, r=8) +
               ok(344, 52, "Into a box of the same session: it lands in its build-order place (the mint line).", 288) +
               no(344, 118, "Into another session's box: \"Tile 6 is in Session 2. This box holds Session 1.\"", 288) +
               ok(344, 200, "Onto a box's edge: a new box is split out for it.", 288))
    # keyboard
    keys = [("Tab", "next box in reading order"), ("Arrows", "next tile inside a box"), ("Enter / Esc", "enter or leave a box"),
            ("M", "pick up the selected box or tile"), ("Arrows", "move between allowed places"), ("Enter", "drop")]
    k = "".join(f'<div style="display:flex;gap:12px;align-items:center;height:30px"><span style="{MF};font-size:11.5px;color:{TX};background:{RAISED};border:1px solid {EDGE};border-radius:5px;padding:2px 8px;min-width:70px;text-align:center">{a}</span><span style="font-size:13px;color:{TX2}">{b}</span></div>' for a, b in keys)
    o += panel(740, 500, 652, 330, label(20, 16, "Keyboard") + A(20, 52, k, 360) +
               T(400, 56, "Forbidden places are skipped and announced. Every move is read out:", 13, TX2, 232) +
               T(400, 130, "\"Box Refund rules moved to the right of Classify, band 1.\"", 13, TX, 232, extra=f"{MF};font-size:12px"))
    page("Moving.dc.html", "Moving things", 1440, 870, o)


def grouping():
    o = H(48, 40, "Sessions and parts are frames the maker can open, or outlines that follow loose boxes")
    o += sub(48, 82, "They only ever describe compartments the build editor already made. There is no way to group tiles from two sessions.")
    # sources mock
    fb = lambda on: f'<span style="margin-left:auto;display:flex;gap:4px"><span style="width:24px;height:24px;border-radius:6px;border:1px solid {MINT if on else EDGE};color:{MINT if on else TX2};display:flex;align-items:center;justify-content:center;font-size:11px">▣</span><span style="width:24px;height:24px;border-radius:6px;border:1px solid {EDGE};color:{TX2};display:flex;align-items:center;justify-content:center;font-size:11px">⌐</span></span>'
    src = (f'<div style="padding:16px 14px;display:flex;flex-direction:column;gap:6px"><span style="font-size:14px;font-weight:600">Sources</span>'
           f'<div style="display:flex;align-items:center;height:30px;{MF};font-size:11px;color:{LAB};letter-spacing:.06em">PART A{fb(True)}</div>'
           f'<div style="display:flex;align-items:center;height:32px;font-size:13px">S1 · Classify{fb(True)}</div>'
           f'<div style="display:flex;align-items:center;height:32px;font-size:13px">S2 · Refund rules{fb(False)}</div>'
           f'<div style="display:flex;align-items:center;height:30px;{MF};font-size:11px;color:{LAB};letter-spacing:.06em">PART B{fb(False)}</div>'
           f'<div style="display:flex;align-items:center;height:32px;font-size:13px">S3 · Draft and send{fb(False)}</div>'
           f'<p style="margin:10px 0 0;font-size:12px;color:{TX2};line-height:1.5">▣ Frame: wraps the session or part as one region.<br>⌐ Outline: a line round its boxes, wherever they are.</p></div>')
    o += panel(48, 140, 300, 470, src)
    W, Hh = 320, 300
    # framed
    f = (frame(14, 22, 292, 262, "Part A") + box(28, 44, 128, 226, "S1", "1–3", r=6, tsize=10.5) + box(164, 44, 128, 226, "S2", "4–6", r=6, tsize=10.5) +
         "".join(chip(36, 74 + i * 62, str(1 + i), "", w=112, h=40) + chip(172, 74 + i * 62, str(4 + i), "", w=112, h=40) for i in range(3)))
    o += panel(376, 140, 340, 470, label(16, 14, "Framed (the default)") + canvas(10, 44, W, Hh, f, r=8) +
               T(16, 356, "Moving the frame moves everything in it. Its outline is always a rectangle. Best when sessions run one after another.", 13, TX2, 308))
    # opened, interleaved
    g = (box(14, 14, 140, 272, "S1", "1–3", r=6, tsize=10.5) + "".join(chip(22, 44 + i * 80, str(1 + i), "", w=124, h=40) for i in range(3)) +
         box(166, 14, 140, 120, "S2 · a", "4", r=6, tsize=10.5, extra="opacity:.35") +
         box(166, 182, 140, 104, "S2 · a", "4", r=6, tsize=10.5, extra=f"box-shadow:0 0 0 2px {MINT}") + chip(174, 212, "4", "Write rules", w=124, h=40) +
         svg(W, Hh, line("M236 134V180", col=MINT) + line("M174 232H146", col=INK2)) +
         msg(108, 250, "Level with Prompt 3, which uses it", MINT, 10.5))
    o += panel(744, 140, 340, 470, label(16, 14, "Opened, so sessions can interleave") + canvas(10, 44, W, Hh, g, r=8) +
               T(16, 356, "Open frame turns the boxes loose in place. Here Session 2's box slides down level with the Session 1 tile that uses it. The order check still applies.", 13, TX2, 308))
    # outline
    ol = (box(14, 14, 112, 130, "S1", "1–2", r=6, tsize=10.5) + box(134, 14, 112, 130, "S2 · a", "4–5", r=6, tsize=10.5) +
          box(14, 156, 112, 130, "S1", "3", r=6, tsize=10.5) + box(134, 156, 112, 130, "S2 · b", "6", r=6, tsize=10.5) +
          svg(260, Hh, f'<path d="M129 8H251V292H129Z" stroke="{INK}" stroke-width="1.6" stroke-dasharray="6 4"></path>') +
          T(176, 0, "Session 2", 10, "#141416", extra=f"background:{INK};padding:0 5px;border-radius:4px;font-weight:600"))
    o += panel(1112, 140, 280, 470, label(16, 14, "Outline") + canvas(10, 44, 260, Hh, ol, r=8) +
               T(16, 356, "A line round a session's boxes, through the gutters. It redraws when boxes move and never stops anything moving.", 13, TX2, 248))
    page("Grouping.dc.html", "Grouping", 1440, 650, o)


if __name__ == "__main__":
    moving(); grouping()
