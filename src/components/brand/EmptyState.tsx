// The empty state (UI-P37): a panel with nothing to show, said once.
//
// A centred column, 12 apart, padded 28px 20px: ONE sentence in the display
// face at 20px in `--text`, and at most one secondary button under it. No
// illustration and no icon — an empty panel is not a failure and not an event,
// so it gets a sentence and a way on, never decoration. The sentence is the
// panel's own words ("Nothing hung yet.", "No solutions yet."), written as the
// state of the thing rather than as a scolding of the reader, and the way on is
// the one place this panel can lead (the gallery, sign in, the open bounties).
//
// The button is 36/13, the secondary variant, because the primary belongs to
// the page's one decision; on a phone it is 44 tall, the touch floor.
//
// A SIGNED-OUT VISITOR gets this too, in place of a panel that is for signed-in
// readers only: the sentence says what signing in would give them, and the
// action is "Sign in". Never a disabled control with no explanation.

import type { CSSProperties, HTMLAttributes } from "react";

import { useIsPhone } from "@/components/shell/useMinWidth";
import { t } from "@/lib/theme/tokens";
import { display } from "@/lib/theme/type";

import { Button } from "./Button";

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, "children" | "style"> {
  /** One sentence. */
  line: string;
  /** At most one action: the way on from here. */
  action?: EmptyStateAction;
  /** Spacing from the panel's head, where the panel needs it. */
  style?: CSSProperties;
}

export function EmptyState({ line, action, style, ...rest }: EmptyStateProps) {
  const phone = useIsPhone();
  return (
    <div
      data-ui="empty-state"
      {...rest}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 12,
        padding: "28px 20px",
        ...style,
      }}
    >
      <p style={{ ...display(20), margin: 0, color: t.text }}>{line}</p>
      {action ? (
        <Button variant="secondary" size={phone ? 44 : 36} fontSize={13} onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}

export default EmptyState;
