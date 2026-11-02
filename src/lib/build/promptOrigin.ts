// SV-30 P3: how a prompt was sent, and what it asks for. PURE.
//
// `payload.sent_by` is `maker` (the default, never stored), `schedule`, `agent_wakeup`, `heartbeat` (with `payload.interval`) or
// `event` (with `payload.event`). `payload.asks_for` is `outcome` or `procedure`. Both are the maker's to set: nothing is inferred
// from the prompt's text and no import sets either.

import { clean } from "./tileExtras";

export const SENT_BY = ["maker", "schedule", "agent_wakeup", "heartbeat", "event"] as const;
export type SentBy = (typeof SENT_BY)[number];

export const ASKS_FOR = ["outcome", "procedure"] as const;
export type AsksFor = (typeof ASKS_FOR)[number];

export const INTERVAL_MAX = 20;
export const EVENT_MAX = 80;

/** What a prompt not sent by the maker shows before its text. */
export const ORIGIN_LABEL: Record<Exclude<SentBy, "maker">, string> = {
  schedule: "Scheduled by the maker",
  agent_wakeup: "Wake-up set by the agent",
  heartbeat: "Heartbeat",
  event: "Triggered by an event",
};

/** The labels the maker picks from, in order. */
export const SENT_BY_CHOICES: readonly { value: SentBy; label: string }[] = [
  { value: "maker", label: "Typed by the maker" },
  { value: "schedule", label: "Scheduled by the maker" },
  { value: "agent_wakeup", label: "Wake-up set by the agent" },
  { value: "heartbeat", label: "Heartbeat, on a fixed interval" },
  { value: "event", label: "Triggered by an event" },
];

export const ASKS_FOR_LABEL: Record<AsksFor, string> = { outcome: "Asks for an outcome", procedure: "Asks for a procedure" };

export interface PromptOrigin {
  sentBy: Exclude<SentBy, "maker">;
  interval?: string;
  event?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** The origin a payload records; null when the maker typed it (and for every prompt written before this). */
export function originOf(payload: unknown): PromptOrigin | null {
  if (!isRecord(payload)) return null;
  const sentBy = payload.sent_by;
  if (sentBy !== "schedule" && sentBy !== "agent_wakeup" && sentBy !== "heartbeat" && sentBy !== "event") return null;
  const interval = clean(payload.interval, INTERVAL_MAX);
  const event = clean(payload.event, EVENT_MAX);
  return { sentBy, ...(sentBy === "heartbeat" && interval ? { interval } : null), ...(sentBy === "event" && event ? { event } : null) };
}

/** What the prompt asks for, as the maker said; null when not said. */
export const asksForOf = (payload: unknown): AsksFor | null => (isRecord(payload) && ASKS_FOR.includes(payload.asks_for as AsksFor) ? (payload.asks_for as AsksFor) : null);

/** "Wake-up set by the agent", "Heartbeat · daily 09:00", "Triggered by deploy finished". */
export function originLine(origin: PromptOrigin): string {
  if (origin.sentBy === "heartbeat") return origin.interval ? `${ORIGIN_LABEL.heartbeat} · ${origin.interval}` : ORIGIN_LABEL.heartbeat;
  if (origin.sentBy === "event") return origin.event ? `Triggered by ${origin.event}` : ORIGIN_LABEL.event;
  return ORIGIN_LABEL[origin.sentBy];
}

/** "daily 09:00" is said "daily at 09:00"; any other interval as written. */
const intervalWords = (interval: string): string => interval.replace(/^(\S+)\s+(\d{1,2}:\d{2})$/, "$1 at $2");

/** The note a copied or exported prompt carries when it was not typed: "(sent daily at 09:00)". Null for the maker. */
export function originNote(origin: PromptOrigin | null): string | null {
  if (!origin) return null;
  switch (origin.sentBy) {
    case "schedule":
      return "(sent on the maker's schedule)";
    case "agent_wakeup":
      return "(a wake-up the agent set for itself)";
    case "heartbeat":
      return origin.interval ? `(sent ${intervalWords(origin.interval)})` : "(sent on a fixed interval)";
    case "event":
      return origin.event ? `(sent when ${origin.event})` : "(sent when an event happened)";
  }
}
