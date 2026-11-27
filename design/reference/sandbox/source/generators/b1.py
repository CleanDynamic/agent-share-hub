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
    y0 = 224
    H = TILE_H
    B = [y0 + 92]
    h4 = 220
    B.append(B[0] + h4 + 30)
    B.append(B[1] + H["code"] + 30)
    hA = B[2] + H["check"] + 28 - y0
    out += frame(16, 172, 1568, hA + 68, "Part A")
    out += box(32, y0, 756, hA, r=12, fill="rgba(255,255,255,.035)")
    out += box(812, y0, 756, hA, r=12, fill="rgba(107,226,160,.055)")
    out += bxhead(32, y0, 756, 1, "Classify", "Claude Code", "Every email gets one label before anything else.")
    out += bxhead(812, y0, 756, 2, "Refund rules", "Cursor", "Runs alongside Classify. Its rules feed Prompt 3.")
    cw = 332
    xS1, xS2 = 788 - 20 - cw, 832
    # Session 1 tiles on the right of their box, notes on the left: tiles face each other across the gutter
    out += tile(xS1, B[0], cw, 1, "prompt", "Prompt", "Label the last 200 emails", "Give each support email one label: refund, bug, question or other.")
    out += tile(xS1, B[1], cw, 2, "file", "File", "labels.json", "One label for each of the 200 emails.", foot="made by prompt 1")
    out += tile(xS1, B[2], cw, 3, "prompt", "Prompt", "Merge the refund rules", "Add the rules from Session 2 to every email labelled refund.")
    out += note(52, B[0] + 26, "Starts the build", "Runs at the same time as Prompt 4.", 330, True)
    out += note(52, B[1] + 26, "One label per email", "Made by Prompt 1.", 330, True)
    out += note(52, B[2] + 26, "Waits for the rules", "Uses Prompt 4, so it sits in a later band.", 330, True)
    out += tile(xS2, B[0], cw, 4, "prompt", "Prompt", "Write the refund rules", "Turn the refund policy into rules a script can check.", settings=[("Model", "Opus 5.5"), ("Effort", "High"), ("Harness", "Cursor")], h=h4)
    out += note(xS2 + cw + 24, B[0] + 26, "Settings shown", "Picked with Show on this tile.", 300)
    out += tile(xS2, B[1], cw, 5, "code", "Code", "refundRules.ts", code="export const rules = [\n  overFifty, noReceipt,\n];")
    out += tile(xS2 + 28, B[2], cw - 28, 6, "check", "Check", "Rules pass 30 cases", criteria="sorts every past refund", status="Passed 30 of 30 runs", foot="30 test cases")
    out += note(xS2 + cw + 24, B[2] + 30, "Sits under Code 5", "Indented one level: it tests it.", 300)
    # Part B
    y3 = 172 + hA + 68 + 24 + 52
    h3 = 92 + H["agent"] + 28
    yr = y3 + h3 + 24
    hr = 56 + H["result"] + 28
    out += frame(16, y3 - 52, 1568, (yr + hr) - (y3 - 52) + 16, "Part B")
    out += box(32, y3, 1536, h3, r=12, fill="rgba(255,255,255,.035)")
    out += bxhead(32, y3, 420, 3, "Draft and send", "Claude Code", "Starts once the labels and rules are merged.")
    out += tile(xS1, y3 + 92, cw, 7, "agent", "Agent · Opus 5.5", "Reply drafter", "Drafts a reply for each labelled email, under 120 words.", foot="1 prompt")
    out += tile(xS2, y3 + 92, cw, 8, "tool", "Tool", "Gmail", "Reads the inbox and saves the drafts.", foot="MCP server")
    out += note(xS2 + cw + 24, y3 + 118, "Tile 7 uses tile 8", "Side by side: they run together.", 300)
    out += box(32, yr, 1536, hr, r=12, fill="rgba(255,255,255,.035)")
    out += (f'<div style="position:absolute;left:52px;top:{yr + 16}px;display:flex;align-items:center;gap:10px"><span style="{MF};font-size:10.5px;color:{INK3};border:1px solid #5E635F;border-radius:5px;padding:1px 6px">S3</span>'
            f'<span style="font-size:16px;font-weight:600;color:{INK}">Result</span><span style="font-size:12px;color:{INK3}">Spans the width · last in reading order</span></div>')
    out += tile(xS1, yr + 56, (xS2 + cw) - xS1, 9, "result", "Result · Inbox", "Support inbox", "3 drafts ready, 1 waiting for sign-off.", foot="an inbox · from agent 7")
    # lines: makes (down), uses (gutter), two-way (level), tests (dashed)
    gx = 800
    c1 = xS1 + cw // 2
    c2 = xS2 + cw // 2
    ln = (line(f"M{c1} {B[0] + H['prompt']}V{B[1]}") +
          line(f"M{c2} {B[0] + h4}V{B[1]}") +
          line(f"M{xS2 + cw} {B[2] + 60}H{xS2 + cw + 12}V{B[1] + 70}H{xS2 + cw}", dash=True) +
          line(f"M{xS2} {B[0] + 120}H{gx}V{B[2] + 56}H{xS1 + cw}") +
          line(f"M{xS1 + cw} {B[0] + 30}H{xS2}", col=MINT, both=True, width=1.6) +
          line(f"M{c1} {B[2] + H['prompt']}V{y3 + 92}") +
          line(f"M{xS2} {y3 + 92 + 60}H{xS1 + cw}") +
          line(f"M{c1} {y3 + 92 + H['agent']}V{yr + 56}") +
          f'<path d="M{xS2 + 14} {B[1] + H["code"]}V{B[2] + 46}H{xS2 + 28}" stroke="{INK3}" stroke-width="1.2"></path>')
    out += svg(W, yr + hr + 40, ln)
    out += (f'<div style="position:absolute;left:{gx - 34}px;top:{B[0] + 6}px;height:18px;padding:0 6px;border-radius:5px;background:{BG};color:{MINT};font-size:11px;display:flex;align-items:center">same time</div>')
    G.update(dict(B=B, xS1=xS1, xS2=xS2, cw=cw, y3=y3, yr=yr, y0=y0, hA=hA, H=yr + hr + 16 + 16))
    return out


def build():
    body = finished()
    page("Main.dc.html", "The finished map", W, G["H"], body, bg=BG)


if __name__ == "__main__":
    build()
