/* CA-20 P4: Undo, Redo and the build's menu, in the title row, just left of Classification Card, 8 apart.

   Undo and Redo are 28 square ghost icon buttons (the `undo` and `redo` glyphs at 16, stroke 1.4). Their tooltips name the step:
   "Undo: Removed Prompt 3", "Redo: Moved Session 2"; with nothing to do they are greyed and say "Nothing to undo" or "Nothing to redo".
   "Build options" is a 28 square ghost button with the dots; its menu is "Recently removed…" (with a count at the right when there
   is one), "Keyboard shortcuts" and, after a rule, "Clear the build…" in the danger text colour.

   The row's gap does the spacing: this draws three buttons and no box. A phone draws them in the header, at touch size. */

import * as Menu from "@radix-ui/react-dropdown-menu";
import { type ButtonHTMLAttributes, type ReactNode } from "react";

import { Glyph, type GlyphName } from "@/components/brand/Glyph";
import { HISTORY_COPY } from "@/lib/build/buildHistory";
import { SHORTCUT_COPY, shortcutLabel } from "@/lib/build/shortcuts";
import { CLEAR_COPY } from "@/lib/build/componentMenus";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";

import { MenuContent } from "./ComposeMenu";
import { COUNT } from "./modalRecipes";
import { DANGER } from "./referencePieces";
import { menuItem, menuSurface } from "./refinedStyles";
import { useReason } from "./removePieces";
import { useBuildActionsContext } from "./useBuildActions";
import { useBuildHistoryContext } from "./useBuildHistory";

interface TitleIconProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  glyph: GlyphName;
  label: string;
  phone: boolean;
}

/** A ghost icon button: 28 square (44 on a phone), radius 7, nothing under the glyph until the pointer is, a 16 glyph in `--text2`. */
function TitleIcon({ glyph, label, phone, disabled, style, ...rest }: TitleIconProps) {
  const { onMouseEnter, onMouseLeave, onFocus, onBlur, onPointerDown, onPointerUp, onPointerCancel } = rest;
  const { state, handlers } = useInteractive<HTMLButtonElement>({ onMouseEnter, onMouseLeave, onFocus, onBlur, onPointerDown, onPointerUp, onPointerCancel }, { disabled });
  const side = phone ? 44 : 28;
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      {...rest}
      {...handlers}
      style={{
        width: side,
        height: side,
        padding: 0,
        flexShrink: 0,
        boxSizing: "border-box",
        borderRadius: 7,
        border: "1px solid transparent",
        background: state.hovered && !disabled ? t.controlOn : "transparent",
        color: disabled ? t.textDisabled : state.hovered ? t.text : t.text2,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: disabled ? "default" : "pointer",
        ...ring(state.focusVisible),
        ...style,
      }}
    >
      <Glyph name={glyph} size={16} />
    </button>
  );
}

/** The tooltip of Undo or Redo, in the step's words. */
export function stepTooltip(kind: "undo" | "redo", sentence: string | null, keys?: string): string {
  const base = sentence ? (kind === "undo" ? HISTORY_COPY.undoStep(sentence) : HISTORY_COPY.redoStep(sentence)) : kind === "undo" ? HISTORY_COPY.nothingToUndo : HISTORY_COPY.nothingToRedo;
  return sentence && keys ? `${base} (${keys})` : base;
}

export function BuildTitleActions({ phone = false, keys }: { phone?: boolean; keys?: { undo?: string; redo?: string; shortcuts?: ReactNode } }): ReactNode {
  const history = useBuildHistoryContext();
  const actions = useBuildActionsContext();
  const undoWhy = useReason(history && !history.canUndo ? HISTORY_COPY.nothingToUndo : undefined);
  const redoWhy = useReason(history && !history.canRedo ? HISTORY_COPY.nothingToRedo : undefined);
  const clearWhy = useReason(actions && actions.clear.counts.sessions + actions.clear.counts.tiles + actions.clear.counts.files + actions.clear.counts.parts === 0 ? CLEAR_COPY.nothing : undefined);
  if (!history) return null;
  const empty = !actions || actions.clear.counts.sessions + actions.clear.counts.tiles + actions.clear.counts.files + actions.clear.counts.parts === 0;
  return (
    <>
      <TitleIcon
        glyph="undo"
        phone={phone}
        label={history.canUndo ? HISTORY_COPY.undoStep(history.undoSentence ?? "") : HISTORY_COPY.undo}
        title={stepTooltip("undo", history.canUndo ? history.undoSentence : null, keys?.undo ?? (phone ? undefined : shortcutLabel("undo")))}
        disabled={!history.canUndo}
        data-testid="title-undo"
        onClick={() => void history.undo()}
        aria-describedby={undoWhy.props["aria-describedby"]}
      />
      {undoWhy.note}
      <TitleIcon
        glyph="redo"
        phone={phone}
        label={history.canRedo ? HISTORY_COPY.redoStep(history.redoSentence ?? "") : HISTORY_COPY.redo}
        title={stepTooltip("redo", history.canRedo ? history.redoSentence : null, keys?.redo ?? (phone ? undefined : shortcutLabel("redo")))}
        disabled={!history.canRedo}
        data-testid="title-redo"
        onClick={() => void history.redo()}
        aria-describedby={redoWhy.props["aria-describedby"]}
      />
      {redoWhy.note}
      {actions ? (
        <Menu.Root>
          <Menu.Trigger asChild>
            <TitleIcon glyph="more" phone={phone} label={CLEAR_COPY.options} title={CLEAR_COPY.options} data-testid="build-options" />
          </Menu.Trigger>
          <Menu.Portal>
            <MenuContent align="end" sideOffset={6} style={menuSurface(220)}>
              {actions.recentlyRemoved ? (
                <Menu.Item data-testid="build-options-removed" onSelect={actions.recentlyRemoved.open} style={{ ...menuItem(true, phone), justifyContent: "space-between", gap: 12 }}>
                  <span>{CLEAR_COPY.recentlyRemoved}</span>
                  {actions.recentlyRemoved.count > 0 ? <span style={COUNT}>{actions.recentlyRemoved.count}</span> : null}
                </Menu.Item>
              ) : null}
              {keys?.shortcuts}
              {phone ? null : (
                <Menu.Item data-testid="build-options-shortcuts" onSelect={actions.shortcuts.open} style={{ ...menuItem(true, phone), justifyContent: "space-between", gap: 12 }}>
                  <span>{SHORTCUT_COPY.item}</span>
                  <span aria-hidden="true" style={COUNT}>{shortcutLabel("help")}</span>
                </Menu.Item>
              )}
              <Menu.Separator style={{ height: 1, margin: "4px 0", background: t.hairline }} />
              <Menu.Item data-testid="build-options-clear" data-tone="danger" disabled={empty} onSelect={actions.clear.ask} style={{ ...menuItem(!empty, phone), color: DANGER }} {...clearWhy.props}>
                {CLEAR_COPY.menu}
              </Menu.Item>
              {clearWhy.note}
            </MenuContent>
          </Menu.Portal>
        </Menu.Root>
      ) : null}
    </>
  );
}
