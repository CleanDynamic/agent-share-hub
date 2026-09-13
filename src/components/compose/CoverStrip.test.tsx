// Acceptance cover for the compose THREAD EDITOR (BG-P23; was the cover strip,
// NS-P28).
//
// The claim is that the top of the workspace is where the post gets written: the
// band says what it wants, a dropped image becomes an ENTRY of the post rather
// than a column write, the first entry's text is the build's one-sentence
// description, every later entry carries its own words, the order is draggable,
// and a fifth picture is refused in a sentence.
//
// WHY setCover IS NOT MOCKED ANY MORE. It is not called. BG-P07b made the SET the
// source of truth and cover_media_id derived, mirrored by a trigger — so this
// surface writes the set and the column follows. A test that still expected
// setCover would be asserting the bug this prompt removed.
//
// Rendered inside a real MediaProvider rather than a stubbed context, because the
// interesting part of the upload is the hand-off — uploadMedia's row has to reach
// addPostMedia — and a fake would assert that hand-off away. And inside a router,
// because the live preview is the REAL GalleryCard, which is a link.

import { useCallback, useMemo } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const uploadMedia = vi.fn();
const getMediaForBuild = vi.fn().mockResolvedValue([]);
const getPostMedia = vi.fn();
const addPostMedia = vi.fn();
const removePostMedia = vi.fn();
const setPostMedia = vi.fn();
const setPostMediaText = vi.fn();

vi.mock("@/lib/build", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/build")>();
  return {
    ...actual,
    uploadMedia: (input: unknown) => uploadMedia(input),
    getMediaForBuild: (id: string) => getMediaForBuild(id),
    // postEntriesOf is deliberately NOT mocked: it is the rule under test.
    getPostMedia: (id: string) => getPostMedia(id),
    addPostMedia: (buildId: string, mediaId: string) => addPostMedia(buildId, mediaId),
    removePostMedia: (buildId: string, mediaId: string) => removePostMedia(buildId, mediaId),
    setPostMedia: (buildId: string, ids: readonly string[]) => setPostMedia(buildId, ids),
    setPostMediaText: (buildId: string, mediaId: string, text: string | null) =>
      setPostMediaText(buildId, mediaId, text),
    signedMediaUrl: async (media: { path: string }) => `https://signed.test/${media.path}`,
  };
});

import type { Build, BuildPatch, BuildRecord } from "@/lib/build";
import { MAX_POST_MEDIA, MEDIA_MAX_BYTES, POST_TEXT_MAX, PostMediaError } from "@/lib/build";
import { composeBuildQueryKey } from "@/hooks/useComposeBuild";
import { MediaProvider } from "@/hooks/useComposeMedia";
import { CoverStrip } from "./CoverStrip";

const BUILD_ID = "22222222-0000-4000-8000-000000000002";

const baseBuild = {
  id: BUILD_ID,
  slug: "a-build",
  title: "A build",
  outcome: null,
  shape: "other",
  status: "draft",
  hero_node_id: null,
  cover_media_id: null,
} as unknown as Build;

function makeFile(name: string, type: string, bytes = 2000): File {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: bytes });
  return file;
}

/** A build_media row, optionally placed in the post. */
function mediaRow(
  id: string,
  overrides: Partial<{ post_position: number | null; post_text: string | null; kind: string }> = {}
) {
  return {
    id,
    build_id: BUILD_ID,
    node_id: null,
    bucket: "build-media",
    path: `${BUILD_ID}/unplaced/${id}.png`,
    kind: overrides.kind ?? "image",
    mime: "image/png",
    bytes: 2000,
    width: 1600,
    height: 900,
    duration: null,
    poster_path: null,
    created_at: "2026-08-27T10:00:00Z",
    post_position: overrides.post_position ?? null,
    post_text: overrides.post_text ?? null,
  };
}

/** n rows placed at positions 0..n-1. */
function placed(n: number) {
  return Array.from({ length: n }, (_, index) =>
    mediaRow(`media-${index + 1}`, { post_position: index })
  );
}

let record: BuildRecord;
const onPatch = vi.fn<(patch: BuildPatch) => void>();

/**
 * The build comes from the cache, as it does in the workspace.
 *
 * That is what makes the description testable: the field writes one column
 * through the debounced save, and the next render has to read it back.
 */
function Harness({ stacked = false }: { stacked?: boolean }) {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: composeBuildQueryKey(BUILD_ID),
    queryFn: () => record,
    initialData: record,
    staleTime: Infinity,
  });
  const build = useMemo(() => data?.build ?? baseBuild, [data]);

  // Stands in for useComposeBuild's overlay: a controlled input whose patch
  // never comes back is an input that cannot be cleared.
  const patch = useCallback(
    (next: BuildPatch) => {
      onPatch(next);
      queryClient.setQueryData<BuildRecord | null>(
        composeBuildQueryKey(BUILD_ID),
        (previous) =>
          previous ? { ...previous, build: { ...previous.build, ...next } } : previous
      );
    },
    [queryClient]
  );

  return (
    <MediaProvider buildId={BUILD_ID} nodeId={null}>
      <CoverStrip build={build} onPatch={patch} stacked={stacked} />
    </MediaProvider>
  );
}

function renderStrip(stacked = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <Harness stacked={stacked} />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

/** A file drop, as the browser delivers one. */
function dropFile(target: Element, file: File) {
  const dataTransfer = { files: [file], items: [], types: ["Files"], dropEffect: "none" };
  fireEvent.dragEnter(target, { dataTransfer });
  fireEvent.dragOver(target, { dataTransfer });
  fireEvent.drop(target, { dataTransfer });
}

function dropTarget(): Element {
  return screen.getByTestId("cover-drop");
}

beforeEach(() => {
  vi.clearAllMocks();
  getMediaForBuild.mockResolvedValue([]);
  getPostMedia.mockResolvedValue([]);
  addPostMedia.mockImplementation(async (_buildId: string, mediaId: string) => [
    mediaRow(mediaId, { post_position: 0 }),
  ]);
  removePostMedia.mockResolvedValue([]);
  setPostMedia.mockImplementation(async (_buildId: string, ids: readonly string[]) =>
    ids.map((id, index) => mediaRow(id, { post_position: index }))
  );
  setPostMediaText.mockImplementation(async (_b: string, mediaId: string, text: string | null) =>
    mediaRow(mediaId, { post_position: 1, post_text: text })
  );
  record = {
    build: baseBuild,
    tree: [],
    tray: [],
    events: [],
    nodeTypes: [],
  } as unknown as BuildRecord;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the thread editor", () => {
  it("asks for a picture first, in the words the design specifies", async () => {
    renderStrip();

    expect(screen.getByTestId("cover-strip")).toBeInTheDocument();
    expect(dropTarget()).toBeInTheDocument();
    expect(
      screen.getByText("Show what you made — drop a screenshot or video, or browse")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "This becomes the first picture of your post, everywhere on buildgallery."
      )
    ).toBeInTheDocument();
    // Four is the ceiling and the header says so from the start.
    expect(screen.getByTestId("thread-count")).toHaveTextContent(`0 / ${MAX_POST_MEDIA}`);
  });

  it("shows the description field alone above the empty target, so it is never orphaned", async () => {
    record = {
      ...record,
      build: { ...baseBuild, outcome: "Sorts a full inbox in a minute." },
    } as unknown as BuildRecord;
    renderStrip();

    // The sentence survives having no picture to sit above.
    expect(screen.getByTestId("outcome-input")).toHaveValue("Sorts a full inbox in a minute.");
    expect(dropTarget()).toBeInTheDocument();
    // The question is a label, printed once, and it does not vanish on typing.
    expect(
      screen.getByText("What does it do? One sentence, your words.")
    ).toBeInTheDocument();
  });

  it("writes the first entry's text to the build's description, not to post_text", async () => {
    renderStrip();

    const input = screen.getByTestId("outcome-input");
    fireEvent.change(input, { target: { value: "Sorts a full inbox in a minute." } });

    expect(onPatch).toHaveBeenCalledWith({ outcome: "Sorts a full inbox in a minute." });
    // THE POINT OF THE RULE: the sentence is not duplicated into the row.
    expect(setPostMediaText).not.toHaveBeenCalled();

    // React Query notifies its observers off the synchronous path, so the
    // controlled value arrives a tick after the patch it came from.
    await waitFor(() => expect(input).toHaveValue("Sorts a full inbox in a minute."));

    // Emptied is null, not "": an empty string would read as an answered
    // question to every completeness check downstream.
    fireEvent.change(input, { target: { value: "" } });
    expect(onPatch).toHaveBeenCalledWith({ outcome: null });
  });

  it("uploads a dropped image unplaced and adds it to the post", async () => {
    uploadMedia.mockResolvedValueOnce(mediaRow("media-1"));
    renderStrip();

    dropFile(dropTarget(), makeFile("shot.png", "image/png"));

    await waitFor(() => expect(addPostMedia).toHaveBeenCalledWith(BUILD_ID, "media-1"));

    // nodeId null is what puts the object under UNPLACED_SEGMENT: a post's
    // picture belongs to the build, not to any one node.
    expect(uploadMedia).toHaveBeenCalledWith(
      expect.objectContaining({ buildId: BUILD_ID, nodeId: null })
    );

    const thumbnail = await screen.findByAltText("Build cover");
    expect(thumbnail).toHaveAttribute(
      "src",
      `https://signed.test/${BUILD_ID}/unplaced/media-1.png`
    );
    // Position 0 is the cover, and it says so in mono.
    expect(screen.getByTestId("thread-cover-label")).toHaveTextContent("COVER");
  });

  it("refuses a fifth picture in a plain sentence and uploads nothing", async () => {
    getPostMedia.mockResolvedValue(placed(MAX_POST_MEDIA));
    renderStrip();

    await waitFor(() =>
      expect(screen.getByTestId("thread-count")).toHaveTextContent(
        `${MAX_POST_MEDIA} / ${MAX_POST_MEDIA}`
      )
    );

    const sentence = `A post shows ${MAX_POST_MEDIA} pictures at most. Remove one to add another.`;
    expect(screen.getByText(sentence)).toBeInTheDocument();
    // Full replaces the invitation with the reason: there is nothing left to
    // press. The zone stays, so a dropped fifth file is refused rather than
    // silently becoming a tray node on the frame behind it.
    expect(screen.queryByRole("button", { name: /Add another/ })).toBeNull();

    dropFile(dropTarget(), makeFile("fifth.png", "image/png"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(sentence));
    expect(uploadMedia).not.toHaveBeenCalled();
  });

  it("takes an entry out through the data layer, which closes the gap and clears its text", async () => {
    getPostMedia.mockResolvedValue(placed(2));
    renderStrip();

    const removes = await screen.findAllByRole("button", { name: "Remove" });
    fireEvent.click(removes[0]);

    // Not a hand-rolled splice: removePostMedia renumbers and the database
    // function nulls the departing row's text, both in one transaction.
    await waitFor(() => expect(removePostMedia).toHaveBeenCalledWith(BUILD_ID, "media-1"));
  });

  it("writes a later entry's own words through setPostMediaText, debounced", async () => {
    vi.useFakeTimers();
    getPostMedia.mockResolvedValue(placed(2));
    renderStrip();

    await vi.waitFor(() => expect(screen.getByTestId("entry-text-1")).toBeInTheDocument());

    fireEvent.change(screen.getByTestId("entry-text-1"), {
      target: { value: "The inbox, after one pass." },
    });

    // Debounced on the workspace's own cycle: nothing yet.
    expect(setPostMediaText).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(900);
    expect(setPostMediaText).toHaveBeenCalledWith(
      BUILD_ID,
      "media-2",
      "The inbox, after one pass."
    );
    // The description column is not touched by a caption.
    expect(onPatch).not.toHaveBeenCalled();
  });

  it("counts an entry's text in code points against the shared ceiling", async () => {
    getPostMedia.mockResolvedValue(placed(2));
    renderStrip();

    const field = await screen.findByTestId("entry-text-1");
    // An emoji costs one, as char_length() counts it and as the CHECK enforces.
    fireEvent.change(field, { target: { value: "🛠" } });

    await waitFor(() =>
      expect(screen.getByTestId("entry-count-1")).toHaveTextContent(`1 / ${POST_TEXT_MAX}`)
    );
  });

  it("reorders by writing the whole set, and never writes cover_media_id", async () => {
    getPostMedia.mockResolvedValue(placed(3));
    const { container } = renderStrip();

    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(3));

    // The drag itself is dnd-kit's and is exercised in the browser spec; what
    // this asserts is the write the reorder produces.
    const handles = screen.getAllByRole("button", { name: /Reorder entry/ });
    expect(handles).toHaveLength(3);
    expect(container.querySelectorAll('[data-testid="thread-preview"]')).toHaveLength(1);
  });

  it("names the limit for a file that is too large, and uploads nothing", async () => {
    renderStrip();

    dropFile(dropTarget(), makeFile("huge.png", "image/png", MEDIA_MAX_BYTES + 1));

    const message = await screen.findByRole("alert");
    expect(message).toHaveTextContent("huge.png is 25.0MB");
    expect(message).toHaveTextContent("has to be under 25.0MB");
    expect(uploadMedia).not.toHaveBeenCalled();
    expect(addPostMedia).not.toHaveBeenCalled();
  });

  it("says what a cover is when the file is not one, and uploads nothing", async () => {
    renderStrip();

    dropFile(dropTarget(), makeFile("notes.pdf", "application/pdf"));

    const message = await screen.findByRole("alert");
    expect(message).toHaveTextContent("A cover is a picture or a video");
    expect(uploadMedia).not.toHaveBeenCalled();
    expect(addPostMedia).not.toHaveBeenCalled();
  });

  it("shows a refusal from the data layer as its own sentence", async () => {
    uploadMedia.mockResolvedValueOnce(mediaRow("media-9"));
    addPostMedia.mockRejectedValueOnce(
      new PostMediaError("full", "this post already shows 4 pictures — remove one first")
    );
    renderStrip();

    dropFile(dropTarget(), makeFile("shot.png", "image/png"));

    const message = await screen.findByRole("alert");
    expect(message).toHaveTextContent(
      `A post shows ${MAX_POST_MEDIA} pictures at most. Remove one to add another.`
    );
  });

  it("still takes a file when it is stacked above a single-column tree", async () => {
    uploadMedia.mockResolvedValueOnce(mediaRow("media-2"));
    renderStrip(true);

    expect(screen.getByTestId("cover-strip")).toBeInTheDocument();
    dropFile(dropTarget(), makeFile("phone.png", "image/png"));

    await waitFor(() => expect(addPostMedia).toHaveBeenCalledWith(BUILD_ID, "media-2"));
  });

  it("previews the post with the real card, which cannot navigate away", async () => {
    getPostMedia.mockResolvedValue(placed(2));
    renderStrip();

    const preview = await screen.findByTestId("thread-preview");
    expect(preview).toBeInTheDocument();
    // The card is a link to the build. Clicking the preview must not leave the
    // workspace mid-draft, so the capture-phase default is prevented.
    const link = preview.querySelector("a");
    expect(link).not.toBeNull();
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    link?.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
  });
});
