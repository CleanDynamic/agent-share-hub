"""Board 9: style and helpers. Board 10: canvas size. Board 11: the editor."""
from lib import *
import b1


def tiny(bg=BG, ink=INK, chipbg="#161917", fills=("rgba(255,255,255,.05)",) * 3, border="#5E635F"):
    """A small version of the finished map's shape."""
    def bx(x, y, w, h, f):
        return f'<div style="position:absolute;left:{x}px;top:{y}px;width:{w}px;height:{h}px;box-sizing:border-box;border-radius:5px;border:1px solid {border};background:{f}"></div>'
    def ch(x, y, w, h):
        return f'<div style="position:absolute;left:{x}px;top:{y}px;width:{w}px;height:{h}px;border-radius:3px;background:{chipbg}"></div>'
    o = bx(6, 6, 188, 22, fills[0]) + bx(6, 34, 92, 86, fills[1]) + bx(102, 34, 92, 86, fills[2]) + bx(6, 126, 188, 38, fills[0])
    for i in range(3):
        o += ch(50, 44 + i * 24, 42, 16) + ch(108, 44 + i * 24, 42, 16)
    o += ch(50, 134, 42, 22) + ch(108, 134, 42, 22)
    o += f'<div style="position:absolute;left:12px;top:12px;width:60px;height:4px;border-radius:2px;background:{ink};opacity:.8"></div>'
    return o


def style():
    o = H(48, 40, "Style and helpers: free choices from a palette that stays readable, plus two tidy-up tools")
    o += sub(48, 82, "Every box starts the same. Fills, borders and corners are per box; the background is per canvas; numbers are a display choice.")
    # box style bar
    sw = "".join(f'<span style="width:26px;height:26px;border-radius:7px;border:1px solid {EDGE};background:{c};{("box-shadow:0 0 0 2px " + MOD + ",0 0 0 3.5px " + TX) if i == 2 else ""}"></span>' for i, c in enumerate(["transparent", "#45494A", "#2F4A3A", "#4A4232", "#33404F", "#40344A"]))
    bar = (f'<div style="position:absolute;left:20px;top:52px;height:46px;padding:0 12px;border-radius:11px;background:{RAISED};border:1px solid {EDGE};display:flex;align-items:center;gap:12px;font-size:13px;color:{TX2};white-space:nowrap">'
           f'<span style="color:{TX}">Box · S1</span><span style="width:1px;height:22px;background:{HAIRM}"></span>Fill{sw}<span style="width:1px;height:22px;background:{HAIRM}"></span>Border'
           f'<span style="display:flex;gap:2px;background:{SURF};border-radius:7px;padding:3px"><span style="padding:5px 10px;border-radius:5px;background:{MINT};color:#040504;font-weight:600">Line</span><span style="padding:5px 10px">Dashed</span><span style="padding:5px 10px">None</span></span>'
           f'<span style="width:1px;height:22px;background:{HAIRM}"></span>Corners <span style="{MF};color:{TX}">12</span><span style="width:1px;height:22px;background:{HAIRM}"></span>Copy style · Paste style</div>')
    o += panel(48, 140, 1344, 170, label(20, 16, "Box style") + bar +
               T(20, 114, "Tints are checked for contrast against every background, so text stays readable whatever is picked. Copy style and paste it onto other boxes to keep a map consistent.", 13, TX2, 1300))
    # backgrounds
    bgs = [("Grey", BG, INK, "#161917"), ("Dusk", "#141416", INK, "#232624"), ("Slate", "#2B3138", INK, "#161A1E"), ("Paper", "#EDEDE8", "#141416", "#FFFFFF")]
    bgh = ""
    for i, (n, c, ink, cb) in enumerate(bgs):
        bord = "#B9BBB6" if n == "Paper" else "#5E635F"
        fl = ("rgba(0,0,0,.03)",) * 3 if n == "Paper" else ("rgba(255,255,255,.05)",) * 3
        bgh += canvas(20 + i * 220, 52, 200, 170, tiny(c, ink, cb, fl, bord), bg=c, r=8) + T(20 + i * 220, 230, n, 12.5, TX)
    o += panel(48, 334, 900, 280, label(20, 16, "Canvas background") + bgh +
               T(20, 252, "One colour for the whole canvas. On Paper, text and line colours flip automatically. Readers see the same colour.", 12.5, TX2, 860))
    # numbers
    nums = [("Build", "5"), ("Session", "S2·2"), ("Part", "A·S2·2")]
    nh = "".join(chip(20, 56 + i * 44, n2, "refundRules.ts", w=200, h=32) + T(240, 63 + i * 44, n1, 13, TX) for i, (n1, n2) in enumerate(nums))
    o += panel(972, 334, 420, 280, label(20, 16, "Numbers") + nh +
               T(20, 196, "Changes every badge at once. Numbers always come from the build, so moving a box never renumbers anything.", 12.5, TX2, 380))
    # tidy
    messy = (box(8, 8, 90, 70, "", r=5) + box(103, 8, 89, 64, "", r=5) + box(8, 83, 180, 70, "", r=5) +
             svg(200, 160, f'<path d="M98 30H102V60" stroke="{INK3}" stroke-width="1.2"></path><path d="M60 78V82" stroke="{AMB}" stroke-width="2"></path><path d="M192 72V80" stroke="{AMB}" stroke-width="2"></path>'))
    tidy = box(8, 8, 90, 70, "", r=5) + box(106, 8, 86, 70, "", r=5) + box(8, 86, 184, 66, "", r=5)
    o += panel(48, 638, 660, 300, label(20, 16, "Tidy") + canvas(20, 52, 200, 160, messy, r=8) + arrow_r(232, 126, 40) + canvas(284, 52, 200, 160, tidy, r=8) +
               T(500, 56, "Snaps edges a few pixels apart, evens near-equal sizes, straightens pointless bends, removes empty boxes. Previews first.", 12.5, TX2, 144) +
               no(20, 236, "Never changes order, grouping or anything inside a box.", 620))
    # collapse
    ex = box(8, 8, 184, 144, "S2 · Refund rules", "", r=5, tsize=10.5) + "".join(chip(18, 34 + i * 36, str(4 + i), "", w=164, h=28) for i in range(3))
    co = (box(8, 8, 184, 34, "S2 · Refund rules", "4–6 · 3 tiles", r=5, tsize=10.5) + box(8, 48, 184, 104, "S3", "", r=5, tsize=10.5, extra="opacity:.6"))
    o += panel(732, 638, 660, 300, label(20, 16, "Collapse") + canvas(20, 52, 200, 160, ex, r=8) + arrow_r(232, 126, 40) + canvas(284, 52, 200, 160, co, r=8) +
               T(500, 56, "Folds a box to one line: title, number range, tile count. Neighbours take the height.", 12.5, TX2, 144) +
               ok(20, 236, "Shape a 50-tile build first, then dress each box. Readers can open collapsed boxes.", 620))
    page("Style.dc.html", "Style and helpers", 1440, 980, o)


def size():
    o = H(48, 40, "The canvas width is chosen, its height comes from the build, and big builds scroll")
    o += sub(48, 82, "Boxes are stored as proportions, so changing the width rescales the map without breaking it. A row is as tall as its tallest box.")
    # widths
    wd = ""
    for i, (n, w) in enumerate((("Narrow", 150), ("Standard", 200), ("Wide", 260))):
        sx = w / 200
        x = 20 + sum((150, 200, 260)[:i]) + i * 30
        wd += canvas(x, 52, w, int(170 * min(1.0, 1)), f'<div style="position:absolute;left:0;top:0;width:200px;height:170px;transform:scale({sx},1);transform-origin:0 0">{tiny()}</div>', r=8) + T(x, 232, n, 12.5, TX)
    o += panel(48, 140, 720, 300, label(20, 16, "Width snaps to the 12-column grid") + wd +
               T(20, 258, "Free width that snaps to the grid, with a minimum box width. If a box would get too narrow, the width is refused.", 12.5, TX2, 680))
    # 50 tiles
    rows = ""
    y = 8
    for i in range(10):
        n = 2 + (i % 3)
        wcol = (184 - (n - 1) * 6) / n
        for j in range(n):
            rows += f'<div style="position:absolute;left:{8 + j * (wcol + 6)}px;top:{y}px;width:{wcol}px;height:46px;box-sizing:border-box;border-radius:4px;border:1px solid #5E635F;background:rgba(255,255,255,.04)"></div>'
        y += 52
    tall = canvas(20, 52, 200, 540, rows, r=8)
    view = f'<div style="position:absolute;left:16px;top:{52 + 104}px;width:208px;height:160px;border-radius:9px;box-shadow:0 0 0 2px {MINT}"></div>'
    mm = (f'<div style="position:absolute;left:250px;top:52px;width:96px;height:200px;border-radius:8px;background:{RAISED};border:1px solid {EDGE}">'
          f'<div style="position:absolute;left:8px;top:8px;width:80px;height:184px;border-radius:4px;background:{BG}"></div>'
          f'<div style="position:absolute;left:6px;top:46px;width:84px;height:56px;border-radius:4px;box-shadow:inset 0 0 0 1.5px {MINT}"></div></div>')
    o += panel(792, 140, 600, 640, label(20, 16, "A 50-tile build, 10 boxes tall") + tall + view + mm +
               T(370, 56, "The canvas scrolls inside the Map tab. The minimap shows the whole rectangle and where you are.", 12.5, TX2, 200) +
               T(370, 150, "Picking a session in Sources scrolls to it and highlights it.", 12.5, TX2, 200) +
               T(370, 220, "Collapsed boxes keep big sessions to one line while you shape the rest.", 12.5, TX2, 200) +
               T(370, 290, "Only boxes near the screen are fully drawn, so scrolling stays smooth.", 12.5, TX2, 200))
    # phone
    ph = (box(8, 8, 104, 30, "Intro", "", r=4, tsize=9) + box(8, 44, 104, 52, "S1", "1–3", r=4, tsize=9) + box(8, 102, 104, 52, "S2", "4–6", r=4, tsize=9) +
          box(8, 160, 104, 40, "S3", "7 · 8", r=4, tsize=9) + box(8, 206, 104, 30, "Result", "9", r=4, tsize=9))
    o += panel(48, 464, 720, 316, label(20, 16, "On a phone, side-by-side boxes stack in reading order") + canvas(20, 52, 120, 244, ph, r=12) +
               T(170, 60, "Below phone width, boxes that sat side by side stack, in exactly the order the map is read. Because the reading order always matches the build, the phone view needs no separate layout.", 13, TX2, 520))
    page("Size.dc.html", "Canvas size", 1440, 820, o)


def editor():
    from lib import TX as _t
    btn = lambda t, on=False: f'<span style="height:30px;padding:0 11px;border-radius:7px;background:{RAISED if on else "transparent"};color:{TX if on else TX2};font-size:13px;display:flex;align-items:center">{t}</span>'
    seg = lambda items, on: f'<span style="display:flex;gap:2px;padding:3px;border-radius:9px;border:1px solid {HAIRM}">' + "".join(btn(i, i == on) for i in items) + '</span>'
    header = (f'<div style="position:absolute;left:0;top:0;width:1440px;height:48px;background:{PAGE};display:flex;align-items:center;gap:24px;padding:0 20px;box-sizing:border-box">'
              f'<span style="display:flex;align-items:center;gap:8px;font-size:15px;font-weight:600"><span style="width:18px;height:18px;border-radius:5px;background:{TX}"></span>OpenBuilds</span>'
              f'<span style="display:flex;gap:22px;font-size:14px;color:{TX2}"><span>Home</span><span>Builds</span><span>OpenBuilds</span><span>Library</span><span style="color:{TX}">Drafts</span></span></div>')
    top = (T(71, 70, "Home  /  Drafts  /  Support inbox triage", 13, TX2) + T(71, 100, "Support inbox triage", 20, TX, weight=500) + T(71, 132, "Draft · saved just now", 12.5, TX2) +
           A(1100, 104, f'<div style="display:flex;gap:10px">{seg(["List", "Map"], "Map")}' + "".join(f'<span style="height:34px;padding:0 14px;border-radius:8px;border:1px solid {EDGE};background:{MOD};display:flex;align-items:center;font-size:13.5px">{x}</span>' for x in ("Card", "Preview")) + f'<span style="height:34px;padding:0 14px;border-radius:8px;background:{TX};color:{PAGE};display:flex;align-items:center;font-size:13.5px">Publish</span></div>') +
           f'<div style="position:absolute;left:71px;top:170px;width:1298px;border-top:1px solid {HAIR}"></div>')
    # sources with frame / outline buttons
    fbt = lambda on: f'<span style="margin-left:auto;display:flex;gap:4px"><span style="width:22px;height:22px;border-radius:6px;border:1px solid {MINT if on else EDGE};color:{MINT if on else TX2};display:flex;align-items:center;justify-content:center;font-size:10px">▣</span><span style="width:22px;height:22px;border-radius:6px;border:1px solid {EDGE};color:{TX2};display:flex;align-items:center;justify-content:center;font-size:10px">⌐</span></span>'
    srows = ""
    for part, sess in (("A", [(1, "Classify", ["Label the last 200 emails", "labels.json", "Merge the refund rules"]), (2, "Refund rules", ["Write the refund rules", "refundRules.ts", "Rules pass 30 cases"])]),
                       ("B", [(3, "Draft and send", ["Reply drafter", "Gmail", "Support inbox"])])):
        srows += f'<div style="display:flex;align-items:center;height:28px;margin-top:8px;{MF};font-size:11px;color:{LAB};letter-spacing:.06em">PART {part}{fbt(True)}</div>'
        for s, name, tiles in sess:
            srows += f'<div style="display:flex;align-items:center;height:30px;font-size:13px;gap:6px"><span style="{MF};font-size:10.5px;color:{LAB}">S{s}</span>{name}{fbt(s != 2)}</div>'
            for k, tname in enumerate(tiles):
                n = (s - 1) * 3 + k + 1
                srows += f'<div style="height:34px;margin:0 0 3px 8px;border-radius:8px;background:{SURF};display:flex;align-items:center;gap:8px;padding:0 10px"><span style="{MF};font-size:10.5px;color:{LAB};width:14px">{n}</span><span style="font-size:12.5px;flex-grow:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{tname}</span><span style="font-size:10.5px;color:{MINT}">placed</span></div>'
    sources = f'<aside style="position:absolute;left:71px;top:188px;width:252px;height:800px;box-sizing:border-box;border-radius:12px;background:{MOD};padding:14px 12px"><div style="display:flex;justify-content:space-between"><span style="font-size:14px;font-weight:500">Sources</span><span style="font-size:12px;color:{LAB}">9 of 9 placed</span></div>{srows}</aside>'
    # toolbar
    tb = (f'<div style="position:absolute;left:12px;right:12px;top:10px;display:flex;justify-content:space-between;align-items:center">'
          f'<div style="display:flex;gap:8px">{seg(["Select", "Box", "Text", "Arrow ▾"], "Select")}{seg(["Tidy", "Collapse"], "")}</div>'
          f'<div style="display:flex;gap:8px;align-items:center"><span style="font-size:13px;color:{TX2}">Numbers</span>{seg(["Build", "Session", "Part"], "Build")}'
          f'<span style="height:30px;padding:0 10px 0 6px;border-radius:7px;border:1px solid {EDGE};background:{RAISED};display:flex;align-items:center;gap:8px;font-size:13px"><span style="width:18px;height:18px;border-radius:5px;background:{BG}"></span>Background</span>'
          f'<span style="{MF};font-size:12px;color:{TX2}">60%</span><span style="height:30px;padding:0 11px;border-radius:7px;border:1px solid {EDGE};display:flex;align-items:center;font-size:13px">Fit</span></div></div>')
    # canvas with the finished map
    S = 0.6
    world = f'<div style="position:absolute;left:12px;top:-60px;width:1600px;height:1380px;transform:scale({S});transform-origin:0 0;background:{BG}">{b1.finished()}</div>'
    G = b1.G
    selx, sely, selw, selh = 12 + 812 * S, -60 + G["y0"] * S, 756 * S, 530 * S
    hs = "".join(f'<span style="position:absolute;left:calc({a}% - 4px);top:calc({b}% - 4px);width:8px;height:8px;background:{TX};box-shadow:0 0 0 1.5px {MINT}"></span>' for a, b in ((0, 0), (50, 0), (100, 0), (0, 50), (100, 50), (0, 100), (50, 100), (100, 100)))
    sel = f'<div style="position:absolute;left:{selx}px;top:{sely}px;width:{selw}px;height:{selh}px;border-radius:8px;box-shadow:0 0 0 2px {MINT}">{hs}</div>'
    fb = (f'<div style="position:absolute;right:{1006 - (selx + selw)}px;top:{sely - 52}px;height:42px;padding:0 10px;border-radius:10px;background:{MOD};border:1px solid {EDGE};box-shadow:0 14px 30px rgba(0,0,0,.5);display:flex;align-items:center;gap:10px;font-size:12.5px;color:{TX2};white-space:nowrap">'
          f'<span style="color:{TX}">Box · S2</span><span style="width:1px;height:20px;background:{HAIRM}"></span>Split<span>Merge</span><span>Span</span><span>Even out</span><span>Match</span><span style="width:1px;height:20px;background:{HAIRM}"></span>Stack<span style="width:1px;height:20px;background:{HAIRM}"></span>'
          f'<span style="width:18px;height:18px;border-radius:5px;background:#2F4A3A;box-shadow:0 0 0 1.5px {TX}"></span>Fill<span>Border</span><span>···</span></div>')
    well = f'<div style="position:absolute;left:12px;top:52px;width:1006px;height:736px;border-radius:10px;overflow:hidden;background:{BG}">{world}{sel}{fb}</div>'
    cmod = f'<section style="position:absolute;left:339px;top:188px;width:1030px;height:800px;box-sizing:border-box;border-radius:12px;background:{MOD}">{tb}{well}</section>'
    body = header + f'<div style="position:absolute;left:8px;top:48px;width:1424px;height:972px;background:{SURF};border-radius:12px 12px 0 0"></div>' + top + sources + cmod
    page("Editor.dc.html", "The editor", 1440, 1020, body, bg=PAGE)


if __name__ == "__main__":
    style(); size(); editor()
