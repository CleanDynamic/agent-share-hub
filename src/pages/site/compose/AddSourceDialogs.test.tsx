// CA-15 P9: the three source-tile dialogs: System prompt, Dataset and GitHub repository.

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AddDatasetDialog, DATASET_DIALOG_COPY } from "./AddDatasetDialog";
import { AddRepoDialog, REPO_DIALOG_COPY } from "./AddRepoDialog";
import { AddSystemPromptDialog, SYSTEM_PROMPT_DIALOG_COPY } from "./AddSystemPromptDialog";

let phone = false;
beforeEach(() => {
  phone = false;
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: phone && /max-width/.test(query), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const add = () => screen.getByRole("button", { name: "Add" }) as HTMLButtonElement;
const status = () => screen.getByTestId("modal-status").textContent;
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const row = (name: string) => screen.getAllByTestId("optional-field").find((el) => el.querySelector("button span span")?.textContent === name) as HTMLElement;
const openRow = (name: string) => {
  const head = row(name).querySelector("button") as HTMLButtonElement;
  if (head.getAttribute("aria-expanded") !== "true") fireEvent.click(head);
};
const rowNames = () => screen.getAllByTestId("optional-field").map((el) => el.querySelector("button span span")?.textContent);

describe("Add › System prompt", () => {
  const prompts = [
    { id: "p1", label: "1 Write the intro" },
    { id: "p2", label: "2 Check the tone" },
  ];
  const open = (over: Partial<Parameters<typeof AddSystemPromptDialog>[0]> = {}) => {
    const props = { open: true, onOpenChange: vi.fn(), onAdd: vi.fn(), prompts, session: "s1", ...over };
    render(<AddSystemPromptDialog {...props} />);
    return props;
  };

  it("is a 560-wide dialog in the shared frame, saying what is required until the name and text are there", () => {
    open();
    expect(screen.getByRole("dialog", { name: SYSTEM_PROMPT_DIALOG_COPY.title })).toBeTruthy();
    expect(screen.getByTestId("add-system-prompt-dialog").style.width).toBe("560px");
    expect(screen.getByTestId("modal-subtitle").textContent).toBe("Instructions that apply across prompts");
    expect(status()).toBe("Required: a name");
    expect(add().disabled).toBe(true);
    type("Name", "Brand voice");
    expect(status()).toBe("Required: the text");
    type("Text", "Write in plain English.");
    expect(status()).toBe("All required fields complete");
    expect(add().disabled).toBe(false);
  });

  it("lists Model, Version and Variables closed in Optional, with placeholders that start e.g.", () => {
    open();
    expect(rowNames()).toEqual(["Model", "Version", "Variables"]);
    expect(screen.queryByLabelText("Version")).toBeNull();
    expect((screen.getByLabelText("Name") as HTMLInputElement).placeholder).toMatch(/^e\.g\. /);
    expect((screen.getByLabelText("Text") as HTMLTextAreaElement).placeholder).toMatch(/^e\.g\. /);
  });

  it("adds for all prompts by default, sending only what was given", () => {
    const props = open();
    type("Name", " Brand voice ");
    type("Text", " Be brief ");
    fireEvent.click(add());
    expect(props.onAdd).toHaveBeenCalledWith({ name: "Brand voice", text: "Be brief", scope: { kind: "all" } });
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("applies to this session when asked, and not at all when there is no session", () => {
    const props = open();
    type("Name", "n");
    type("Text", "x");
    fireEvent.click(screen.getByRole("radio", { name: "This session" }));
    fireEvent.click(add());
    expect(props.onAdd).toHaveBeenCalledWith(expect.objectContaining({ scope: { kind: "session", key: "s1" } }));
    cleanup();
    open({ session: null });
    expect((screen.getByRole("radio", { name: "This session" }) as HTMLInputElement).disabled || screen.getByRole("radio", { name: "This session" }).getAttribute("aria-disabled") === "true").toBe(true);
    expect(screen.getByText(SYSTEM_PROMPT_DIALOG_COPY.noSession)).toBeTruthy();
  });

  it("applies to the prompts ticked, and asks for at least one before it can be added", () => {
    const props = open();
    type("Name", "n");
    type("Text", "x");
    fireEvent.click(screen.getByRole("radio", { name: "Selected prompts" }));
    expect(status()).toBe("Required: at least one prompt for it to apply to");
    expect(add().disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "2 Check the tone" }));
    expect(add().disabled).toBe(false);
    fireEvent.click(add());
    expect(props.onAdd).toHaveBeenCalledWith(expect.objectContaining({ scope: { kind: "prompts", ids: ["p2"] } }));
  });

  it("offers no selection when the build has no prompts, and says so", () => {
    open({ prompts: [] });
    expect(screen.getByText(SYSTEM_PROMPT_DIALOG_COPY.noPrompts)).toBeTruthy();
  });

  it("finds each {name} written in the text as a variable, and sends its line only when one was written", () => {
    const props = open();
    type("Name", "n");
    type("Text", "Greet {customer} by name, in {tone}.");
    openRow("Variables");
    expect(screen.getByLabelText("{customer}")).toBeTruthy();
    expect(screen.getByLabelText("{tone}")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("{customer}"), { target: { value: "Their first name" } });
    fireEvent.click(add());
    expect(props.onAdd).toHaveBeenCalledWith(expect.objectContaining({ variables: [{ name: "customer", description: "Their first name" }, { name: "tone", description: "" }] }));
  });

  it("counts the text against its 20,000 characters", () => {
    open();
    type("Text", "x".repeat(12));
    expect(screen.getByText("12 / 20,000")).toBeTruthy();
    expect((screen.getByLabelText("Text") as HTMLTextAreaElement).maxLength).toBe(20_000);
  });

  it("keeps 44-high targets on a phone", () => {
    phone = true;
    open();
    expect(screen.getByTestId("bottom-sheet")).toBeTruthy();
    for (const button of [add(), screen.getByRole("button", { name: "Cancel" })]) expect(button.style.height).toBe("44px");
  });
});

describe("Add › Dataset", () => {
  const open = () => {
    const props = { open: true, onOpenChange: vi.fn(), onAdd: vi.fn() };
    render(<AddDatasetDialog {...props} />);
    return props;
  };

  it("is a 560-wide dialog that asks for a name and a description", () => {
    open();
    expect(screen.getByRole("dialog", { name: DATASET_DIALOG_COPY.title })).toBeTruthy();
    expect(screen.getByTestId("add-dataset-dialog").style.width).toBe("560px");
    expect(status()).toBe("Required: a name");
    type("Name", "Tickets");
    expect(status()).toBe("Required: a description");
    type("Description", "Support tickets");
    expect(status()).toBe("All required fields complete");
  });

  it("shows Use as five choices, none chosen, and a second press takes the choice off", () => {
    open();
    const use = screen.getAllByRole("button").filter((button) => ["Training", "Fine-tuning", "Evaluation", "Retrieval", "Testing"].includes(button.textContent ?? ""));
    expect(use.map((button) => button.textContent)).toEqual(["Training", "Fine-tuning", "Evaluation", "Retrieval", "Testing"]);
    expect(use.map((button) => button.getAttribute("aria-pressed"))).toEqual(Array(5).fill("false"));
    fireEvent.click(use[2]);
    expect(use[2].getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(use[2]);
    expect(use[2].getAttribute("aria-pressed")).toBe("false");
  });

  it("lists its optional rows in order, and adds the Chunking row only for retrieval", () => {
    open();
    expect(rowNames()).toEqual(["Format", "Record count", "Columns", "Source", "Sample records", "Licence"]);
    fireEvent.click(screen.getByRole("button", { name: "Retrieval" }));
    expect(rowNames()).toEqual(["Format", "Record count", "Columns", "Source", "Sample records", "Licence", "Chunking"]);
  });

  it("sends only what was given, with the record count as typed digits and columns one per line", () => {
    const props = open();
    type("Name", "Tickets");
    type("Description", "Support tickets");
    fireEvent.click(screen.getByRole("button", { name: "Evaluation" }));
    openRow("Record count");
    type("Record count", "1,2x00");
    openRow("Columns");
    type("Columns", "id\n\n total ");
    fireEvent.click(add());
    expect(props.onAdd).toHaveBeenCalledWith({ name: "Tickets", description: "Support tickets", use: "evaluation", recordCount: "1200", columns: ["id", "total"] });
  });

  it("sends the chunking only for retrieval, and drops it when the use is changed", () => {
    const props = open();
    type("Name", "Docs");
    type("Description", "Handbook");
    fireEvent.click(screen.getByRole("button", { name: "Retrieval" }));
    openRow("Chunking");
    type("Chunk strategy", "By paragraph");
    type("Chunk size", "512");
    type("Embedding model", "text-embedding-3-small");
    fireEvent.click(screen.getByRole("button", { name: "Retrieval" }));
    fireEvent.click(add());
    expect(props.onAdd).toHaveBeenCalledWith({ name: "Docs", description: "Handbook", use: null });
  });

  it("will not add more than five sample records, saying why", () => {
    open();
    type("Name", "n");
    type("Description", "d");
    openRow("Sample records");
    type("Sample records", "1\n2\n3\n4\n5\n6");
    expect(add().disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toBe("Sample records are at most 5, one per line.");
  });
});

describe("Add › GitHub repository", () => {
  const facts = { stars: 12, defaultBranch: "main", language: "TypeScript", licenceSpdx: "MIT", licenceName: "MIT License", pushedAt: "2026-09-01T00:00:00Z", fetchedAt: "2026-10-07T09:00:00Z" };
  const open = (fetchRepo = vi.fn().mockResolvedValue(facts)) => {
    const props = { open: true, onOpenChange: vi.fn(), onAdd: vi.fn(), fetchRepo };
    render(<AddRepoDialog {...props} />);
    return props;
  };
  const owner = (label: string) => fireEvent.click(screen.getByRole("radio", { name: label }));

  it("is a 560-wide dialog that asks for a URL and an ownership", () => {
    open();
    expect(screen.getByRole("dialog", { name: REPO_DIALOG_COPY.title })).toBeTruthy();
    expect(screen.getByTestId("add-repo-dialog").style.width).toBe("560px");
    expect(status()).toBe("Required: a repository URL");
    type("Repository URL", "github.com/acme/shop");
    expect(status()).toBe("Required: an ownership");
    owner("Third-party repository");
    expect(status()).toBe("All required fields complete");
  });

  it("asks GitHub once for a valid address, and shows the repository, language, licence and last commit", async () => {
    const props = open();
    expect(screen.queryByTestId("repo-retrieved")).toBeNull();
    type("Repository URL", "https://github.com/acme/shop");
    expect(screen.getByText("Reading from GitHub")).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId("repo-name").textContent).toBe("acme/shop"));
    expect(props.fetchRepo).toHaveBeenCalledTimes(1);
    expect(props.fetchRepo).toHaveBeenCalledWith("acme", "shop");
    expect(screen.getByTestId("repo-language").textContent).toBe("TypeScript");
    expect(screen.getByTestId("repo-licence").textContent).toBe("MIT · reuse permitted");
    expect(screen.getByTestId("repo-pushed").textContent).toContain("1 Sep 2026");
  });

  it("says a repository with no licence has none and reuse is not granted, and flags one idle for over a year", async () => {
    open(vi.fn().mockResolvedValue({ ...facts, licenceSpdx: null, licenceName: null, pushedAt: "2020-01-01T00:00:00Z" }));
    type("Repository URL", "github.com/acme/old");
    await screen.findByTestId("repo-licence");
    expect(screen.getByTestId("repo-licence").textContent).toBe("No licence · reuse not granted");
    expect(screen.getByTestId("repo-pushed").textContent).toContain("Possibly unmaintained");
  });

  it("stays valid with the URL alone when GitHub cannot be reached, and says so", async () => {
    const props = open(vi.fn().mockResolvedValue(null));
    type("Repository URL", "github.com/acme/shop");
    owner("Your existing repository");
    expect((await screen.findByTestId("repo-unreachable")).textContent).toBe("Could not reach GitHub. Details can be added by hand.");
    fireEvent.click(add());
    expect(props.onAdd).toHaveBeenCalledWith({ url: "https://github.com/acme/shop", ownership: "owned" });
  });

  it("does not ask for an address that is not a repository, and asks again for a different one", async () => {
    const props = open();
    type("Repository URL", "github.com/acme");
    await act(async () => undefined);
    expect(props.fetchRepo).not.toHaveBeenCalled();
    type("Repository URL", "github.com/acme/one");
    await screen.findByTestId("repo-name");
    type("Repository URL", "github.com/acme/two");
    await waitFor(() => expect(screen.getByTestId("repo-name").textContent).toBe("acme/two"));
    expect(props.fetchRepo).toHaveBeenCalledTimes(2);
  });

  it("a third-party repository asks for its author (the owner, until changed) and how it was used, and sends the retrieved facts", async () => {
    const props = open();
    type("Repository URL", "github.com/acme/shop");
    owner("Third-party repository");
    expect((screen.getByLabelText("Author") as HTMLInputElement).value).toBe("acme");
    expect(screen.queryByText("Visibility")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Copied source code" }));
    await screen.findByTestId("repo-name");
    fireEvent.click(add());
    expect(props.onAdd).toHaveBeenCalledWith(expect.objectContaining({ url: "https://github.com/acme/shop", ownership: "third_party", author: "acme", usage: ["copied"], fetched: facts }));
  });

  it("your own repository asks for visibility and where it is deployed, not for an author", () => {
    open();
    type("Repository URL", "github.com/me/mine");
    owner("Created in this build");
    expect(screen.getByText("Visibility")).toBeTruthy();
    expect(screen.getByLabelText("Deployed URL")).toBeTruthy();
    expect(screen.queryByLabelText("Author")).toBeNull();
    expect(rowNames()).toEqual(["Pinned version", "Path", "Key files", "Run instructions"]);
  });

  it("offers Modifications only for a third party's repository", () => {
    open();
    type("Repository URL", "github.com/acme/shop");
    owner("Third-party repository");
    expect(rowNames()).toContain("Modifications");
  });

  it("asks for run instructions as environment variable names, and refuses a line that holds a key's value before anything is added", () => {
    const props = open();
    type("Repository URL", "github.com/acme/shop");
    owner("Your existing repository");
    openRow("Run instructions");
    expect(screen.getByText("One command per line. Name keys, never paste their values.")).toBeTruthy();
    type("Run instructions", "npm ci\nAPI_KEY=abcdefghijklmnopqrstuvwxyz");
    fireEvent.click(add());
    expect(props.onAdd).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe(REPO_DIALOG_COPY.runSecret);
    expect(screen.getByRole("alert").textContent).not.toContain("abcdefghijklmnopqrstuvwxyz");
    type("Run instructions", "npm ci\nexport API_KEY=$API_KEY");
    fireEvent.click(add());
    expect(props.onAdd).toHaveBeenCalledWith(expect.objectContaining({ run: ["npm ci", "export API_KEY=$API_KEY"] }));
  });

  it("sends a pinned version only once it has both a kind and a value", () => {
    const props = open();
    type("Repository URL", "github.com/acme/shop");
    owner("Your existing repository");
    openRow("Pinned version");
    fireEvent.click(screen.getByRole("radio", { name: "Tag" }));
    fireEvent.click(add());
    expect(props.onAdd).toHaveBeenLastCalledWith({ url: "https://github.com/acme/shop", ownership: "owned" });
    type("Pinned value", "v1.4.2");
    fireEvent.click(add());
    expect(props.onAdd).toHaveBeenLastCalledWith(expect.objectContaining({ pin: { kind: "tag", value: "v1.4.2" } }));
  });
});
