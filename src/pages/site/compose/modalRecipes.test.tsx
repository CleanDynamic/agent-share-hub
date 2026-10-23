/* CA-15b P1: each recipe renders with the board's sizes (read from its computed style). */

import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { t } from "@/lib/theme/tokens";

import {
  Block,
  BlockHead,
  DropZone,
  FIELD_FOCUS,
  FactRow,
  FieldArea,
  FieldInput,
  GroupHeading,
  IconSquare,
  ModalInset,
  OptionGrid,
  Panel,
  RecipeButton,
  Row,
  SegmentedField,
  Tag,
  TextLink,
  areaStyle,
  fieldStyle,
  footerStyle,
  frameStyle,
  pickerFieldStyle,
} from "./modalRecipes";

const styleOf = (element: Element) => getComputedStyle(element as HTMLElement);
/** jsdom drops a `var()` colour from a rendered style, so colours are read from the static markup, as written. */
const html = (node: ReactElement) => renderToStaticMarkup(node);

describe("the modal recipes (CA-15b P1)", () => {
  it("frame: the window recipe, radius 12, overflow hidden, at most the window less 80", () => {
    const frame = frameStyle(560);
    expect(frame).toMatchObject({ width: 560, borderRadius: 12, background: t.window, border: `1px solid ${t.windowBorder}`, boxShadow: t.windowShadow, overflow: "hidden", maxHeight: "calc(100dvh - 80px)" });
    expect(frameStyle(640).width).toBe(640);
  });

  it("icon button: 28 square, radius 7, the control recipe, a 14 glyph", () => {
    render(<IconSquare glyph="x" label="Close" />);
    const button = screen.getByRole("button", { name: "Close" });
    expect(styleOf(button)).toMatchObject({ width: "28px", height: "28px", borderRadius: "7px" });
    expect(html(<IconSquare glyph="x" label="Close" />)).toContain(`background:${t.control}`);
    expect(button.querySelector("svg")?.getAttribute("width")).toBe("14");
  });

  it("row: a 148 label column, gap 16, padding 12 20 inside a modal, a rule above", () => {
    render(
      <ModalInset.Provider value={20}>
        <Row id="app" label="Application" phone={false}>
          <input id="app" />
        </Row>
      </ModalInset.Provider>,
    );
    const row = screen.getByTestId("field-row");
    expect(styleOf(row)).toMatchObject({ gridTemplateColumns: "148px minmax(0, 1fr)", columnGap: "16px", padding: "12px 20px", alignItems: "center" });
    expect(html(<Row id="a" label="A" phone={false}><span /></Row>)).toContain(`border-top:1px solid ${t.hairlineModule}`);
    expect(screen.getByLabelText("Application")).toBeTruthy();
  });

  it("row: top-aligned puts the label 7 down; no rule drops the rule; a phone stacks it", () => {
    const { rerender } = render(
      <Row id="m" label="Models" top noRule phone={false}>
        <span />
      </Row>,
    );
    const row = screen.getByTestId("field-row");
    expect(row.style.borderTop).toBe("");
    expect((row.firstElementChild as HTMLElement).style.paddingTop).toBe("7px");
    rerender(
      <Row id="m" label="Models" phone>
        <span />
      </Row>,
    );
    expect(styleOf(screen.getByTestId("field-row")).gridTemplateColumns).toBe("minmax(0, 1fr)");
  });

  it("block: padding 14 20 16 and a rule; its head is at least 28 tall with the count in the data face", () => {
    render(
      <ModalInset.Provider value={20}>
        <Block testId="block">
          <BlockHead label="Prompt" count="48 words" countTestId="count" />
        </Block>
      </ModalInset.Provider>,
    );
    const block = screen.getByTestId("block");
    expect(styleOf(block).padding).toBe("14px 20px 16px");
    expect(html(<Block>x</Block>)).toContain(`border-top:1px solid ${t.hairlineModule}`);
    const count = screen.getByTestId("count");
    expect(count.style.fontSize).toBe("11.5px");
    expect(html(<BlockHead label="Prompt" count="48 words" />)).toContain(`color:${t.label}`);
    expect((count.parentElement as HTMLElement).style.minHeight).toBe("28px");
  });

  it("field: 32 tall, padding 0 10, radius 8, the well, 13px; a phone takes 44 and 16px", () => {
    expect(fieldStyle(false)).toMatchObject({ height: 32, padding: "0 10px", borderRadius: 8, background: t.well, fontSize: 13 });
    expect(fieldStyle(true)).toMatchObject({ height: 44, fontSize: 16 });
    render(<FieldInput phone={false} aria-label="Name" />);
    const input = screen.getByLabelText("Name");
    expect(styleOf(input)).toMatchObject({ height: "32px", borderRadius: "8px" });
    fireEvent.focus(input);
    expect(input.getAttribute("data-focused")).toBe("true");
    expect(FIELD_FOCUS).toEqual({ borderColor: t.focusRing, outline: `1px solid ${t.focusRing}`, outlineOffset: 0 });
  });

  it("text area: padding 9 10 on 20, as tall as its rows", () => {
    expect(areaStyle(false, 5)).toMatchObject({ padding: "9px 10px", lineHeight: "20px", minHeight: 120, borderRadius: 8 });
    render(<FieldArea phone={false} rows={5} aria-label="Prompt" />);
    expect(screen.getByLabelText("Prompt").getAttribute("rows")).toBe("5");
  });

  it("picker field: the well, full width, the placeholder in --label", () => {
    expect(pickerFieldStyle(false, {}, true)).toMatchObject({ width: "100%", height: 32, background: t.well, color: t.label, borderRadius: 8, textAlign: "left" });
    expect(pickerFieldStyle(false, {}, false).color).toBe(t.text);
  });

  it("segmented: the track, items 28 tall sharing the width; the chosen one on --control-on with --seg-on-border", () => {
    const pick = vi.fn();
    render(<SegmentedField label="Permissions" phone={false} value="rw" onChange={pick} items={[{ value: "r", label: "Read only" }, { value: "rw", label: "Read and write" }]} />);
    const group = screen.getByRole("radiogroup", { name: "Permissions" });
    expect(styleOf(group)).toMatchObject({ padding: "2px", gap: "2px", borderRadius: "8px", flexWrap: "wrap" });
    const seg = html(<SegmentedField label="P" phone={false} value="rw" onChange={() => {}} items={[{ value: "rw", label: "Read and write" }]} />);
    expect(seg).toContain(`background:${t.segTrack}`);
    const [first, second] = within(group).getAllByRole("radio");
    expect(styleOf(first)).toMatchObject({ height: "28px", padding: "0px 10px", borderRadius: "6px", whiteSpace: "nowrap" });
    expect(seg).toContain(`border-color:${t.segOnBorder}`);
    expect(seg).toContain(`background:${t.controlOn}`);
    fireEvent.click(first);
    expect(pick).toHaveBeenCalledWith("r");
  });

  it("option grid: three columns, gap 6; each option 32 tall, left-aligned, one line with its name as the tooltip", () => {
    render(<OptionGrid label="Connection method" phone={false} chosen={["mcp"]} onPick={() => {}} items={[{ value: "mcp", label: "MCP server" }, { value: "cli", label: "Command-line interface" }]} />);
    const grid = screen.getByRole("group", { name: "Connection method" });
    expect(styleOf(grid)).toMatchObject({ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "6px" });
    const option = screen.getByRole("button", { name: "Command-line interface" });
    expect(styleOf(option)).toMatchObject({ height: "32px", textAlign: "left", whiteSpace: "nowrap", textOverflow: "ellipsis", borderRadius: "8px" });
    expect(option.getAttribute("title")).toBe("Command-line interface");
    expect(screen.getByRole("button", { name: "MCP server" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("option grid: two columns on a phone", () => {
    render(<OptionGrid label="Usage" phone chosen={[]} onPick={() => {}} items={[{ value: "a", label: "A" }]} />);
    expect(styleOf(screen.getByRole("group", { name: "Usage" })).gridTemplateColumns).toBe("repeat(2, minmax(0, 1fr))");
  });

  it("buttons: 32 tall, radius 8; small 28; a disabled primary is the control with --text-disabled words", () => {
    render(
      <>
        <RecipeButton>Cancel</RecipeButton>
        <RecipeButton small>Copy prompt</RecipeButton>
        <RecipeButton variant="primary" disabled>
          Add
        </RecipeButton>
      </>,
    );
    expect(styleOf(screen.getByRole("button", { name: "Cancel" }))).toMatchObject({ height: "32px", borderRadius: "8px", padding: "0px 12px" });
    expect(styleOf(screen.getByRole("button", { name: "Copy prompt" }))).toMatchObject({ height: "28px", padding: "0px 10px", fontSize: "12.5px" });
    const add = screen.getByRole("button", { name: "Add" });
    const disabled = html(<RecipeButton variant="primary" disabled>Add</RecipeButton>);
    expect(disabled).toContain(`background:${t.control}`);
    expect(disabled).toContain(`color:${t.textDisabled}`);
    expect(add.hasAttribute("disabled")).toBe(true);
  });

  it("text link and tag", () => {
    render(
      <>
        <TextLink onClick={() => {}}>Add a model</TextLink>
        <Tag testId="tag">Primary</Tag>
      </>,
    );
    const link = screen.getByRole("button", { name: "Add a model" });
    expect(link.style.fontSize).toBe("12.5px");
    expect(html(<TextLink onClick={() => {}}>Add a model</TextLink>)).toContain("text-decoration:underline");
    expect(link.style.textUnderlineOffset).toBe("3px");
    expect(styleOf(screen.getByTestId("tag"))).toMatchObject({ height: "22px", padding: "0px 7px", borderRadius: "5px", fontSize: "11px" });
  });

  it("footer: padding 14 20, a rule above, the footer fill", () => {
    expect(footerStyle(false)).toMatchObject({ padding: "14px 20px", background: t.windowFoot, gap: 8, borderTop: `1px solid ${t.hairlineModule}` });
  });

  it("phone (CA-15b P4): the footer stays at the bottom of the sheet; fields and buttons are 44 tall at 16px", () => {
    expect(footerStyle(true)).toMatchObject({ position: "sticky", bottom: 0 });
    expect(fieldStyle(true)).toMatchObject({ height: 44, fontSize: 16 });
    render(<RecipeButton phone>Cancel</RecipeButton>);
    expect(screen.getByRole("button", { name: "Cancel" }).style.height).toBe("44px");
  });

  it("group heading: padding 16 20 4, a rule, 14/500", () => {
    render(
      <ModalInset.Provider value={20}>
        <GroupHeading>Model</GroupHeading>
      </ModalInset.Provider>,
    );
    const heading = screen.getByRole("heading", { name: "Model" });
    expect(heading.style.fontSize).toBe("14px");
    expect(styleOf(heading.parentElement as HTMLElement).padding).toBe("16px 20px 4px");
  });

  it("panel and fact rows: --surface, radius 10; a fact row padded 9 14 with its value in the data face", () => {
    render(
      <Panel testId="panel">
        <dl>
          <FactRow label="Licence" first testId="fact">
            MIT
          </FactRow>
        </dl>
      </Panel>,
    );
    const panel = screen.getByTestId("panel");
    expect(html(<Panel>x</Panel>)).toContain(`background:${t.surface}`);
    expect(styleOf(panel).borderRadius).toBe("10px");
    const fact = screen.getByTestId("fact");
    expect(fact.style.fontSize).toBe("12.5px");
    expect(styleOf(fact.parentElement as HTMLElement).padding).toBe("9px 14px");
  });

  it("drop zone: 148 tall, a dashed --seg-on-border edge, radius 10, its words and a small button", () => {
    const files = vi.fn();
    render(<DropZone words="Drop images or videos here" button="Choose files" onFiles={files} phone={false} inputLabel="Images" testId="drop" />);
    const zone = screen.getByText("Drop images or videos here").parentElement as HTMLElement;
    expect(styleOf(zone)).toMatchObject({ height: "148px", borderRadius: "10px", gap: "10px" });
    expect(html(<DropZone words="w" button="b" onFiles={() => {}} phone={false} inputLabel="i" />)).toContain(`border:1px dashed ${t.segOnBorder}`);
    expect(styleOf(screen.getByRole("button", { name: "Choose files" })).height).toBe("28px");
  });
});
