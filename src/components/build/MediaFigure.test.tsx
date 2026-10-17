// TF-10 — a clip or a track the page shows and never offers to save.

import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/build", async (original) => ({
  ...(await original<typeof import("@/lib/build")>()),
  signedMediaUrl: async () => "https://files.test/signed",
  mediaUrl: () => "https://files.test/plain",
}));

import { MediaFigure } from "./MediaFigure";

const row = (kind: "video" | "audio" | "image") =>
  ({ id: "m1", bucket: "build-media", path: `b/x.${kind}`, kind, poster_path: null, width: 100, height: 100, mime: null, bytes: 1 }) as never;

const show = (kind: "video" | "audio" | "image", noDownload?: boolean) =>
  render(<MediaFigure reference="m1" resolveMedia={() => row(kind)} width={640} alt="hero" noDownload={noDownload} />);

describe("MediaFigure noDownload", () => {
  it("a clip gets controlsList nodownload and no picture-in-picture", async () => {
    const { container } = show("video", true);
    await vi.waitFor(() => expect(container.querySelector("video")).not.toBeNull());
    const video = container.querySelector("video") as HTMLVideoElement;
    expect(video.getAttribute("controlslist")).toBe("nodownload");
    expect(video.hasAttribute("disablepictureinpicture")).toBe(true);
    expect(video.hasAttribute("controls")).toBe(true);
  });

  it("a track gets controlsList nodownload", async () => {
    const { container } = show("audio", true);
    await vi.waitFor(() => expect(container.querySelector("audio")).not.toBeNull());
    expect((container.querySelector("audio") as HTMLAudioElement).getAttribute("controlslist")).toBe("nodownload");
  });

  it("is off unless asked for, so every other slot is as it was", async () => {
    const clip = show("video");
    await vi.waitFor(() => expect(clip.container.querySelector("video")).not.toBeNull());
    expect(clip.container.querySelector("video")?.hasAttribute("controlslist")).toBe(false);
    expect(clip.container.querySelector("video")?.hasAttribute("disablepictureinpicture")).toBe(false);
    const track = show("audio");
    await vi.waitFor(() => expect(track.container.querySelector("audio")).not.toBeNull());
    expect(track.container.querySelector("audio")?.hasAttribute("controlslist")).toBe(false);
  });
});
