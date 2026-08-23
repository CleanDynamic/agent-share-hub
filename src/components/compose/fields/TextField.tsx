// type: "text" — a multi-line textarea that grows with its content.
//
// It autosizes rather than scrolling: a prompt is the longest thing a creator
// writes on this page, and a fixed 4-row box turns reading it back into a
// scroll-within-a-scroll. Height is set from scrollHeight on every value
// change, which is the only way to measure wrapped text.

import { useCallback, useLayoutEffect, useRef } from "react";
import { FieldShell } from "../SchemaForm";
import {
  blurControl,
  compactControlStyle,
  controlStyle,
  focusControl,
  type FieldWidgetProps,
} from "./index";

/** Below this the box looks like a mistake rather than an empty field. */
const MIN_HEIGHT = 76;
const COMPACT_MIN_HEIGHT = 44;

export function TextField({
  field,
  value,
  onChange,
  id,
  touched,
  onTouch,
  compact,
}: FieldWidgetProps) {
  const text = value === null || value === undefined ? "" : String(value);
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const minHeight = compact ? COMPACT_MIN_HEIGHT : MIN_HEIGHT;

  const resize = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    // Collapse first: scrollHeight never shrinks below the current height, so
    // deleting a paragraph would leave the box at its old size otherwise.
    element.style.height = "auto";
    element.style.height = `${Math.max(minHeight, element.scrollHeight)}px`;
  }, [minHeight]);

  // Layout effect rather than effect: resizing after paint shows one frame of
  // the wrong height every time a node is selected.
  useLayoutEffect(resize, [resize, text]);

  return (
    <FieldShell field={field} id={id} touched={touched} isEmpty={text === ""} compact={compact}>
      <textarea
        id={id}
        ref={ref}
        value={text}
        rows={1}
        placeholder={compact ? field.label : undefined}
        onChange={(event) => {
          onTouch?.();
          const next = event.target.value;
          onChange(next === "" ? null : next);
        }}
        onFocus={(event) => focusControl(event.currentTarget)}
        onBlur={(event) => blurControl(event.currentTarget)}
        style={{
          ...(compact ? compactControlStyle : controlStyle),
          minHeight,
          // The component owns the height, so the drag handle would only ever
          // fight it back to the content height on the next keystroke.
          resize: "none",
          overflow: "hidden",
          display: "block",
        }}
      />
    </FieldShell>
  );
}
