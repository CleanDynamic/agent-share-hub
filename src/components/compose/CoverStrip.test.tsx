// Acceptance cover for the compose cover strip (NS-P28).
//
// The claim is that the top of the workspace asks for a picture first and takes
// one: the band says what it wants, a dropped image becomes builds.cover_media_id,
// Remove puts the column back to null, and the sentence beside it is
// builds.outcome written through the same debounced save the title uses.
//
// Rendered inside a real MediaProvider rather than a stubbed context, because
// the interesting part of the upload is the hand-off — uploadMedia's row has to
// land in the workspace's media cache for the thumbnail to resolve at all, and
// a fake resolveMedia would assert that hand-off away.

import { useCallback, useMemo } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const uploadMedia = vi.fn();
const setCover = vi.fn();
const getMediaForBuild = vi.fn().mockResolvedValue([]);

vi.mock("@/lib/build", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/build")>();
  return {
    ...actual,
    uploadMedia: (input: unknown) => uploadMedia(input),
    setCover: (buildId: string, mediaId: string | null) => setCover(buildId, mediaId),
    getMediaForBuild: (id: string) => getMediaForBuild(id),
    signedMediaUrl: async (media: { path: string }) => `https://signed.test/${media.path}`,
  };
});

import type { Build, BuildPatch, BuildRecord } from "@/lib/build";
import { MEDIA_MAX_BYTES } from "@/lib/build";
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
  hero_node_id: null,
  cover_media_id: null,
} as unknown as Build;

function makeFile(name: string, type: string, bytes = 2000): File {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: bytes });
  return file;
}

function mediaRow(id: string, kind = "image", mime = "image/png") {
  return {
    id,
    build_id: BUILD_ID,
    node_id: null,
    bucket: "build-media",
    path: `${BUILD_ID}/unplaced/${id}.png`,
    kind,
    mime,
    bytes: 2000,
    width: 1600,
    height: 900,
    duration: null,
    poster_path: null,
    created_at: "2026-08-27T10:00:00Z",
  };
}

let record: BuildRecord;
const onPatch = vi.fn<(patch: BuildPatch) => void>();

/**
 * The build comes from the cache, as it does in the workspace.
 *
 * That is what makes Remove testable: the strip writes one column back into
 * this record, and the next render has to read it.
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
  // never comes back is an input that cannot be cleared, and clearing it is
  // half of what this file has to prove.
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
    <QueryClientProvider client={client}>
      <Harness stacked={stacked} />
    </QueryClientProvider>
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
  setCover.mockImplementation(async (id: string, mediaId: string | null) => ({
    ...baseBuild,
    id,
    cover_media_id: mediaId,
  }));
  record = {
    build: baseBuild,
    tree: [],
    tray: [],
    events: [],
    nodeTypes: [],
  } as unknown as BuildRecord;
});

describe("the cover strip", () => {
  it("asks for a picture first, in the words the design specifies", () => {
    renderStrip();

    expect(screen.getByTestId("cover-strip")).toBeInTheDocument();
    expect(dropTarget()).toBeInTheDocument();
    expect(
      screen.getByText("Show what you made — drop a screenshot or video, or browse")
    ).toBeInTheDocument();
    expect(
      screen.getByText("This becomes your post's picture everywhere on NeoScale.")
    ).toBeInTheDocument();
  });

  it("uploads a dropped image unplaced and points the build's cover at it", async () => {
    uploadMedia.mockResolvedValueOnce(mediaRow("media-1"));
    renderStrip();

    dropFile(dropTarget(), makeFile("shot.png", "image/png"));

    await waitFor(() => expect(setCover).toHaveBeenCalledWith(BUILD_ID, "media-1"));

    // nodeId null is what puts the object under UNPLACED_SEGMENT: a cover
    // belongs to the build, not to any one node.
    expect(uploadMedia).toHaveBeenCalledWith(
      expect.objectContaining({ buildId: BUILD_ID, nodeId: null })
    );

    const thumbnail = await screen.findByAltText("Build cover");
    expect(thumbnail).toHaveAttribute(
      "src",
      `https://signed.test/${BUILD_ID}/unplaced/media-1.png`
    );
  });

  it("clears the column on Remove, and the empty band comes back", async () => {
    uploadMedia.mockResolvedValueOnce(mediaRow("media-1"));
    renderStrip();

    dropFile(dropTarget(), makeFile("shot.png", "image/png"));
    await screen.findByAltText("Build cover");

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(setCover).toHaveBeenCalledWith(BUILD_ID, null));
    await waitFor(() =>
      expect(
        screen.getByText("Show what you made — drop a screenshot or video, or browse")
      ).toBeInTheDocument()
    );
    expect(screen.queryByAltText("Build cover")).toBeNull();
  });

  it("names the limit for a file that is too large, and uploads nothing", async () => {
    renderStrip();

    dropFile(dropTarget(), makeFile("huge.png", "image/png", MEDIA_MAX_BYTES + 1));

    const message = await screen.findByRole("alert");
    expect(message).toHaveTextContent("huge.png is 25.0MB");
    expect(message).toHaveTextContent("has to be under 25.0MB");
    expect(uploadMedia).not.toHaveBeenCalled();
    expect(setCover).not.toHaveBeenCalled();
  });

  it("says what a cover is when the file is not one, and uploads nothing", async () => {
    renderStrip();

    dropFile(dropTarget(), makeFile("notes.pdf", "application/pdf"));

    const message = await screen.findByRole("alert");
    expect(message).toHaveTextContent("A cover is a picture or a video");
    expect(uploadMedia).not.toHaveBeenCalled();
    expect(setCover).not.toHaveBeenCalled();
  });

  it("writes the description to builds.outcome through the workspace's save", async () => {
    renderStrip();

    const input = screen.getByTestId("outcome-input");
    expect(input).toHaveAttribute(
      "placeholder",
      "What does it do? One sentence, your words."
    );
    // The column keeps its name; the word a creator reads is Description.
    expect(screen.getByText("Description")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "Sorts a full inbox in a minute." } });
    expect(onPatch).toHaveBeenCalledWith({ outcome: "Sorts a full inbox in a minute." });
    // React Query notifies its observers off the synchronous path, so the
    // controlled value arrives a tick after the patch it came from.
    await waitFor(() => expect(input).toHaveValue("Sorts a full inbox in a minute."));

    // Emptied is null, not "": an empty string would read as an answered
    // question to every completeness check downstream.
    fireEvent.change(input, { target: { value: "" } });
    expect(onPatch).toHaveBeenCalledWith({ outcome: null });
  });

  it("still takes a file when it is stacked above a single-column tree", async () => {
    uploadMedia.mockResolvedValueOnce(mediaRow("media-2"));
    renderStrip(true);

    expect(screen.getByTestId("cover-strip")).toBeInTheDocument();
    dropFile(dropTarget(), makeFile("phone.png", "image/png"));

    await waitFor(() => expect(setCover).toHaveBeenCalledWith(BUILD_ID, "media-2"));
  });
});
