# Map sandbox references

What the MS series (`design/prompts/ms-series/`) compares against.

| Path | What it is |
| --- | --- |
| `01-finished-map.png` to `13-map-file.png` | The thirteen boards, rendered at their full size. Pictures for shape and behaviour, not exact values. |
| `examples/support-inbox-triage.for-chat.md` | What Copy for chat produces for the support inbox triage build. |
| `examples/support-inbox-triage.map.md` | A map file a chat would send back for it. |
| `source/*.dc.html` | The boards' HTML sources, one per board, and `canvas.json` with their order and titles. |
| `source/generators/*.py` | The Python that wrote the sources. `lib.py` holds the shared pieces; each `b*.py` writes one or more boards. `ROOT` in `lib.py` and the example path in `b1213.py` point at the paths used when they were made: change them before running. |

| Board | Source | Generator |
| --- | --- | --- |
| 01 The finished map | `Main.dc.html` | `b1.py` |
| 02 Tree of splits | `Tree.dc.html` | `b2.py` |
| 03 Shaping tools | `Shaping.dc.html` | `b3.py` |
| 04 Order and two-way arrows | `Order.dc.html` | `b4.py` |
| 05 Moving things | `Moving.dc.html` | `b56.py` |
| 06 Sessions and parts | `Grouping.dc.html` | `b56.py` |
| 07 Inside a box | `Inside.dc.html` | `b78.py` |
| 08 Lines | `Lines.dc.html` | `b78.py` |
| 09 Style and helpers | `Style.dc.html` | `b911.py` |
| 10 Canvas size | `Size.dc.html` | `b911.py` |
| 11 The editor | `Editor.dc.html` | `b911.py` |
| 12 Make the map from a chat | `Chat.dc.html` | `b1213.py` |
| 13 The map file | `MapFile.dc.html` | `b1213.py` |

The live versions are on claude.ai, private to Miles:

- The doc "The structured sandbox: how the map can work": https://claude.ai/artifact/3h9eaptCvV5cBugnC4LksH (copied into `design/prompts/ms-series/MODEL.md`)
- The canvas "Structured sandbox: how the map works": https://claude.ai/artifact/6MjYSxqJKZiSFk9SH9o5yj

A session can't open those links. Everything it needs is in this folder and in `MODEL.md`.
