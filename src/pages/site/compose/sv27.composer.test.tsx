// SV-27 Part 7: deployment in the composer. The Add menu's Deployment group, the deployment window, the List's Deployment
// section, the move refusal, and a paid partnership or vendor affiliation.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEPLOYMENT_MOVE_REFUSAL, deploymentMoveRefusal, deploymentSectionMeta, deploymentTilesOf, groupDeployment } from "@/lib/build/deployment";
import { partnershipLine, partnershipOf, partnershipRefusal } from "@/lib/build/partnership";
import type { NodeTree } from "@/lib/build/types";

import { DeploymentDialog } from "./DeploymentDialog";
import { DeploymentSection } from "./DeploymentSection";
import { addEntries } from "./SandboxView";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const node = (id: string, position: number, type: string, payload: Record<string, unknown>): NodeTree =>
  ({ id, build_id: "b1", type, title: null, note: null, payload, position, parent_id: null, source_ref: null, event_id: null, is_gap: false, created_at: "", children: [] }) as unknown as NodeTree;

describe("the Add menu's Deployment group", () => {
  it("comes after the existing items, headed Deployment, each ready once its node type is live", () => {
    const onAddDeployment = vi.fn();
    const before = addEntries({ deploymentLive: (type) => type === "live_app", onAddDeployment });
    const deployment = before.filter((entry) => entry.key.startsWith("deploy:"));
    expect(deployment.map((entry) => entry.name)).toEqual(["Host", "Inference server", "Knowledge base", "Memory", "Relay", "Channel", "Voice", "Front end", "Monitoring", "Billing"]);
    expect(deployment[0].group).toBe("Deployment");
    expect(before.indexOf(deployment[0])).toBe(before.length - 10);
    expect(deployment.filter((entry) => entry.enabled).map((entry) => entry.name)).toEqual(["Front end"]);
    expect(deployment.find((entry) => entry.name === "Host")?.line).toBe("Not available yet");
    const after = addEntries({ deploymentLive: () => true, onAddDeployment }).filter((entry) => entry.key.startsWith("deploy:"));
    expect(after.every((entry) => entry.enabled)).toBe(true);
    after.find((entry) => entry.name === "Channel")?.onSelect?.();
    expect(onAddDeployment).toHaveBeenCalledWith("channel");
  });

  it("is left out where the page gives no liveness (the dev pages, as before)", () => {
    expect(addEntries({}).some((entry) => entry.key.startsWith("deploy:"))).toBe(false);
  });
});

describe("the deployment window", () => {
  const AGENTS = [{ id: "a1", label: "2 · Assistant" }];
  const TWO = [{ id: "a1", label: "2 · Researcher" }, { id: "a2", label: "3 · Writer" }];
  const open = (kind: Parameters<typeof DeploymentDialog>[0]["kind"], agents = AGENTS) => {
    const onSave = vi.fn();
    render(<DeploymentDialog open onOpenChange={vi.fn()} kind={kind} agents={agents} onSave={onSave} />);
    return onSave;
  };
  const add = () => fireEvent.click(screen.getByRole("button", { name: "Add" }));

  it("adds a host for the build's one agent", () => {
    const onSave = open("host");
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Mac Mini" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Always on/ }));
    add();
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ agent: "a1", name: "Mac Mini", always_on: true }));
  });

  it("with two agents, asks which, and offers The whole build", () => {
    const onSave = open("channel", TWO);
    fireEvent.keyDown(screen.getByRole("button", { name: "For" }), { key: "Enter" });
    expect(screen.getByRole("menuitemradio", { name: "The whole build" })).toBeTruthy();
    fireEvent.click(screen.getByRole("menuitemradio", { name: "3 · Writer" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Provider" }), { target: { value: "Telegram" } });
    add();
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ agent: "a2", provider: "Telegram" }));
  });

  it("takes two or more agents for a relay, and refuses fewer", () => {
    const onSave = open("relay", TWO);
    expect(screen.getByRole("alert").textContent).toContain("two or more");
    fireEvent.click(screen.getByRole("checkbox", { name: "2 · Researcher" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "3 · Writer" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Network" }), { target: { value: "Tailscale" } });
    add();
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ joins: ["a1", "a2"], network: "Tailscale", agent: null }));
  });

  it("refuses an address pasted into a field", () => {
    open("inference_server");
    fireEvent.change(screen.getByRole("textbox", { name: "Provider" }), { target: { value: "http://192.168.1.4:11434" } });
    expect(screen.getByRole("alert").textContent).toBe("Never paste an address, a port or a key here.");
  });

  it("saves a memory's tagging and review days", () => {
    const onSave = open("memory");
    fireEvent.change(screen.getByRole("textbox", { name: "Provider" }), { target: { value: "Mem0" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Tagged by agent/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "Review after (days)" }), { target: { value: "90" } });
    add();
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ provider: "Mem0", tagged_by_agent: true, review_after_days: 90 }));
  });
});

describe("the List's Deployment section", () => {
  const tree = [
    node("a1", 0, "agent_config", {}),
    node("c1", 5, "channel", { provider: "Telegram", agent: "a1", made_in: "s1" }),
    node("h1", 6, "host", { machine: "mini PC", name: "Mac Mini", agent: "a1" }),
    node("k1", 7, "knowledge_base", { app: "Obsidian", agent: null }),
  ];
  const tiles = deploymentTilesOf(tree);

  it("is unnumbered, in order, with its meta line", () => {
    expect(deploymentSectionMeta(tiles)).toBe("Runs on Mac Mini · 3 parts");
    render(<DeploymentSection tiles={tiles} agents={[{ id: "a1", label: "1 · Assistant" }]} sessionNumber={() => 3} selectedId={null} phone={false} onOpen={vi.fn()} />);
    const section = screen.getByRole("region", { name: "Deployment" });
    expect(within(section).getAllByTestId("deployment-row").map((row) => row.getAttribute("data-tile-id"))).toEqual(["h1", "k1", "c1"]);
    expect(within(section).getByRole("button", { name: "Made in Session 3" })).toBeTruthy();
  });

  it("groups by agent when the build has more than one", () => {
    const groups = groupDeployment(tiles, [{ id: "a1", label: "1 · Assistant" }, { id: "a2", label: "2 · Writer" }]);
    expect(groups.map((group) => [group.label, group.tiles.map((tile) => tile.id)])).toEqual([["1 · Assistant", ["h1", "c1"]], ["The whole build", ["k1"]]]);
  });

  it("opens a tile from its row", () => {
    const onOpen = vi.fn();
    render(<DeploymentSection tiles={tiles} agents={[]} sessionNumber={() => null} selectedId={null} phone={false} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: "Host: Mac Mini" }));
    expect(onOpen).toHaveBeenCalledWith("h1");
  });
});

describe("moves", () => {
  it("refuse a deployment tile into a session and a session tile into Deployment", () => {
    expect(deploymentMoveRefusal({ type: "host", payload: {} }, "session")).toBe(DEPLOYMENT_MOVE_REFUSAL);
    expect(deploymentMoveRefusal({ type: "prompt", payload: {} }, "deployment")).toBe("Deployment parts stay in Deployment");
    expect(deploymentMoveRefusal({ type: "host", payload: {} }, "deployment")).toBeNull();
  });
});

describe("a paid partnership or vendor affiliation", () => {
  it("reads both kinds and says each line", () => {
    expect(partnershipOf({ partnership: { partner: "Example Partner", kind: "paid" } })).toEqual({ partner: "Example Partner", kind: "paid" });
    expect(partnershipLine({ partner: "Example Partner", kind: "paid" })).toBe("Paid partnership with Example Partner");
    expect(partnershipLine({ partner: "Example Co", kind: "works_for" })).toBe("Made by someone at Example Co");
    expect(partnershipOf({ partnership: { partner: "", kind: "paid" } })).toBeNull();
    expect(partnershipOf({})).toBeNull();
    expect(partnershipRefusal({ partner: "x".repeat(61), kind: "paid" })).toMatch(/60/);
  });
});
