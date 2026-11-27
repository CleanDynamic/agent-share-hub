"""Board 1: the finished map. One filled rectangle, read in build order."""
from lib import *

W = 1600


def card(x, y, w, h, num, kind, title, body="", mono=False):
    b = (f'<pre style="margin:8px 0 0;{MF};font-size:10.5px;line-height:1.6;color:#A4AAA5;white-space:pre">{body}</pre>' if mono
         else (f'<div style="margin-top:8px;font-size:12.5px;line-height:1.5;color:#A4AAA5">{body}</div>' if body else ""))
    return (f'<div style="position:absolute;left:{x}px;top:{y}px;width:{w}px;height:{h}px;box-sizing:border-box;border-radius:10px;'
            f'background:linear-gradient(180deg,#1A1D1B,#131514);box-shadow:0 6px 16px rgba(0,0,0,.32),inset 0 0 0 .5px #2C322D;padding:12px 14px;overflow:hidden">'
            f'<div style="display:flex;align-items:center;gap:8px;white-space:nowrap"><span style="{MF};font-size:10.5px;color:#EDEFEC;background:#2A2E2B;border-radius:5px;padding:2px 6px">{num}</span>'
            f'<span style="{MF};font-size:9.5px;color:#858C87">{kind}</span><span style="font-size:14px;color:#EDEFEC">{title}</span></div>{b}</div>')


def note(x, y, a, b="", w=300, right=False):
    al = "text-align:right;" if right else ""
    s = f'<span style="font-size:11.5px;color:{INK3};line-height:1.45">{b}</span>' if b else ""
    return f'<div style="position:absolute;left:{x}px;top:{y}px;width:{w}px;display:flex;flex-direction:column;gap:3px;{al}"><span style="font-size:13px;color:{INK}">{a}</span>{s}</div>'


def insp(x, y, rows, w=230):
    r = "".join(f'<div style="display:flex;gap:8px;height:20px;align-items:center"><span style="width:62px;font-size:10px;color:{INK3}">{a}</span>'
                f'<span style="flex-grow:1;height:19px;border-radius:4px;background:#2E322F;{MF};font-size:10px;color:{INK2};display:flex;align-items:center;padding:0 7px">{b}</span></div>' for a, b in rows)
    return (f'<div style="position:absolute;left:{x}px;top:{y}px;width:{w}px;box-sizing:border-box;background:#232624;border-radius:8px;box-shadow:0 6px 16px rgba(0,0,0,.3),inset 0 0 0 .5px #3A3E3B;padding:8px;display:flex;flex-direction:column;gap:4px">'
            f'<span style="align-self:flex-start;height:18px;padding:0 7px;border-radius:4px;background:#2E322F;display:flex;align-items:center;font-size:9.5px;color:{INK2}">Prompt 4 settings</span>{r}</div>')


def bxhead(x, y, w, s, name, app, expl):
    return (f'<div style="position:absolute;left:{x + 20}px;top:{y + 16}px;width:{w - 40}px;display:flex;flex-direction:column;gap:6px">'
            f'<div style="display:flex;align-items:center;gap:10px"><span style="{MF};font-size:10.5px;color:{INK3};border:1px solid #5E635F;border-radius:5px;padding:1px 6px">S{s}</span>'
            f'<span style="font-size:16px;font-weight:600;color:{INK}">{name}</span><span style="font-size:12px;color:{INK3}">{app}</span></div>'
            f'<span style="font-size:12.5px;color:{INK2};line-height:1.45">{expl}</span></div>')


# geometry shared with other boards
G = {}


def finished():
    out = ""
    # intro, spans the width
    out += box(16, 16, 1568, 132, fill="rgba(255,255,255,.035)", border="1px solid #5E635F", r=12)
    out += (f'<div style="position:absolute;left:40px;top:44px;display:flex;align-items:center;gap:12px"><span style="width:44px;height:44px;border-radius:50%;background:#0A0B0A;display:flex;align-items:center;justify-content:center;{MF};font-size:11px;color:{INK2}">MI</span>'
            f'<span style="display:flex;flex-direction:column"><span style="font-size:16px;color:{INK}">Miles</span><span style="font-size:12px;color:{INK3}">@neoscaleai</span></span></div>'
            + T(250, 40, "How the support inbox triage is built", 28, INK, 760, 600, lh=1.2)
            + T(250, 82, "9 tiles in 3 sessions. Classify and Refund rules run side by side, then Draft and send uses both.", 14, INK2, 760)
            + T(1110, 44, "PART A · 2 sessions<br>PART B · 1 session<br>Numbers: build order", 12, INK3, 440, mono=True, lh=1.7))
    # Part A
    out += frame(16, 172, 1568, 598, "Part A")
    y0 = 224
    out += box(32, y0, 756, 530, r=12, fill="rgba(255,255,255,.035)")
    out += box(812, y0, 756, 530, r=12, fill="rgba(107,226,160,.055)")
    out += bxhead(32, y0, 756, 1, "Classify", "Claude Code", "Every email gets one label before anything else.")
    out += bxhead(812, y0, 756, 2, "Refund rules", "Cursor", "Runs alongside Classify. Its rules feed Prompt 3.")
    B = [y0 + 92, y0 + 242, y0 + 392]  # band tops
    cw = 332
    xS1, xS2 = 788 - 20 - cw, 832
    # Session 1 tiles on the right of their box, notes on the left: cards face each other across the gutter
    out += card(xS1, B[0], cw, 120, "1", "PROMPT", "Label the last 200 emails", "Give each support email one label: refund, bug, question or other.")
    out += card(xS1, B[1], cw, 108, "2", "FILE", "labels.json", '{ "id": 4812, "label": "refund" }\n{ "id": 4813, "label": "bug" }', True)
    out += card(xS1, B[2], cw, 120, "3", "PROMPT", "Merge the refund rules", "Add the rules from Session 2 to every email labelled refund.")
    out += note(52, B[0] + 26, "Starts the build", "Runs at the same time as Prompt 4.", 330, True)
    out += note(52, B[1] + 26, "One label per email", "Made by Prompt 1.", 330, True)
    out += note(52, B[2] + 26, "Waits for the rules", "Uses Prompt 4, so it sits in a later band.", 330, True)
    # Session 2
    out += card(xS2, B[0], cw, 120, "4", "PROMPT", "Write the refund rules", "Turn the refund policy into rules a script can check.")
    out += insp(xS2 + cw + 24, B[0] + 12, [("Model", "Opus 5.5"), ("Effort", "High"), ("Harness", "Cursor")])
    out += card(xS2, B[1], cw, 108, "5", "CODE", "refundRules.ts", "export const rules = [\n  overFifty, noReceipt, ...\n]", True)
    out += card(xS2 + 28, B[2], cw - 28, 92, "6", "CHECK", "Rules pass 30 cases", "Tests Code 5 against 30 past refunds.")
    out += note(xS2 + cw + 24, B[2] + 20, "Sits under Code 5", "Indented one level: it tests it.", 300)
    # Part B
    out += frame(16, 794, 1568, 570, "Part B")
    y3 = 846
    out += box(32, y3, 1536, 246, r=12, fill="rgba(255,255,255,.035)")
    out += bxhead(32, y3, 420, 3, "Draft and send", "Claude Code", "Starts once the labels and rules are merged.")
    out += card(xS1, y3 + 92, cw, 120, "7", "AGENT", "Reply drafter", "Drafts a reply for each labelled email, under 120 words.")
    out += card(xS2, y3 + 92, cw, 120, "8", "TOOL", "Gmail", "Reads the inbox and saves the drafts.")
    out += note(xS2 + cw + 24, y3 + 118, "Tile 7 uses tile 8", "Side by side: they run together.", 300)
    yr = 1116
    out += box(32, yr, 1536, 232, r=12, fill="rgba(255,255,255,.035)")
    out += (f'<div style="position:absolute;left:52px;top:{yr + 16}px;display:flex;align-items:center;gap:10px"><span style="{MF};font-size:10.5px;color:{INK3};border:1px solid #5E635F;border-radius:5px;padding:1px 6px">S3</span>'
            f'<span style="font-size:16px;font-weight:600;color:{INK}">Result</span><span style="font-size:12px;color:{INK3}">Spans the width · last in reading order</span></div>')
    rows = "".join(f'<div style="display:flex;gap:10px;align-items:center;padding:8px 12px;border-radius:8px;background:#1B1F1C"><span style="font-size:13px;flex-grow:1;color:#EDEFEC">{s}</span>'
                   f'<span style="{MF};font-size:10.5px;color:#A4AAA5">{l}</span><span style="font-size:11.5px;color:{"#E8B86B" if st == "Needs sign-off" else "#6BE2A0"};width:96px;text-align:right">{st}</span></div>'
                   for s, l, st in (("Order 4812 arrived broken", "refund", "Draft ready"), ("App crashes on sign in", "bug", "Draft ready"), ("Refund for order 4790, £86", "refund", "Needs sign-off")))
    out += (f'<div style="position:absolute;left:{xS1}px;top:{yr + 56}px;width:{(xS2 + cw) - xS1}px;box-sizing:border-box;border-radius:12px;background:#121513;box-shadow:0 14px 34px rgba(0,0,0,.45),inset 0 0 0 .5px #2C322D;padding:12px 16px;display:flex;flex-direction:column;gap:7px">'
            f'<div style="display:flex;align-items:center;gap:10px"><span style="{MF};font-size:10.5px;color:#EDEFEC;background:#2A2E2B;border-radius:5px;padding:2px 6px">9</span><span style="{MF};font-size:9.5px;color:#858C87">RESULT</span><span style="font-size:14px;color:#EDEFEC">Support inbox</span><span style="margin-left:auto;font-size:12px;color:#6BE2A0">3 drafts ready</span></div>{rows}</div>')
    # lines: makes (down), uses (gutter), two-way (level), tests (dashed)
    gx = 800
    c1 = xS1 + cw // 2
    c2 = xS2 + cw // 2
    ln = (line(f"M{c1} {B[0] + 120}V{B[1]}") +
          line(f"M{c2} {B[0] + 120}V{B[1]}") +
          line(f"M{xS2 + cw} {B[2] + 46}H{xS2 + cw + 12}V{B[1] + 70}H{xS2 + cw}", dash=True) +
          line(f"M{xS2} {B[0] + 96}H{gx}V{B[2] + 60}H{xS1 + cw}") +
          line(f"M{xS1 + cw} {B[0] + 48}H{xS2}", col=MINT, both=True, width=1.6) +
          line(f"M{c1} {B[2] + 120}V{y3 + 92}") +
          line(f"M{xS2} {y3 + 152}H{xS1 + cw}") +
          line(f"M{c1} {y3 + 212}V{yr + 56}") +
          f'<path d="M{xS2 + 14} {B[1] + 108}V{B[2] + 46}H{xS2 + 28}" stroke="{INK3}" stroke-width="1.2"></path>')
    out += svg(W, 1370, ln)
    out += (f'<div style="position:absolute;left:{gx - 34}px;top:{B[0] + 22}px;height:18px;padding:0 6px;border-radius:5px;background:{BG};color:{MINT};font-size:11px;display:flex;align-items:center">same time</div>')
    G.update(dict(B=B, xS1=xS1, xS2=xS2, cw=cw, y3=y3, yr=yr, y0=y0))
    return out


def build():
    page("Main.dc.html", "The finished map", W, 1380, finished(), bg=BG)


if __name__ == "__main__":
    build()
