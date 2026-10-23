// CA-17 P2: the measures of a part in the List, as the board "Parts in the composer" draws them. Like the other recipe
// modules it is the one place these numbers live: the group's 10 of padding is the board's, and is not a step of the scale.

import type { CSSProperties } from "react";

import { t } from "@/lib/theme/tokens";

/** A part's group: a 1px `--hairline` outline, radius 14, padding 10, gap 8. Sessions keep their own look inside it. */
export const WORKSTREAM_GROUP: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  minWidth: 0,
  padding: 10,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: t.hairline,
  borderRadius: 14,
};

/** What a part holds, session after session. */
export const WORKSTREAM_BODY: CSSProperties = { display: "flex", flexDirection: "column", gap: 8, minWidth: 0 };

/** "Starts after Part A · Session 2", under the head, in line with the name. */
export const WORKSTREAM_STARTS: CSSProperties = { margin: 0, paddingLeft: 26 };
