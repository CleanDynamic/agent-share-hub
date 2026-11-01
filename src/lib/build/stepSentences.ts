// stepSentences: what a step of the build's history is called (CA-20 P5). PURE.
//
// Each change the maker makes is named in one short sentence, which the title row's tooltips and the notice use: "Moved Prompt 3
// up", "Renamed Session 2", "Added a manual step". A change made through one of the details' handlers is named after the handler
// and the thing it was made to; removing, merging, splitting and clearing say what went in their own words (componentMenus.ts).

/** The handlers of the tiles' and sessions' windows that do not change the build: they open something, or pick a file. */
export const HANDLERS_THAT_CHANGE_NOTHING: ReadonlySet<string> = new Set(["onSelect", "onOpenPrompt", "onAttach", "onDownload", "onAddToSetup"]);

/** Handlers that remove: they are steps of their own (with a notice), named by what they removed. */
export const HANDLERS_THAT_REMOVE: ReadonlySet<string> = new Set(["onRemoveMade", "onRemoveInside"]);

const SPECIAL: Record<string, (what: string) => string> = {
  onRename: (what) => `Renamed ${what}`,
  onModel: (what) => `Changed the model of ${what}`,
  onModelRun: (what) => `Changed the model of ${what}`,
  onAddUse: (what) => `Added an input to ${what}`,
  onRemoveUse: (what) => `Took an input off ${what}`,
  onAddMade: (what) => `Added a file ${what} makes`,
  onManualPicture: (what) => `Added a picture to ${what}`,
  onAddPicture: (what) => `Added a picture to ${what}`,
  onUseAsCover: () => "Used a picture as the cover",
  onToggleSessionPrompt: () => "Changed the prompts from a session",
  onInstructions: (what) => `Changed the instructions of ${what}`,
  onSessionTogether: (what) => `Changed what ${what} was used together with`,
};

/** The sentence for a change made through `handler`, to `what` ("Prompt 3", "Session 2", "the build"). */
export function handlerSentence(handler: string, what: string): string {
  return (SPECIAL[handler] ?? ((thing: string) => `Changed ${thing}`))(what);
}

export const ADDED = {
  prompt: "Added a prompt",
  agent: "Added an agent",
  decision: "Added a decision",
  manual: "Added a manual step",
  approval: "Added an approval",
  code: "Added code",
  check: "Added a check",
  result: "Added a result",
  tool: "Added a tool",
  file: "Added a file",
  systemPrompt: "Added a system prompt",
  dataset: "Added a dataset",
  retrieval: "Added a retrieval",
  repo: "Added a repository",
  session: "Added a session",
  part: "Added a part",
  promptToAgent: "Added a prompt to an agent",
  agentToTeam: "Added an agent to a team",
  nested: "Moved a tile",
} as const;
