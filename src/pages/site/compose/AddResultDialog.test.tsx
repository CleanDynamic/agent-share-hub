import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ResultTileBody } from "@/components/build/tileBodies";
import { resultFactsOf, resultHoldsWord, resultLinkOf, resultRefusal, resultSummaryOf } from "@/lib/build/graph";

import { AddResultDialog, RESULT_DIALOG_COPY } from "./AddResultDialog";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(cleanup);

const open = () => {
  const onAdd = vi.fn();
  render(<AddResultDialog open onOpenChange={vi.fn()} onAdd={onAdd} />);
  return onAdd;
};
const add = () => screen.getByRole("button", { name: "Add" }) as HTMLButtonElement;

describe("Add › Result (CA-12 P9)", () => {
  it("asks what the result is, and waits for the matching field", () => {
    const onAdd = open();
    expect(screen.getByRole("dialog", { name: RESULT_DIALOG_COPY.title })).toBeTruthy();
    for (const name of ["A link", "Pictures or video", "A file", "A model"]) expect(screen.getByRole("button", { name })).toBeTruthy();
    expect(add().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Web address"), { target: { value: "plumandrye.example/shop?x=1" } });
    fireEvent.click(add());
    expect(onAdd).toHaveBeenCalledWith({ kind: "link", url: "plumandrye.example/shop?x=1" });
  });

  it("a model asks what it is based on and how it was trained", () => {
    const onAdd = open();
    fireEvent.click(screen.getByRole("button", { name: "A model" }));
    fireEvent.change(screen.getByLabelText("Based on"), { target: { value: "Muse Spark Open" } });
    fireEvent.click(add());
    expect(onAdd).toHaveBeenCalledWith({ kind: "model", baseModel: "Muse Spark Open", method: "" });
  });

  it("pictures refuse a document and take up to the limit", () => {
    const onAdd = open();
    fireEvent.click(screen.getByRole("button", { name: "Pictures or video" }));
    fireEvent.change(screen.getByTestId("result-files"), { target: { files: [new File(["x"], "spec.pdf", { type: "application/pdf" })] } });
    expect(screen.getByRole("alert").textContent).toBe("spec.pdf is not a picture or a video.");
    const png = new File(["x"], "hero.png", { type: "image/png" });
    fireEvent.change(screen.getByTestId("result-files"), { target: { files: [png] } });
    fireEvent.click(add());
    expect(onAdd).toHaveBeenCalledWith({ kind: "pictures", files: [png] });
  });

  it("a file takes one file of any kind", () => {
    const onAdd = open();
    fireEvent.click(screen.getByRole("button", { name: "A file" }));
    const pdf = new File(["x"], "spec.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByTestId("result-files"), { target: { files: [pdf] } });
    fireEvent.click(add());
    expect(onAdd).toHaveBeenCalledWith({ kind: "file", file: pdf });
  });
});

describe("what a result holds (CA-12 P9)", () => {
  it("splits a link for its card", () => {
    expect(resultLinkOf("https://www.plumandrye.example/shop?x=1")).toMatchObject({ site: "plumandrye.example", path: "/shop?x=1", host: "plumandrye.example" });
    expect(resultLinkOf("plumandrye.example")).toMatchObject({ site: "plumandrye.example", path: "" });
    expect(resultLinkOf("javascript:alert(1)")).toBeNull();
    expect(resultLinkOf("")).toBeNull();
  });

  it("reads each kind, never says 'text', and says Nothing added yet when empty", () => {
    expect(resultHoldsWord(resultFactsOf({ payload: { url: "a.example" } }))).toBe("a link");
    expect(resultHoldsWord(resultFactsOf({ payload: { media_id: "m1" } }))).toBe("a picture");
    expect(resultHoldsWord(resultFactsOf({ payload: { media_ids: ["a", "b"] } }))).toBe("2 pictures");
    expect(resultHoldsWord(resultFactsOf({ payload: { media_id: "m1", file_name: "spec.pdf" } }))).toBe("a file");
    expect(resultHoldsWord(resultFactsOf({ payload: { kind: "trained-model", base_model: "X" } }))).toBe("a trained model");
    expect(resultHoldsWord(resultFactsOf({ payload: { summary: "Untitled result" } }))).toBe("Nothing added yet");
    expect(resultFactsOf({ payload: { summary: "x" } }).mediaIds).toEqual([]);
  });

  it("names a new result and refuses what is empty", () => {
    expect(resultSummaryOf({ kind: "link", url: "https://a.example/x" })).toBe("a.example");
    expect(resultSummaryOf({ kind: "media", mediaIds: ["a", "b", "c"], names: ["one.png", "two.png", "three.png"] })).toBe("one.png and 2 more");
    expect(resultRefusal({ kind: "link", url: "nope" })).toBeNull();
    expect(resultRefusal({ kind: "media", mediaIds: [], names: [] })).toMatch(/Add a picture/);
    expect(resultRefusal({ kind: "model", baseModel: "", method: "" })).toMatch(/based on/);
  });
});

describe("the result tile body (CA-12 P9)", () => {
  it("a link is a card with the site in bold and the path under it, and a link glyph when the icon fails", () => {
    render(<ResultTileBody facts={resultFactsOf({ payload: { url: "https://plumandrye.example/shop" } })} />);
    const card = screen.getByTestId("result-link") as HTMLAnchorElement;
    expect(card.href).toBe("https://plumandrye.example/shop");
    expect(card.textContent).toContain("plumandrye.example");
    expect(card.textContent).toContain("/shop");
    fireEvent.error(card.querySelector("img") as HTMLImageElement);
    expect(screen.getByTestId("site-icon").hasAttribute("data-fallback")).toBe(true);
  });

  it("shows at most 4 thumbnails and counts the rest", () => {
    render(<ResultTileBody facts={resultFactsOf({ payload: { media_ids: ["a", "b", "c", "d", "e", "f"] } })} />);
    expect(screen.getAllByTestId("manual-thumb")).toHaveLength(4);
    expect(screen.getByText("+2 more")).toBeTruthy();
  });

  it("a file shows its type, name and size; a model its base and method; an empty one says so", () => {
    render(<ResultTileBody facts={resultFactsOf({ payload: { media_id: "m", file_name: "spec.pdf", file_size: 2048 } })} />);
    expect(screen.getByTestId("result-file").textContent).toContain("spec.pdf");
    cleanup();
    render(<ResultTileBody facts={resultFactsOf({ payload: { kind: "trained-model", base_model: "Muse", method: "Fine-tuned" } })} />);
    expect(screen.getByTestId("result-model").textContent).toBe("Based on Muse");
    expect(screen.getByText("Fine-tuned")).toBeTruthy();
    cleanup();
    render(<ResultTileBody facts={resultFactsOf({ payload: {} })} />);
    expect(screen.getByTestId("result-empty").textContent).toBe("Nothing added yet");
    expect(document.body.textContent).not.toMatch(/\btext\b/);
  });
});
