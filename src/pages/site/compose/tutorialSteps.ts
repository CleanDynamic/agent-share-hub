/* The build editor's tutorial, in words: five steps, each a title, one sentence and three points.

   The order is the order a maker works in: see the page, write the post, bring in the sessions, shape the steps, publish.
   Every name here is the name the page itself shows ("Sources", "Import from connected chats", "Add step", "Classification"),
   so a maker who closes the tutorial finds the same words on the page. */

import { SITE_NAME } from "@/lib/site";

export type TutorialScene = "layout" | "post" | "sessions" | "steps" | "publish";

export interface TutorialPoint {
  /** The name of the thing, as the page shows it. */
  lead: string;
  /** What it does, in one line. */
  rest: string;
}

export interface TutorialStep {
  scene: TutorialScene;
  title: string;
  body: string;
  points: readonly [TutorialPoint, TutorialPoint, TutorialPoint];
}

export const TUTORIAL_COPY = {
  name: "Tutorial",
  count: (step: number, of: number) => `Step ${step} of ${of}`,
  close: "Close tutorial",
  skip: "Skip tutorial",
  back: "Back",
  next: "Next",
  done: "Start building",
  pause: "Pause the example",
  play: "Play the example",
  paused: "Paused",
  again: "You can open this again from Build options, the three dots in the title row.",
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
    },
  ] as readonly TutorialStep[],
} as const;

export const TUTORIAL_STEPS = TUTORIAL_COPY.steps;

/** The step a number lands on: never before the first, never after the last. */
export const clampStep = (index: number): number => Math.min(Math.max(index, 0), TUTORIAL_STEPS.length - 1);
