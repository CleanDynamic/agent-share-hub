import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { SiteHeaderView, type SiteHeaderViewProps } from "./SiteHeader";
vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("min-width"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
const viewer = { id: "u1", name: "Maya Okafor", handle: "maya" };
function header(props: Partial<SiteHeaderViewProps> = {}) {
 const base: SiteHeaderViewProps = { current: "gallery", unread: 3, viewer, theme: "dusk", onToggleTheme: vi.fn(), onSignIn: vi.fn(), onSignOut: vi.fn(), onNewBuild: vi.fn(), ...props };
 render(<MemoryRouter><SiteHeaderView {...base} /></MemoryRouter>); return base;
}
describe("TB-01 desktop header", () => {
 it("offers the approved five global links, with Builds current", () => {
  header(); const links = within(screen.getByRole("navigation", { name: "Primary" })).getAllByRole("link");
  expect(links.map(a => a.getAttribute("href"))).toEqual(["/drafts", "/library", "/builds", "/openbuilds", "/connect"]);
  expect(links.filter(a => a.getAttribute("aria-current") === "page").map(a => a.getAttribute("href"))).toEqual(["/builds"]);
 });
 it("omits private links signed out and keeps sign-in and theme", () => {
  const p=header({viewer:null}); expect(screen.queryByRole("link", {name:"Drafts"})).toBeNull(); expect(screen.queryByRole("link", {name:"Library"})).toBeNull(); expect(screen.queryByRole("link", {name:/Activity/})).toBeNull();
  fireEvent.click(screen.getByRole("button", {name:"Sign in"})); expect(p.onSignIn).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", {name:"Theme: Dark"})); expect(p.onToggleTheme).toHaveBeenCalledOnce();
 });
 it("keeps the unread count in the accessible name", () => {
  header({unread:12}); expect(screen.getByRole("link", {name:"Activity, 12 unread"}).getAttribute("href")).toBe("/notifications");
 });
 it("opens Create and uses the existing New build handler", async () => {
  const p=header(); fireEvent.click(screen.getByRole("button", {name:"Create new…"}));
  fireEvent.click(await screen.findByRole("menuitem", {name:"New build"})); expect(p.onNewBuild).toHaveBeenCalledOnce();
 });
 it("requires sign-in for Create when signed out", async () => {
  const p=header({viewer:null}); fireEvent.click(screen.getByRole("button", {name:"Create new…"}));
  fireEvent.click(await screen.findByRole("menuitem", {name:"New build"})); expect(p.onSignIn).toHaveBeenCalledOnce(); expect(p.onNewBuild).not.toHaveBeenCalled();
 });
});
