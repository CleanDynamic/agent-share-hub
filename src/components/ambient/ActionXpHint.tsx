import { ReactNode } from "react";
import ActionXpHintInner from "./ActionXpHintInner";

/**
 * ActionXpHint — wrapper that overlays a floating "+N" above an existing
 * engagement button WITHOUT altering its markup, handlers, or layout.
 *
 * Usage:
 *   <ActionXpHint amount={1} trigger={successCounter}>
 *     <button>...existing button untouched...</button>
 *   </ActionXpHint>
 *
 * `trigger` should be a counter that increments on each successful action.
 */
export interface ActionXpHintProps {
  amount: number;
  trigger: number;
  color?: string;
  offsetX?: number;
  children: ReactNode;
}

export default function ActionXpHint({
  amount,
  trigger,
  color,
  offsetX,
  children,
}: ActionXpHintProps) {
  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        // Inherit layout from parent — don't introduce sizing of our own.
      }}
    >
      {children}
      <ActionXpHintInner
        amount={amount}
        trigger={trigger}
        color={color}
        offsetX={offsetX}
      />
    </span>
  );
}
