# The composer sandbox

The concept every prompt from UI-P60 to UI-P76 follows, cited as CONCEPT §n. The boards are in `design/screens/sandbox/{noon,dusk}/`. Where a prompt and this file disagree, the prompt wins for that one change. The data shapes are in `design/sandbox/DATA.md` (UI-P61).

## §1 The pieces

| Piece | What it is | Stored as |
| --- | --- | --- |
| Prompt | A message the maker sent: its title and its full text | `build_nodes` row, type `prompt` |
| Session | One chat or agent run, with its tool, model and date | an `import_sessions` row attached to the build; its public copy is in `builds.making.sessions` |
| Output | What a prompt gave back. Never stored as text, only pointed at | a `uses` entry naming that prompt |
| File | Something the AI read, such as CLAUDE.md or a brief | `document` node |
| Tool | An app or connector the AI used, such as Gmail or Web search | `integration` node |
| Agent | Prompts that run by themselves: instructions, tools, how it runs | `agent_config` node; its further prompts are child `prompt` nodes |
| Team | Agents passing work to each other | `team` node (UI-P61); its agents are child `agent_config` nodes |
| Manual step | Work done outside AI, in one line, with its tool | `manual_step` node (UI-P61) |
| Result | The finished thing: a link, a file or a picture | `result` node |

## §2 Rules

1. An arrow means "goes into". It leaves a box's right edge and ends on a named input on the left edge of a prompt, an agent, a team, a manual step or the result.
2. Steps are prompts, agents, teams and manual steps, numbered in order: 1, 2, 3. Inside an agent or a team, sub-numbers: 3.1, 3.2. An agent's instructions are its first sub-step ("3.1 Instructions"). Files, tools and results are not numbered.
3. Every prompt has a title. It starts as "Prompt 3", its number, and only the maker changes it. Nothing writes a title, a summary or a label for the maker.
4. Default names are literal: "Session 2 · Claude · 4 Oct", "Prompt 3", "Agent 3", "Team 3".
5. A box opens into its own map: a team shows its agents, an agent shows its prompts, files and tools. One level is open at a time. What it connects to outside stays in view, dimmed.
6. A suggested link is dashed until the maker accepts it. Readers never see a suggestion.
7. List and Map show the same build. Switching never changes or loses anything.
8. Layout (decision 1, A): boxes place themselves, rows by session, left to right by date. Dragging from a dot connects two boxes; nothing drags a box to a position.

## §3 How it runs

For an agent or a team. Five choices, in this order:

| Choice | Its one field | Example |
| --- | --- | --- |
| Runs once | none | |
| Runs several at once | how many, 2 to 20 | 3 at once |
| Repeats until a condition is met | the condition, up to 80 characters | until every claim has a source |
| Runs on a schedule | when, up to 60 characters | Mondays 07:00 |
| Runs when something happens | what, up to 60 characters | When a new email arrives |

## §4 What is detected

Exact facts only. Nothing is guessed, summarised or named for the maker.

- Now: a session's tool (`import_sessions.client`), model (`import_sessions.model`), date (`import_sessions.created_at`) and its prompts in order; a file's name written word for word in a prompt.
- After the parser change UI-P71 proposes: files attached, tools called and agents started (and how many at once), from structured records in the transcript only, never from prose; and an output moved between sessions, when at least 20 consecutive words of a reply appear in a later prompt, compared with whitespace collapsed.
- Every detected link arrives as a suggestion (§2.6).

## §5 The composer

- **Sources**, left, 250 wide: the only list of sources. Sessions in this build with their prompts nested under them, files in this build, sessions not in a build, the drop zone. In Map it folds to a 56px rail.
- **Build**, centre: List or Map.
- **Details**, right, 290 wide: whatever is selected.
- **Card**, behind one button: the cover picture or video first, then title, one-line summary, who it's for, made with, more details.
- **One filled button: Publish.** The status line names what is missing ("Missing: cover picture"), and each missing item opens the Card at its field.
- **Default view** (decision 3, A): every build opens in List. The List and Map switch appears once the build has two sessions or an agent, with a one-time line: "Map is now available".
- **Add menu**, seven items in this order: Prompt, Session, Agent or team, File, Tool, Manual step, Result.

## §6 The build page

- The top stays as it is: cover, shape tag, action dock, title plate, proof panel.
- **The build** replaces Anatomy, Run it yourself, the part viewer and the timeline. Tabs, in order: The build, Watch it get built, Understand it, Where it broke, Rebuilds (only when there are some). Watch it get built and Understand it keep their current bodies until the owner decides.
- Every step shows its number, title, full text (four lines, then "Read all of it") and Copy. A session's first step is headed "New chat in {tool}"; a later step in it says "Send in the same chat as step {n}". A use reads "Paste in: what step {n} gave you". A file reads "Attach {name}" with Download. Inside an agent or a team the word is "Uses", never "Paste in".
- **What you need**: tools and models with the steps that use them, files with Download, how it runs, and the time span.
- **Map**, read-only: clicking a box opens its full text on the right, with Copy and what to paste in.
- **Copy for AI** copies the whole build in order, with each new chat and each paste-in written out.

## §7 Budgets

- One filled button per view: Publish in the composer, Done in the full prompt window, "I ran this and it worked" on the build page.
- Add menu at most 7. How it runs exactly 5. At most 6 rows visible in any list, then one "Show {n} more". At most 3 actions shown per item: a step shows one, its menu (Rename, Read all of it, Move up, Move down, Remove), and a menu holds at most 7. At most 4 actions beside the primary. One route to the same thing.
- Build page tabs at most 5.

## §8 Copy

The words to ship. A prompt may add copy; it never rewords these.

| Where | Copy |
| --- | --- |
| Sources groups | Sessions in this build · Files in this build · Not in a build |
| Drop zone | Drop sessions or files |
| List hint | Click a prompt to see its details · double-click to read all of it |
| List card footer | Show full prompt · {n} words |
| Inputs | Uses · Goes into · Add an input · suggested · Accept · Dismiss |
| Add a prompt | Paste or type a prompt… |
| Map key | goes into · suggested · click to select · double-click to read all of it · drag from a dot to connect |
| Map footer | Rows by session, left to right by date · what it doesn't touch is dimmed · Esc clears |
| Opened box | Back to build · Inside team {n} · {title} |
| Full prompt window | Prompt {n} of {N} · full prompt · Title · starts as "Prompt {n}" · only you can change it · Copy prompt · Done · Esc closes · ← → move between prompts |
| Build page | The build · New chat in {tool} · Send in the same chat as step {n} · Paste in · what step {n} gave you · Attach {name} · Read all of it · What you need · to repeat this build |
| Copy for AI note | Copy for AI copies all {n} steps in order, with each new chat and paste-in written out. |

## §9 Vocabulary

Allowed, beside CONTRACT §13: prompt, session, agent, team, file, tool, input, result, map, list, manual step. Never in interface text: node, upload, post, blueprint, blog, block, stage, remix, rating, verification.

## §10 Boards

| Screen | Shows |
| --- | --- |
| Main | The pieces, rules, how it runs, what is detected |
| S1 to S5, List and Map | The composer at five sizes: one prompt, one chat, several chats, an agent, a team |
| D1 to D3 | The three decisions, options side by side |
| V1-References | What the composer takes from each reference |
| V2-List, V3-Map | The composer redrawn: titles, named inputs, dimming, the Sources rail |
| V4-PromptModal | The full prompt window |
| V5-TeamMap | A team opened into its own map |
| B0 to B4 | The build page: the translation, List, Map, a team, one prompt |

Where an S board and a V board disagree, the V board wins: it is the later drawing.

## §11 Decisions taken

Layout A, manual step B, default view A, Watch it get built and Understand it kept, the Card cover first.
