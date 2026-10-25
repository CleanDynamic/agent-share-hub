import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { Json } from "@/integrations/supabase/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ResultTileBody } from "@/components/build/tileBodies";
import { resultFactsOf, resultHolds, resultHoldsWord, resultLinkOf, resultRefusal, resultSummaryOf, resultTypeLabel } from "@/lib/build/graph";

import { AddResultDialog, RESULT_CHOICES, RESULT_DIALOG_COPY } from "./AddResultDialog";
import { fieldNames, openOptional } from "./optionalKit";

let phone = false;
beforeEach(() => {
  phone = false;
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: phone && /max-width/.test(query), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(cleanup);

const open = () => {
  const onAdd = vi.fn();
  render(<AddResultDialog open onOpenChange={vi.fn()} onAdd={onAdd} />);
  return onAdd;
};
const add = () => screen.getByRole("button", { name: "Add" }) as HTMLButtonElement;
const type = (name: string) => fireEvent.click(within(screen.getByRole("group", { name: "Output type" })).getByRole("button", { name }));
const status = () => screen.getByTestId("modal-status").textContent;
const type_ = (label: string, value: string) => fireEvent.change(screen.getAllByLabelText(label).at(-1) as HTMLElement, { target: { value } });

describe("Add › Result (CA-12 P9, CA-15 P3)", () => {
  it("is the shared frame, with its subtitle and twelve output types, link first", () => {
    open();
    expect(screen.getByRole("dialog", { name: RESULT_DIALOG_COPY.title })).toBeTruthy();
    expect(screen.getByTestId("modal-subtitle").textContent).toBe("Output of this prompt");
    const grid = within(screen.getByRole("group", { name: "Output type" }));
    expect(grid.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Link",
      "Image or video",
      "File",
      "Model",
      "Text",
      "Audio",
      "Deployed app or website",
      "Data table",
      "Sent message",
      "Change in an external app",
      "Metric",
      "Offline outcome",
    ]);
    expect(RESULT_CHOICES).toHaveLength(12);
    expect(grid.getByRole("button", { name: "Link" }).getAttribute("aria-pressed")).toBe("true");
    expect(document.body.textContent).not.toMatch(/What is the result|Web address|A link|Pictures or video/);
  });

  it("asks a link for its URL, and says what is missing until it has it", () => {
    const onAdd = open();
    expect(add().disabled).toBe(true);
    expect(status()).toBe("Required: URL");
    type_("URL", "plumandrye.example/shop?x=1");
    expect(status()).toBe("Required fields complete");
    fireEvent.click(add());
    expect(onAdd).toHaveBeenCalledWith({ kind: "link", url: "plumandrye.example/shop?x=1", caption: "" });
  });

  it("a model asks for a base model or a training method", () => {
    const onAdd = open();
    type("Model");
    expect(status()).toBe("Required: Base model, Training method");
    type_("Base model", "Muse Spark Open");
    fireEvent.click(add());
    expect(onAdd).toHaveBeenCalledWith({ kind: "model", baseModel: "Muse Spark Open", method: "", caption: "" });
  });

  it("an image or video refuses a document and takes up to the limit", () => {
    const onAdd = open();
    type("Image or video");
    fireEvent.change(screen.getByTestId("result-files"), { target: { files: [new File(["x"], "spec.pdf", { type: "application/pdf" })] } });
    expect(screen.getByRole("alert").textContent).toBe("spec.pdf: image or video only");
    const png = new File(["x"], "hero.png", { type: "image/png" });
    fireEvent.change(screen.getByTestId("result-files"), { target: { files: [png] } });
    fireEvent.click(add());
    expect(onAdd).toHaveBeenCalledWith({ kind: "pictures", files: [png], caption: "" });
  });

  it("a file takes one file of any kind", () => {
    const onAdd = open();
    type("File");
    const pdf = new File(["x"], "spec.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByTestId("result-files"), { target: { files: [pdf] } });
    fireEvent.click(add());
    expect(onAdd).toHaveBeenCalledWith({ kind: "file", file: pdf, caption: "" });
  });

  it("text needs the text", () => {
    const onAdd = open();
    type("Text");
    expect(status()).toBe("Required: Text");
    type_("Text", " Hello there ");
    fireEvent.click(add());
    expect(onAdd).toHaveBeenCalledWith({ kind: "text", text: "Hello there", caption: "" });
  });

  it("audio takes one audio file and refuses anything else", () => {
    const onAdd = open();
    type("Audio");
    expect(status()).toBe("Required: Audio file");
    fireEvent.change(screen.getByTestId("result-files"), { target: { files: [new File(["x"], "memo.png", { type: "image/png" })] } });
    expect(screen.getByRole("alert").textContent).toBe("memo.png: audio file only");
    const wav = new File(["x"], "memo.wav", { type: "audio/wav" });
    fireEvent.change(screen.getByTestId("result-files"), { target: { files: [wav] } });
    fireEvent.click(add());
    expect(onAdd).toHaveBeenCalledWith({ kind: "audio", file: wav, caption: "" });
  });

  it("a deployed app or website needs a URL", () => {
    const onAdd = open();
    type("Deployed app or website");
    type_("URL", "app.plumandrye.example");
    fireEvent.click(add());
    expect(onAdd).toHaveBeenCalledWith({ kind: "deployed", url: "app.plumandrye.example", caption: "" });
  });

  it("a data table takes a CSV file, or pasted CSV with its columns counted", () => {
    const onAdd = open();
    type("Data table");
    expect(status()).toBe("Required: CSV file, Pasted CSV");
    type_("Pasted CSV", "name,price,stock\nsourdough,4.5,12");
    fireEvent.click(add());
    expect(onAdd).toHaveBeenCalledWith({ kind: "table", file: null, csv: "name,price,stock\nsourdough,4.5,12", columns: 3, caption: "" });
  });

  it("a sent message needs a channel and the message", () => {
    const onAdd = open();
    type("Sent message");
    expect(status()).toBe("Required: Channel, Message");
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Channel" })).getByRole("radio", { name: "Slack" }));
    expect(status()).toBe("Required: Message");
    type_("Message", "Your loaves are ready");
    fireEvent.click(add());
    expect(onAdd).toHaveBeenCalledWith({ kind: "message", channel: "slack", message: "Your loaves are ready", caption: "" });
  });

  it("a change in an external app needs the application and what changed", () => {
    open();
    type("Change in an external app");
    expect(status()).toBe("Required: App, What changed");
    expect(screen.getByText("Select an app")).toBeTruthy();
  });

  it("a metric needs a value and a label, and keeps its unit and value before in Optional", () => {
    const onAdd = open();
    type("Metric");
    expect(status()).toBe("Required: Value, Label");
    type_("Value", "42");
    expect(status()).toBe("Required: Label");
    type_("Label", "Orders per week");
    expect(fieldNames()).toEqual(["Unit", "Value before", "Caption"]);
    type_("Unit", "orders");
    type_("Value before", "31");
    fireEvent.click(add());
    expect(onAdd).toHaveBeenCalledWith({ kind: "metric", value: "42", label: "Orders per week", unit: "orders", before: "31", caption: "" });
  });

  it("an offline outcome needs a description, and takes one photo in Optional", () => {
    const onAdd = open();
    type("Offline outcome");
    expect(status()).toBe("Required: Description");
    type_("Description", "Delivered the loaves by hand");
    openOptional();
    const photo = new File(["x"], "stall.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByTestId("result-photo"), { target: { files: [photo] } });
    fireEvent.click(add());
    expect(onAdd).toHaveBeenCalledWith({ kind: "offline", description: "Delivered the loaves by hand", photo, caption: "" });
  });

  it("every type has a one-line caption in Optional, closed to begin with, and hands it back trimmed", () => {
    const onAdd = open();
    expect(screen.getByTestId("optional-toggle").getAttribute("aria-expanded")).toBe("false");
    type_("URL", "plumandrye.example");
    openOptional();
    type_("Caption", "  The launch page  ");
    fireEvent.click(add());
    expect(onAdd).toHaveBeenCalledWith({ kind: "link", url: "plumandrye.example", caption: "The launch page" });
  });

  it("is a bottom sheet on a phone", () => {
    phone = true;
    open();
    expect(screen.getByTestId("bottom-sheet")).toBeTruthy();
    expect(screen.getByTestId("modal-subtitle").textContent).toBe("Output of this prompt");
  });
});

describe("what a result holds (CA-12 P9, CA-15 P3)", () => {
  it("splits a link for its card", () => {
    expect(resultLinkOf("https://www.plumandrye.example/shop?x=1")).toMatchObject({ site: "plumandrye.example", path: "/shop?x=1", host: "plumandrye.example" });
    expect(resultLinkOf("plumandrye.example")).toMatchObject({ site: "plumandrye.example", path: "" });
    expect(resultLinkOf("javascript:alert(1)")).toBeNull();
    expect(resultLinkOf("")).toBeNull();
  });

  it("reads each kind, never says 'text' for nothing, and says Nothing added yet when empty", () => {
    expect(resultHoldsWord(resultFactsOf({ payload: { url: "a.example" } }))).toBe("a link");
    expect(resultHoldsWord(resultFactsOf({ payload: { media_id: "m1" } }))).toBe("a picture");
    expect(resultHoldsWord(resultFactsOf({ payload: { media_ids: ["a", "b"] } }))).toBe("2 pictures");
    expect(resultHoldsWord(resultFactsOf({ payload: { media_id: "m1", file_name: "spec.pdf" } }))).toBe("a file");
    expect(resultHoldsWord(resultFactsOf({ payload: { kind: "trained-model", base_model: "X" } }))).toBe("a trained model");
    expect(resultHoldsWord(resultFactsOf({ payload: { summary: "Untitled result" } }))).toBe("Nothing added yet");
    expect(resultFactsOf({ payload: { summary: "x" } }).mediaIds).toEqual([]);
  });

  it("reads each newer kind, and an unknown kind reads as it always did", () => {
    const word = (payload: Record<string, Json>) => resultHoldsWord(resultFactsOf({ payload }));
    expect(word({ kind: "text", text: "Hi" })).toBe("some text");
    expect(word({ kind: "audio", media_id: "m", file_name: "a.wav", duration: 83 })).toBe("an audio file");
    expect(word({ kind: "deployed", url: "app.example" })).toBe("a deployed app");
    expect(word({ kind: "table", file_name: "t.csv", media_id: "m", columns: 4 })).toBe("a data table");
    expect(word({ kind: "message", channel: "email", message: "Hello" })).toBe("a sent message");
    expect(word({ kind: "external_change", application: "GitHub", change: "Opened a PR" })).toBe("a change in another app");
    expect(word({ kind: "metric", value: "42", label: "Orders" })).toBe("a metric");
    expect(word({ kind: "offline", description: "Delivered" })).toBe("an offline outcome");
    // A kind this build does not know: read from what the payload holds, as before.
    expect(word({ kind: "hologram", url: "a.example" })).toBe("a link");
    expect(word({ kind: "hologram" })).toBe("Nothing added yet");
    expect(resultHolds(resultFactsOf({ payload: { kind: "hologram" } }))).toBe(false);
    expect(resultFactsOf({ payload: { kind: "text", text: "Hi", caption: " A line " } }).caption).toBe("A line");
  });

  it("names the output type for the tile's type line", () => {
    const label = (payload: Record<string, Json>) => resultTypeLabel(resultFactsOf({ payload }));
    expect(label({ url: "a.example" })).toBe("Link");
    expect(label({ media_id: "m" })).toBe("Image or video");
    expect(label({ media_id: "m", file_name: "a.pdf" })).toBe("File");
    expect(label({ kind: "trained-model", base_model: "X" })).toBe("Model");
    expect(label({ kind: "metric", value: "4", label: "x" })).toBe("Metric");
    expect(label({ kind: "deployed", url: "a.example" })).toBe("Deployed app or website");
    expect(label({})).toBeNull();
  });

  it("names a new result and refuses what is empty", () => {
    expect(resultSummaryOf({ kind: "link", url: "https://a.example/x" })).toBe("a.example");
    expect(resultSummaryOf({ kind: "media", mediaIds: ["a", "b", "c"], names: ["one.png", "two.png", "three.png"] })).toBe("one.png and 2 more");
    expect(resultSummaryOf({ kind: "message", channel: "slack", message: "Your loaves are ready\nsecond line" })).toBe("Slack: Your loaves are ready");
    expect(resultSummaryOf({ kind: "metric", value: "42", label: "Orders per week" })).toBe("Orders per week");
    expect(resultRefusal({ kind: "link", url: "nope" })).toBeNull();
    expect(resultRefusal({ kind: "media", mediaIds: [], names: [] })).toMatch(/Add an image/);
    expect(resultRefusal({ kind: "model", baseModel: "", method: "" })).toMatch(/based on/);
    expect(resultRefusal({ kind: "text", text: "  " })).toBe("Add the text.");
    expect(resultRefusal({ kind: "message", channel: "email", message: "" })).toBe("Add the message.");
    expect(resultRefusal({ kind: "metric", value: "4", label: "" })).toBe("Add the label.");
    expect(resultRefusal({ kind: "table", csv: "" })).toMatch(/CSV/);
    expect(resultRefusal({ kind: "text", text: "x", caption: "y".repeat(141) })).toMatch(/Caption/);
  });
});

describe("the result tile body (CA-12 P9, CA-15 P3)", () => {
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
    expect(screen.getByText("+2")).toBeTruthy();
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

  const body = (payload: Record<string, Json>) => {
    cleanup();
    render(<ResultTileBody facts={resultFactsOf({ payload })} />);
    return screen.getByTestId("result-tile");
  };

  it("text shows its first two lines", () => {
    const tile = body({ kind: "text", text: "One\nTwo\nThree" });
    expect(screen.getByTestId("result-text").textContent).toBe("One\nTwo\nThree");
    expect(screen.getByTestId("result-text").style.overflow).toBe("hidden");
    expect(tile.getAttribute("data-kind")).toBe("text");
  });

  it("audio shows its file name and its length when it is known", () => {
    body({ kind: "audio", media_id: "m", file_name: "memo.wav", duration: 83 });
    expect(screen.getByTestId("result-audio").textContent).toBe("memo.wav1:23");
    body({ kind: "audio", media_id: "m", file_name: "memo.wav" });
    expect(screen.getByTestId("result-audio").textContent).toBe("memo.wav");
  });

  it("a deployed app is the link card with the host and 'Deployed app'", () => {
    body({ kind: "deployed", url: "https://app.plumandrye.example/x" });
    const card = screen.getByTestId("result-link");
    expect(card.textContent).toContain("app.plumandrye.example");
    expect(card.textContent).toContain("Deployed app");
    expect(card.textContent).not.toContain("/x");
  });

  it("a data table shows its file name and column count, or says it was pasted", () => {
    body({ kind: "table", media_id: "m", file_name: "orders.csv", columns: 6 });
    expect(screen.getByTestId("result-table").textContent).toBe("orders.csv6 columns");
    body({ kind: "table", csv: "a,b", columns: 2 });
    expect(screen.getByTestId("result-table").textContent).toBe("Pasted CSV2 columns");
  });

  it("a sent message shows its channel and first line", () => {
    const tile = body({ kind: "message", channel: "text", message: "On my way\nsee you" });
    expect(tile.textContent).toBe("Text messageOn my way");
  });

  it("a change in an external app shows the application, then what changed", () => {
    body({ kind: "external_change", application: "GitHub", change: "Opened a pull request" });
    expect(screen.getByTestId("result-app").textContent).toBe("GitHub");
    expect(screen.getByTestId("result-change").textContent).toBe("Opened a pull request");
  });

  it("a metric shows value and unit in mono, then the label, and 'from' only when it was given", () => {
    const tile = body({ kind: "metric", value: "42", unit: "orders", label: "Per week", before: "31" });
    expect(screen.getByTestId("result-metric").textContent).toBe("42 orders");
    expect(screen.getByTestId("result-metric").style.fontFamily).not.toBe("");
    expect(tile.textContent).toBe("42 ordersPer weekfrom 31");
    expect(body({ kind: "metric", value: "42", label: "Per week" }).textContent).toBe("42Per week");
  });

  it("an offline outcome shows its first line, and a 48px photo only when there is one", () => {
    body({ kind: "offline", description: "Delivered by hand\nsecond", media_id: "m" });
    expect(screen.getByTestId("result-offline").textContent).toBe("Delivered by hand");
    expect(screen.getAllByTestId("manual-thumb")).toHaveLength(1);
    body({ kind: "offline", description: "Delivered by hand" });
    expect(screen.queryAllByTestId("manual-thumb")).toHaveLength(0);
  });
});
