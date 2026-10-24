// CA-23: the two strips' words and measures, and where the view puts them.

import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { vi, describe, expect, it } from "vitest";

import { OfflineStrip, OtherTabStrip, STRIP_COPY, Strips } from "./saveStrips";

describe("the offline strip", () => {
  it("says what it says", () => {
    expect(STRIP_COPY.offline).toBe("Offline. Changes save when you reconnect.");
    render(<OfflineStrip />);
    expect(screen.getByTestId("offline-strip").textContent).toBe("Offline. Changes save when you reconnect.");
  });

  it("is min-height 40, padding 8 8 8 14, radius 10, the well's fill, a 1px hairline, 13/18 text", () => {
    const markup = renderToStaticMarkup(<OfflineStrip />);
    for (const part of ["min-height:40px", "padding:8px 8px 8px 14px", "border-radius:10px", "background:var(--well)", "border:1px solid var(--hairline)", "font-size:13px", "line-height:18px", "color:var(--text)"]) expect(markup).toContain(part);
  });
});

describe("the other-tab strip", () => {
  it("is the same strip, with Show changes at its right: 26 tall, padding 0 9, 12/500, radius 7", () => {
    const markup = renderToStaticMarkup(<OtherTabStrip onShow={() => undefined} />);
    expect(markup).toContain("Changed in another tab");
    for (const part of ["min-height:40px", "padding:8px 8px 8px 14px", "border-radius:10px", "background:var(--well)"]) expect(markup).toContain(part);
    const button = /<button[^>]*style="([^"]*)"/.exec(markup)?.[1] ?? "";
    for (const part of ["height:26px", "padding:0 9px", "border-radius:7px", "font-size:12px", "font-weight:500", "margin-left:auto"]) expect(button).toContain(part);
    expect(markup).toContain("Show changes");
  });

  it("asks for the changes when pressed", () => {
    const onShow = vi.fn();
    render(<OtherTabStrip onShow={onShow} />);
    fireEvent.click(screen.getByRole("button", { name: "Show changes" }));
    expect(onShow).toHaveBeenCalledTimes(1);
  });
});

it("stacks strips 8 apart", () => {
  expect(renderToStaticMarkup(<Strips><OfflineStrip /><OtherTabStrip onShow={() => undefined} /></Strips>)).toContain("gap:8px");
});
