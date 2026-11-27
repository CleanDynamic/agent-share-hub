"""Board 12: make the map from a chat. Board 13: the map file and the drop check."""
from lib import *
import html

REQ = ("Put Classify and Refund rules side by side with the cards facing each other. "
       "Show that tiles 1 and 4 happen at the same time. Draft and send goes underneath across "
       "the full width, with the result last. Tint Refund rules green.")


def filechip(x, y, name, size, w=300):
    return (f'<div style="position:absolute;left:{x}px;top:{y}px;width:{w}px;height:46px;box-sizing:border-box;border-radius:9px;border:1px solid {EDGE};background:{SURF};display:flex;align-items:center;gap:10px;padding:0 10px">'
            f'<span style="width:26px;height:30px;border-radius:4px;background:{RAISED};{MF};font-size:9px;color:{TX2};display:flex;align-items:flex-end;justify-content:center;padding-bottom:4px;box-sizing:border-box">MD</span>'
            f'<span style="display:flex;flex-direction:column;min-width:0"><span style="font-size:12.5px;color:{TX};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{name}</span>'
            f'<span style="font-size:11px;color:{LAB}">{size}</span></span></div>')


def step(n, x, y, w, h, title, inner):
    return panel(x, y, w, h, A(20, 18, f'<div style="display:flex;align-items:center;gap:10px"><span style="width:24px;height:24px;border-radius:50%;background:{RAISED};{MF};font-size:12px;color:{TX};display:flex;align-items:center;justify-content:center">{n}</span><span style="font-size:15px;color:{TX};font-weight:500">{title}</span></div>') + inner)


def tiny_map(x, y, w=200, h=170, green=True, hl=False):
    f2 = "rgba(107,226,160,.10)" if green else "rgba(255,255,255,.05)"
    def bx(a, b, c, d, f="rgba(255,255,255,.05)"):
        return f'<div style="position:absolute;left:{a}px;top:{b}px;width:{c}px;height:{d}px;box-sizing:border-box;border-radius:5px;border:1px solid #5E635F;background:{f}"></div>'
    def ch(a, b, c=40, d=14):
        return f'<div style="position:absolute;left:{a}px;top:{b}px;width:{c}px;height:{d}px;border-radius:3px;background:#161917"></div>'
    s = w / 200
    inner = bx(6, 6, 188, 20) + bx(6, 32, 92, 84) + bx(102, 32, 92, 84, f2) + bx(6, 122, 188, 22) + bx(6, 148, 188, 16)
    for i in range(3):
        inner += ch(54, 42 + i * 24) + ch(108, 42 + i * 24)
    inner += ch(40, 126, 50, 14) + ch(110, 126, 50, 14) + ch(70, 150, 60, 10)
    inner += svg(200, 170, f'<path d="M94 49H108" stroke="{MINT}" stroke-width="1.4"></path>')
    return canvas(x, y, w, h, f'<div style="position:absolute;left:0;top:0;width:200px;height:170px;transform:scale({s});transform-origin:0 0">{inner}</div>', r=8,
                  extra=f"box-shadow:0 0 0 2px {MINT};" if hl else "")


def flow():
    o = H(48, 40, "A chat can write the map: copy the build out, describe the map in words, drop the file back in")
    o += sub(48, 82, "For when the build is done and arranging boxes by hand would take longer than describing them. The result is an ordinary map that every tool can still edit.")
    W, Y, HH = 324, 140, 560
    xs = [48 + i * (W + 16) for i in range(4)]
    # 1 copy
    menu = (f'<div style="position:absolute;left:20px;top:64px;width:284px;height:34px;border-radius:8px;border:1px solid {EDGE};display:flex;align-items:center;gap:2px;padding:0 3px;box-sizing:border-box;font-size:12.5px;color:{TX2};white-space:nowrap">'
            f'<span style="padding:5px 9px">Numbers</span><span style="padding:5px 9px;border-radius:6px;background:{RAISED};color:{TX}">Copy for chat</span><span style="padding:5px 9px">Open file</span></div>'
            f'<div style="position:absolute;left:120px;top:106px;width:184px;border-radius:10px;background:{RAISED};border:1px solid {EDGE};box-shadow:0 14px 30px rgba(0,0,0,.5);padding:5px;font-size:12.5px">'
            f'<div style="padding:8px 10px;border-radius:6px;background:{MOD};color:{TX}">Copy to clipboard</div><div style="padding:8px 10px;color:{TX2}">Download .md</div></div>')
    o += step(1, xs[0], Y, W, HH, "Copy for chat", menu +
              filechip(20, 214, "support-inbox-triage.for-chat.md", "9 tiles · 3 sessions · 6 KB", 284) +
              T(20, 280, "One Markdown file with three parts:", 13, TX, 284) +
              T(20, 304, "The build: parts, sessions and every tile by number, kind, title and what it uses.<br><br>What can run at the same time, so the chat only proposes allowed two-way arrows.<br><br>How to write a map file, with an example. The chat needs no other instructions.", 12.5, TX2, 284) +
              T(20, 470, "Prompt text, code and files stay out. The chat sees titles, not content.", 12.5, TX2, 284))
    # 2 chat
    chat = (f'<div style="position:absolute;left:20px;top:62px;width:284px;height:476px;border-radius:10px;background:{SURF};border:1px solid {HAIRM};overflow:hidden">'
            f'<div style="height:34px;border-bottom:1px solid {HAIRM};display:flex;align-items:center;padding:0 12px;font-size:12px;color:{LAB}">Any chat or harness</div></div>')
    bubble = (f'<div style="position:absolute;left:44px;top:156px;width:248px;box-sizing:border-box;border-radius:10px;background:{RAISED};padding:10px 12px;font-size:12px;line-height:1.5;color:{TX}">{REQ}</div>')
    o += step(2, xs[1], Y, W, HH, "Describe it in words", chat +
              filechip(44, 106, "support-inbox-triage.for-chat.md", "Attached", 248) + bubble +
              T(32, 352, "Reply", 11, LAB) +
              filechip(32, 372, "support-inbox-triage.map.md", "Map file · 2 KB", 248) +
              T(32, 432, "Rows, boxes, column widths, layouts, notes and one two-way arrow, written in the format the guide asked for.", 12, TX2, 260))
    # 3 drop
    drop = (canvas(20, 62, 284, 250, f'<div style="position:absolute;inset:10px;border-radius:8px;border:1.5px dashed {MINT};background:rgba(107,226,160,.06);display:flex;align-items:center;justify-content:center;font-size:13px;color:{TX}">Drop a map file</div>', r=10) +
            A(150, 210, f'<div style="transform:rotate(-4deg)">{filechip(0, 0, "support-inbox-triage.map.md", "Map file", 190)}</div>', 190, 46))
    o += step(3, xs[2], Y, W, HH, "Drop it on the canvas", drop +
              T(20, 336, "Drag the file anywhere on the Map tab, or use Open file in the toolbar. Pasting the text works too.", 12.5, TX2, 284) +
              ok(20, 410, "Only .md and .txt files, read in the browser.", 284) +
              ok(20, 458, "A file for another build is refused.", 284))
    # 4 check
    rows = [("ok", "9 of 9 tiles placed"), ("ok", "Order holds in every row"), ("ok", "1 two-way arrow: tiles 1 and 4"), ("ok", "Frames drawn for Part A and Part B")]
    rr = "".join((ok if k == "ok" else no)(0, i * 30, t, 248) for i, (k, t) in enumerate(rows))
    dlg = (f'<div style="position:absolute;left:20px;top:62px;width:284px;height:430px;box-sizing:border-box;border-radius:12px;background:{RAISED};border:1px solid {EDGE};box-shadow:0 18px 40px rgba(0,0,0,.55)">'
           + T(16, 14, "support-inbox-triage.map.md", 13, TX) + tiny_map(42, 44, 200, 170) + A(16, 230, rr, 252, 120) + T(16, 352, "Any fix the check makes is listed here too.", 12, LAB, 252) +
           f'<div style="position:absolute;left:16px;right:16px;bottom:14px;display:flex;gap:8px;justify-content:flex-end"><span style="height:32px;padding:0 12px;border-radius:7px;border:1px solid {EDGE};display:flex;align-items:center;font-size:12.5px;color:{TX}">Cancel</span>'
           f'<span style="height:32px;padding:0 12px;border-radius:7px;background:{TX};color:{PAGE};display:flex;align-items:center;font-size:12.5px">Replace map</span></div></div>')
    o += step(4, xs[3], Y, W, HH, "Check, then apply", dlg +
              T(20, 508, "Nothing changes until Replace map. Undo brings the old map back.", 12.5, TX2, 284))
    for i in range(3):
        o += arrow_r(xs[i] + W - 2, Y + HH // 2, 20)
    # rules
    rl = [("The chat never touches the build.", "It only arranges tiles that already exist, by number. Titles, prompts and order come from the build."),
          ("Every rule of the editor applies.", "A file is checked the same way a drag is: one session per box, order never contradicted, two-way only when allowed."),
          ("Nothing is dropped silently.", "Every fix the check makes is listed before applying. If it can't be fixed, the file is refused with the reason."),
          ("It goes both ways.", "When a map already exists, Copy for chat adds its map file, so a chat can change a map as well as start one.")]
    rh = "".join(T(20 + i * 336, 52, a, 13.5, TX, 310, 500) + T(20 + i * 336, 78, b, 12.5, TX2, 310) for i, (a, b) in enumerate(rl))
    o += panel(48, 724, 1344, 170, label(20, 18, "Rules") + rh)
    page("Chat.dc.html", "Make the map from a chat", 1440, 940, o)


def filespec():
    o = H(48, 40, "A map file is rows of boxes on a 12-column grid, with tiles named by number")
    o += sub(48, 82, "Plain Markdown that a person can read and edit. The canvas works out exact sizes, bands and lines.")
    src = open("/home/claude/mapfile/support-inbox-triage.map.md").read()
    code = html.escape(src)
    o += panel(48, 140, 620, 820, label(20, 16, "support-inbox-triage.map.md") +
               f'<pre style="position:absolute;left:20px;top:46px;right:20px;margin:0;{MF};font-size:11.5px;line-height:1.62;color:{TX2};white-space:pre-wrap">{code}</pre>')
    # result
    big = tiny_map(20, 52, 400, 340)
    keys = [("Header", "Build, width, background, numbers"), ("## Row", "A full-width strip, read top to bottom"), ("- Box", "Session, columns out of 12, tiles by number"),
            ("- Column", "Stacks boxes inside one column"), ("Frame:", "Draws a part frame round the row"), ("## Two-way", "Pairs that can run at the same time")]
    kh = "".join(f'<div style="display:flex;flex-direction:column;gap:2px;height:52px"><span style="{MF};font-size:11.5px;color:{TX}">{a}</span><span style="font-size:12.5px;color:{TX2}">{b}</span></div>' for a, b in keys)
    o += panel(692, 140, 700, 420, label(20, 16, "What the canvas makes from it") + big + A(444, 52, kh, 236))
    # check table
    checks = [("Refused", "A different build, an unknown version, or no tiles placed at all."),
              ("Fixed and listed", "Columns that don't add up to 12 are scaled. A tile listed twice keeps its first place."),
              ("Fixed and listed", "Tiles from two sessions in one box are split into one box per session."),
              ("Fixed and listed", "A box above a tile it depends on moves down to the first row where order holds."),
              ("Fixed and listed", "Two-way pairs that depend on each other are removed. Ends that aren't level slide into the same band."),
              ("Left out and listed", "Tiles not in the file stay unplaced in Sources. Lines written by the chat are ignored: lines come from the build.")]
    ch = "".join(f'<div style="display:flex;gap:14px;padding:9px 0;border-top:1px solid {HAIRM}"><span style="width:130px;flex-shrink:0;font-size:12.5px;color:{AMB if r == "Refused" else (MINT if r.startswith("Fixed") else TX2)}">{r}</span><span style="font-size:12.5px;color:{TX2};line-height:1.45">{t}</span></div>' for r, t in checks)
    o += panel(692, 584, 700, 376, label(20, 16, "The drop check") + A(20, 46, ch, 660))
    page("MapFile.dc.html", "The map file", 1440, 1000, o)


if __name__ == "__main__":
    flow(); filespec()
