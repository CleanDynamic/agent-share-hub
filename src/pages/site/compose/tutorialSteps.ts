/* The build editor's tutorial, in words: eight chapters that make one build, from its first chat to a team of agents.

   IT IS ONE BUILD, MADE IN ORDER. A bakery's ordering site starts as one imported chat (chapter 1) and grows a chapter at a
   time: the tool the model used, a second session, parts, an agent, a team of agents, then the post about it and Publish. Each
   chapter starts where the last one ended, so the maker sees the build accumulate the way a real one does: foundations first,
   then structure, then the complex steps, then sharing. The chapters fall in four stages (`TUTORIAL_STAGES`), which the
   window shows over its progress bars.

   Every name here is the name the page itself shows ("Import from connected chats", "Add step", "Add part", "Multi-agent team",
   "Reference"), so a maker who closes the tutorial finds the same words on the page.

   THE CHALLENGE is what makes a chapter something done, not something read: one to four goals, taken one at a time, each a
   single press (or a drag) on a small copy of the editor. A goal has what it asks and the hint a wrong press or a long pause
   brings. `wrong` holds what to say for a particular wrong press, where the mistake itself teaches something (Publish before
   the title, a team where an agent was asked for). Nothing is ever lost by a wrong press: the hint shows, and the goal stands. */

export type TutorialScene = "conversation" | "tools" | "sessions" | "parts" | "agent" | "team" | "post" | "publish";

export interface TutorialPoint {
  /** The name of the thing, as the page shows it. */
  lead: string;
  /** What it does, in one line. */
  rest: string;
}

export interface TutorialGoal {
  /** The target that clears it, as the challenge names its targets. */
  id: string;
  /** What to do, said to the maker. */
  ask: string;
  /** What a wrong press, or a long pause, brings. */
  hint: string;
}

export interface TutorialTask {
  /** In order: one is asked at a time. */
  goals: readonly TutorialGoal[];
  /** Said when the last goal is cleared. */
  done: string;
  /** A wrong target that deserves its own sentence, by its id. */
  wrong?: Readonly<Record<string, string>>;
}

export interface TutorialStep {
  scene: TutorialScene;
  title: string;
  body: string;
  points: readonly [TutorialPoint, TutorialPoint, TutorialPoint];
  task: TutorialTask;
}

export interface TutorialStage {
  name: string;
  /** The chapters in it, by index. */
  chapters: readonly number[];
}

/** A wrong pick in the Add menu, said the same way in every chapter that uses it. */
const notThat = (what: string, want: string) => `That would add ${what}. Pick ${want} for this one.`;

export const TUTORIAL_COPY = {
  name: "Tutorial",
  count: (chapter: number, of: number) => `Chapter ${chapter} of ${of}`,
  close: "Close tutorial",
  skip: "Skip tutorial",
  back: "Back",
  next: "Next",
  done: "Start building",
  turn: "Your turn",
  example: "Example",
  watch: "Show me",
  tryIt: "Try it",
  again: "Again",
  watching: "This is how it goes. Press Try it to do it yourself.",
  skipStep: "Skip chapter",
  finish: "Finish",
  progress: (done: number, of: number) => `${done} of ${of} done`,
  build: {
    title: "Your build",
    empty: "Nothing yet",
    count: (sessions: number, steps: number) => `${sessions} ${sessions === 1 ? "session" : "sessions"} · ${steps} ${steps === 1 ? "step" : "steps"}`,
  },
  complete: {
    count: "Complete",
    title: (done: number, of: number) => (done >= of ? `All ${of} chapters done` : `${done} of ${of} chapters done`),
    body: "That is a whole build, from one chat to a team of agents, written up and published. Your own draft is waiting underneath, untouched.",
    challenges: "Chapters",
    score: (done: number, of: number) => `${done} of ${of}`,
    time: "Time",
    hints: "Hints",
    none: "None",
    clean: "Clean run.",
    cleanSays: "Every chapter done with no hints.",
  },
  pause: "Pause the example",
  play: "Play the example",
  paused: "Paused",
  reopen: "You can open this again from Build options, the three dots in the title row.",
  stages: [
    { name: "Foundations", chapters: [0, 1] },
    { name: "Structure", chapters: [2, 3] },
    { name: "Agents", chapters: [4, 5] },
    { name: "Sharing", chapters: [6, 7] },
  ] as readonly TutorialStage[],
  steps: [
    {
      scene: "conversation",
      title: "Start with one conversation",
      body: "Every build starts from the chats where the work happened. Each chat becomes a session, and each prompt in it a numbered step.",
      points: [
        { lead: "Import from connected chats", rest: "adds a chat sent from Claude, Claude Code, ChatGPT or Cursor. Connect a tool sets that up once." },
        { lead: "Only your prompts are copied.", rest: "The answers stay private in your import." },
        { lead: "New empty session", rest: "lets you type the prompts yourself instead." },
      ],
      task: {
        goals: [
          { id: "import", ask: "Bring in the chat where the site was planned. Press Import from connected chats.", hint: "It is the first row." },
          { id: "add", ask: "Pick the bakery chat.", hint: "Press the chat that has appeared." },
        ],
        done: "Session 1 is in, and its two prompts are steps 1 and 2.",
        wrong: { empty: "That starts a blank session to type into. For this one, press Import from connected chats." },
      },
    },
    {
      scene: "tools",
      title: "Add what the model used",
      body: "A build is more than prompts. Add the tools and files that went into the work, in the order they were used.",
      points: [
        { lead: "Add step", rest: "adds a prompt, an agent, a tool, a file and more." },
        { lead: "Drag a step", rest: "to move it. The numbers follow, because they always count straight down." },
        { lead: "Every change saves itself,", rest: "and Undo takes back the last one." },
      ],
      task: {
        goals: [
          { id: "add", ask: "The model took payments with Stripe. Press Add step.", hint: "It is under the last step." },
          { id: "tool", ask: "Choose Tool.", hint: "Tool is an app the model used. Pick that one." },
          { id: "move", ask: "Stripe came before step 2. Drag it up, or press its arrow.", hint: "Hold the Tool step and pull it up, or press the arrow at its right." },
        ],
        done: "Stripe is step 2 now, and the prompt after it became step 3.",
        wrong: { prompt: notThat("a prompt", "Tool"), agent: notThat("an agent", "Tool"), file: notThat("a file", "Tool") },
      },
    },
    {
      scene: "sessions",
      title: "Add the next session",
      body: "Most builds take more than one chat. Each new session joins the end, and its steps carry on the count.",
      points: [
        { lead: "Add session", rest: "adds another chat, or an empty session." },
        { lead: "The numbers carry on", rest: "across sessions, so Session 2 starts at step 4." },
        { lead: "Map", rest: "appears once there are two sessions, with a line wherever one uses something from another." },
      ],
      task: {
        goals: [
          { id: "session", ask: "The admin side was built in another chat. Press Add session.", hint: "It is under Session 1." },
          { id: "admin", ask: "Pick the admin dashboard chat.", hint: "It is the chat that is not in the build yet." },
          { id: "map", ask: "There are two sessions now. Press Map to see how they connect.", hint: "It is at the top right of the build." },
        ],
        done: "Session 2 reads the menu Session 1 made, so the map draws a line between them.",
        wrong: { bakery: "That chat is already in the build. Pick the admin dashboard chat." },
      },
    },
    {
      scene: "parts",
      title: "Group sessions into parts",
      body: "When a build has separate lines of work, parts keep them apart. The shop and the admin side are different jobs.",
      points: [
        { lead: "Add part", rest: "starts a new part at the end. Parts are lettered, or numbered if you prefer." },
        { lead: "Move a session", rest: "into a part by dragging it, or from its menu." },
        { lead: "The numbers", rest: "still run straight down the whole build, part after part." },
      ],
      task: {
        goals: [
          { id: "part", ask: "Press Add part.", hint: "It is under the last session." },
          { id: "move", ask: "Move Session 2 into Part B. Drag it down, or press its arrow.", hint: "Hold Session 2 and pull it down into Part B, or press the arrow at its right." },
        ],
        done: "Part A is the shop and Part B the admin side. The steps still run 1 to 5.",
      },
    },
    {
      scene: "agent",
      title: "Hand work to an agent",
      body: "An agent is a model with standing instructions that works through its own prompts. It is one step, with numbered steps inside.",
      points: [
        { lead: "Agent", rest: "is in Add step. Choose Single agent for one model working alone." },
        { lead: "Its instructions", rest: "are always n.1, and its prompts n.2 onward." },
        { lead: "Select an agent", rest: "to see its model, tools and instructions in Details." },
      ],
      task: {
        goals: [
          { id: "add", ask: "An agent now answers order questions. Press Add step.", hint: "It is under step 5." },
          { id: "agent", ask: "Choose Agent.", hint: "Agent is a model with its own instructions." },
          { id: "single", ask: "Choose Single agent.", hint: "A team is the next chapter. Pick Single agent." },
          { id: "prompt", ask: "Give it a prompt. Press Add prompt inside the agent.", hint: "It is the faint row inside step 6." },
        ],
        done: "Step 6 is the agent: its instructions are 6.1 and its prompt 6.2.",
        wrong: { team: "A team is the next chapter. Pick Single agent for this one.", prompt: notThat("a prompt", "Agent"), tool: notThat("a tool", "Agent"), file: notThat("a file", "Agent") },
      },
    },
    {
      scene: "team",
      title: "Build a team of agents",
      body: "A team is several agents on one job, each with its own role. It is the most complex step a build can hold.",
      points: [
        { lead: "Multi-agent team", rest: "is in Add step, under Agent." },
        { lead: "Its agents", rest: "are numbered 7.1 onward, and one of them leads." },
        { lead: "Team instructions", rest: "are the rules every agent in the team follows." },
      ],
      task: {
        goals: [
          { id: "add", ask: "A team wrote the launch posts. Press Add step.", hint: "It is under step 6." },
          { id: "agent", ask: "Choose Agent.", hint: "Teams are under Agent." },
          { id: "team", ask: "Choose Multi-agent team this time.", hint: "Pick the team, on the right." },
          { id: "member", ask: "Add a third agent. Press Add agent.", hint: "It is the faint row at the foot of the team." },
        ],
        done: "Step 7 is the team: a writer who leads, a reviewer and a photographer.",
        wrong: { single: "That is one agent. Pick Multi-agent team this time.", prompt: notThat("a prompt", "Agent"), tool: notThat("a tool", "Agent"), file: notThat("a file", "Agent") },
      },
    },
    {
      scene: "post",
      title: "Tell the story",
      body: "The post at the top is what readers see first. Write it once the build is in, so it can point at the parts that matter.",
      points: [
        { lead: "Pictures and video", rest: "go in from the toolbar. The first one becomes the cover." },
        { lead: "Reference", rest: "links words in the post to a part, a session or a step." },
        { lead: "The plus button", rest: "adds another post to the thread when one is not enough." },
      ],
      task: {
        goals: [
          { id: "picture", ask: "Give the post a cover. Press the picture button.", hint: "It is the first button under the post." },
          { id: "reference", ask: "Press Reference to link the words launch team to step 7.", hint: "It is in the same row, with the target mark." },
        ],
        done: "The cover is set, and the words launch team now point at step 7.",
      },
    },
    {
      scene: "publish",
      title: "Check it, then publish",
      body: "Publish opens a checklist first, so a build never goes out half finished.",
      points: [
        { lead: "Four things are required:", rest: "a title, a description, a cover picture or video, and at least one prompt." },
        { lead: "Classification", rest: "holds the title and summary, and how the build is filed." },
        { lead: "Preview", rest: "shows the build as readers will see it, before anything is public." },
      ],
      task: {
        goals: [
          { id: "title", ask: "One required item is missing. Press Add title.", hint: "It is on the Title row." },
          { id: "publish", ask: "Everything required is there. Press Publish.", hint: "It is at the bottom right of the checklist." },
        ],
        done: "Published: one chat grew into a whole build.",
        wrong: { publish: "Publish waits until every required item is there. Add the title first." },
      },
    },
  ] as readonly TutorialStep[],
} as const;

export const TUTORIAL_STEPS = TUTORIAL_COPY.steps;
export const TUTORIAL_STAGES = TUTORIAL_COPY.stages;

/** The chapter a number lands on: never before the first, never after the last. */
export const clampStep = (index: number): number => Math.min(Math.max(index, 0), TUTORIAL_STEPS.length - 1);

/** The stage a chapter belongs to. */
export const stageOf = (chapter: number): TutorialStage => TUTORIAL_STAGES.find((stage) => stage.chapters.includes(chapter)) ?? TUTORIAL_STAGES[0];

/** How long a maker may look at a goal before the tutorial points at its target. */
export const IDLE_HINT_MS = 7000;

/** A run's time as the summary shows it: minutes and seconds. */
export function runTime(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/* ── the build as it stands ── */

/** What the build holds after `done` goals of chapter `chapter`. Each chapter starts where the last one ended. */
export interface Built {
  session1: boolean;
  tool: boolean;
  toolMoved: boolean;
  session2: boolean;
  parts: boolean;
  session2InB: boolean;
  agent: boolean;
  agentPrompt: boolean;
  team: boolean;
  teamThird: boolean;
}

const reached = (chapter: number, done: number, at: number, need: number): boolean => chapter > at || (chapter === at && done >= need);

export function builtAt(chapter: number, done: number): Built {
  return {
    session1: reached(chapter, done, 0, 2),
    tool: reached(chapter, done, 1, 2),
    toolMoved: reached(chapter, done, 1, 3),
    session2: reached(chapter, done, 2, 2),
    parts: reached(chapter, done, 3, 1),
    session2InB: reached(chapter, done, 3, 2),
    agent: reached(chapter, done, 4, 3),
    agentPrompt: reached(chapter, done, 4, 4),
    team: reached(chapter, done, 5, 3),
    teamThird: reached(chapter, done, 5, 4),
  };
}

export interface OutlineRow {
  /** Stable from chapter to chapter: what a row is, not where it stands. */
  key: string;
  kind: "part" | "session" | "step";
  /** A step's number, counted straight down the build. */
  number?: string;
  text: string;
  /** A part with no session in it yet. */
  empty?: boolean;
}

/** The build as a list: its parts, its sessions and its numbered steps, in the order the List draws them. */
export function outlineOf(built: Built): OutlineRow[] {
  const rows: OutlineRow[] = [];
  let count = 0;
  const step = (key: string, text: string) => rows.push({ key, kind: "step", number: String(++count), text });
  if (built.parts) rows.push({ key: "part-a", kind: "part", text: "Part A" });
  if (built.session1) {
    rows.push({ key: "session-1", kind: "session", text: "Session 1" });
    const first = built.tool ? (built.toolMoved ? ["p1", "tool", "p2"] : ["p1", "p2", "tool"]) : ["p1", "p2"];
    for (const key of first) step(key, key === "tool" ? "Tool · Stripe" : "Prompt");
  }
  if (built.parts && built.session2InB) rows.push({ key: "part-b", kind: "part", text: "Part B" });
  if (built.session2) {
    rows.push({ key: "session-2", kind: "session", text: "Session 2" });
    step("p4", "Prompt");
    step("p5", "Prompt");
    if (built.agent) step("agent", "Agent · Order helper");
    if (built.team) step("team", "Team · Launch team");
  }
  if (built.parts && !built.session2InB) rows.push({ key: "part-b", kind: "part", text: "Part B", empty: true });
  return rows;
}

/** "2 sessions · 7 steps"; null for an empty build. */
export function buildCount(built: Built): string | null {
  const rows = outlineOf(built);
  const sessions = rows.filter((row) => row.kind === "session").length;
  const steps = rows.filter((row) => row.kind === "step").length;
  return sessions === 0 ? null : TUTORIAL_COPY.build.count(sessions, steps);
}
