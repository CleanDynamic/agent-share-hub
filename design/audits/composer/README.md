# Composer screenshots (CA-02 P10)

`after/` holds the composer dev page (`/dev/kit/pages/sandbox`) after CA-02, in Dusk and Noon, at 1280 and 390 wide.
File names are `<what>-<theme>-<width>.png`.

| What | How it was opened |
|---|---|
| `tool-menu` | Typed here's tool picker |
| `model-menu-claude` | Typed here, Claude, the model menu (Anthropic's models only) |
| `model-menu-hermes-other` | Add › Agent or team, Runs in Hermes Agent, the model menu's Other model field |
| `model-menu-v0-tiers` | Typed here, v0, the model menu (its tiers) |
| `model-menu-manus-hidden` | Add › Agent or team, Runs in Manus (its note in place of a menu) |
| `add-as-an-agent` | Typed here with text, Hermes Agent picked: the Add as an agent line |
| `agent-dialog-two-models-two-tools` | Add › Agent or team in Claude Code, two models, Gmail and Vercel |
| `add-menu-with-code` | The Add menu, Code after Manual step |
| `code-dialog-upload` | Add › Code with `app.ts` uploaded |
| `details-pair-note` | `?build=bakery&details=pair`: a typed prompt saved as Claude with Grok 4.7 |
| `shape-<key>-list`, `shape-<key>-map` | `?build=shape-<key>` and `&lens=map`, for the five shapes in `src/dev/fixtures/shapes.ts` |

The composer shows the List on a phone; the Map is drawn from 768 wide up, so the 390 `-map` shots show the List.

## Design compare

`npm run audit:design -- --grep composer`, run with `DESIGN_MAX_DIFF=0` so each board reports its exact difference,
on the branch's base (`87e2636`) and after CA-02. No value had been recorded for these boards before.

| Board | Before | After |
|---|---|---|
| refined/dusk/composer-list | 2.083% (46,784 px) | 2.083% (46,782 px) |
| refined/dusk/composer-map | 1.572% (28,074 px) | 1.572% (28,074 px) |
| refined/dusk/composer-card | 0.896% (12,898 px) | 0.896% (12,898 px) |
| refined/noon/composer-list | 2.166% (48,667 px) | 2.166% (48,662 px) |
| refined/noon/composer-map | 1.586% (28,312 px) | 1.586% (28,312 px) |
| refined/noon/composer-card | 2.228% (32,082 px) | 2.229% (32,095 px) |

All six pass the 4% threshold; none rose by more than 0.001 points.
