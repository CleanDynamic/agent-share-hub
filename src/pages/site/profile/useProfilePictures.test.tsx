// UX-10 P3: the picture flow: choose, upload, crop, Save; Back writes nothing; recrop uploads nothing.

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useProfilePictures, type PictureWriters, type ProfilePictures } from "./useProfilePictures";

afterEach(() => cleanup());

function writers(): PictureWriters & { [K in keyof PictureWriters]: ReturnType<typeof vi.fn> } {
  return {
    upload: vi.fn(async (_file: File, _which: string, onPercent: (n: number) => void) => {
      onPercent(100);
      return { url: "https://cdn.test/new.jpg", width: 1200, height: 800 };
    }),
    save: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
    size: vi.fn(async () => ({ width: 1200, height: 800 })),
  } as never;
}

let api: ProfilePictures;
function Harness({ w, onSaved }: { w: PictureWriters; onSaved: () => void }) {
  api = useProfilePictures({ onSaved, writers: w });
  return <>{api.element}</>;
}

const choose = async (name = "me.jpg", type = "image/jpeg") => {
  const input = screen.getByTestId("profile-picture-input") as HTMLInputElement;
  await act(async () => {
    fireEvent.change(input, { target: { files: [new File(["x"], name, { type })] } });
  });
};

describe("the picture flow", () => {
  it("uploads the chosen file, opens the dialog on it, and Save writes the picture", async () => {
    const w = writers();
    const onSaved = vi.fn();
    render(<Harness w={w} onSaved={onSaved} />);
    act(() => api.change("avatar"));
    await choose();
    expect(w.upload).toHaveBeenCalledTimes(1);
    const dialog = await screen.findByTestId("edit-media-dialog");
    expect(within(dialog).getByText("Only shape for a profile picture")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(w.save).toHaveBeenCalledWith("avatar", { url: "https://cdn.test/new.jpg", crop: null, alt: "" });
  });

  it("Back without saving writes nothing and deletes nothing", async () => {
    const w = writers();
    render(<Harness w={w} onSaved={vi.fn()} />);
    act(() => api.change("banner"));
    await choose();
    const dialog = await screen.findByTestId("edit-media-dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Back without saving" }));
    await waitFor(() => expect(screen.queryByTestId("edit-media-dialog")).toBeNull());
    expect(w.save).not.toHaveBeenCalled();
    expect(w.remove).not.toHaveBeenCalled();
  });

  it("recrop opens the dialog on the stored picture and uploads nothing", async () => {
    const w = writers();
    render(<Harness w={w} onSaved={vi.fn()} />);
    await act(async () => api.recrop("banner", { url: "https://cdn.test/h.jpg", crop: { x: 0, y: 0.3, w: 1, h: 0.375 }, alt: "Desk" }));
    const dialog = await screen.findByTestId("edit-media-dialog");
    expect(within(dialog).getByText("Only shape for a header")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(w.save).toHaveBeenCalled());
    expect(w.upload).not.toHaveBeenCalled();
    expect(w.save).toHaveBeenCalledWith("banner", { url: "https://cdn.test/h.jpg", crop: { x: 0, y: 0.3, w: 1, h: 0.375 }, alt: "Desk" });
  });

  it("a refused file costs no upload", async () => {
    const w = writers();
    render(<Harness w={w} onSaved={vi.fn()} />);
    act(() => api.change("avatar"));
    await choose("clip.mp4", "video/mp4");
    expect(w.upload).not.toHaveBeenCalled();
    expect(screen.queryByTestId("edit-media-dialog")).toBeNull();
  });
});
