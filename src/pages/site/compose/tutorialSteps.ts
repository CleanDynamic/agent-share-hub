/* The build editor's tutorial, in words: five steps, each a title, one sentence, three points and a challenge.

   The order is the order a maker works in: see the page, write the post, bring in the sessions, shape the steps, publish.
   Every name here is the name the page itself shows ("Sources", "Import from connected chats", "Add step", "Classification"),
   so a maker who closes the tutorial finds the same words on the page.

   THE CHALLENGE is what makes a step something done, not something read: one to three goals, taken one at a time, each a single
   press (or a drag) on a small copy of the editor. A goal has what it asks and the hint a wrong press or a long pause brings.
   `wrong` holds what to say for a particular wrong press, where the mistake itself teaches something (Publish before the title).
   Nothing is ever lost by a wrong press: the hint shows, and the goal stands. */

import { SITE_NAME } from "@/lib/site";

export type TutorialScene = "layout" | "post" | "sessions" | "steps" | "publish";

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

export const TUTORIAL_COPY = {
  name: "Tutorial",
  count: (step: number, of: number) => `Step ${step} of ${of}`,
  close: "Close tutorial",
  skip: "Skip tutorial",
  back: "Back",
  next: "Next",
  done: "Start building",
  turn: "Your turn",
  example: "Example",
  cleared: "Done",
  watch: "Show me",
  tryIt: "Try it",
  again: "Again",
  watching: "This is how it goes. Press Try it to do it yourself.",
  skipStep: "Skip step",
  finish: "Finish",
  progress: (done: number, of: number) => `${done} of ${of} done`,
  complete: {
    count: "Complete",
    title: (done: number, of: number) => (done >= of ? "All five challenges done" : `${done} of ${of} challenges done`),
    body: "That was the whole editor: the page, the post, sessions, steps and publishing. Your own draft is waiting underneath, untouched.",
    challenges: "Challenges",
    score: (done: number, of: number) => `${done} of ${of}`,
    time: "Time",
    hints: "Hints",
    none: "None",
    clean: "Clean run.",
    cleanSays: "Every challenge done with no hints.",
  },
  pause: "Pause the example",
  play: "Play the example",
  paused: "Paused",
  reopen: "You can open this again from Build options, the three dots in the title row.",
  steps: [
    {
      scene: "layout",
      title: "Welcome to the build editor",
      body: `A build is the public record of how you made something with AI. The editor on ${SITE_NAME} keeps it in three columns.`,
      points: [
        { lead: "Sources", rest: "on the left, lists the sessions and files in this build." },
        { lead: "Build", rest: "in the middle, holds your post and then every step, in order." },
        { lead: "Details", rest: "on the right, shows the fields of the step you select." },
      ],
      task: {
        goals: [
          { id: "sources", ask: "Press the column that lists your sessions and files.", hint: "It is the narrow one on the left." },
          { id: "build", ask: "Now the one that holds your post and your steps.", hint: "It is the wide one in the middle." },
          { id: "details", ask: "Last one: where do a step's fields show?", hint: "It is on the right." },
        ],
        done: "That is the whole page: Sources, Build and Details.",
      },
    },
    {
      scene: "post",
      title: "Say what you built",
      body: "The post at the top is what readers see first. Write it as you would a short thread.",
      points: [
        { lead: "Pictures and video", rest: "go in from the toolbar. The first one becomes the cover." },
        { lead: "Reference", rest: "links words in your post to the session or step they are about." },
        { lead: "The plus button", rest: "adds another post to the thread when one is not enough." },
      ],
      task: {
        goals: [
          { id: "picture", ask: "Give the post a picture. Press the picture button.", hint: "It is the first button under the post." },
          { id: "reference", ask: "Now press Reference to link the words to Session 1.", hint: "It is in the same row, with the target mark." },
        ],
        done: "The picture is the cover, and the words now point at Session 1.",
      },
    },
    {
      scene: "sessions",
      title: "Bring in your sessions",
      body: "A session is one AI conversation. Add each one that went into the work.",
      points: [
        { lead: "Import from connected chats", rest: "adds a conversation sent from Claude, Claude Code, ChatGPT or Cursor. Connect a tool sets that up once." },
        { lead: "Only your prompts are copied.", rest: "The answers stay private in your import." },
        { lead: "New empty session", rest: "lets you type the prompts yourself. Files can be dropped anywhere on the build." },
      ],
      task: {
        goals: [
          { id: "import", ask: "Add a session. Press Import from connected chats.", hint: "It is the first row." },
          { id: "add", ask: "Pick the bakery chat.", hint: "Press the chat that has appeared." },
        ],
        done: "Three prompts came in as steps. The answers stayed private.",
        wrong: { empty: "That starts a blank session to type into. For this one, press Import from connected chats." },
      },
    },
    {
      scene: "steps",
      title: "Shape the steps",
      body: "Each prompt is a numbered step. Add what else went into the work, then put it in the order it happened.",
      points: [
        { lead: "Add step", rest: "adds a prompt, an agent, a tool, a file and more." },
        { lead: "Drag a step", rest: "to move it, and the numbers follow. Select one to edit its details." },
        { lead: "Every change saves itself,", rest: "and Undo takes back the last one." },
      ],
      task: {
        goals: [
          { id: "add", ask: "Press Add step.", hint: "It is under the last step." },
          { id: "tool", ask: "Choose Tool.", hint: "Tool is an app the model used. Pick that one." },
          { id: "move", ask: "Drag the Tool step above step 2, or press its arrow.", hint: "Hold the Tool step and pull it up, or press the arrow at its right." },
        ],
        done: "Added and moved, and the numbers followed.",
        wrong: { prompt: "That would add a prompt. Pick Tool for this one.", agent: "That would add an agent. Pick Tool for this one.", file: "That would add a file. Pick Tool for this one." },
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
        done: "Published. That is the whole loop.",
        wrong: { publish: "Publish waits until every required item is there. Add the title first." },
      },
    },
  ] as readonly TutorialStep[],
} as const;

export const TUTORIAL_STEPS = TUTORIAL_COPY.steps;

/** The step a number lands on: never before the first, never after the last. */
export const clampStep = (index: number): number => Math.min(Math.max(index, 0), TUTORIAL_STEPS.length - 1);

/** How long a maker may look at a goal before the tutorial points at its target. */
export const IDLE_HINT_MS = 7000;

/** A run's time as the summary shows it: minutes and seconds. */
export function runTime(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
