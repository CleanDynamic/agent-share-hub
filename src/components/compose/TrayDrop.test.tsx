// Acceptance cover for the tray drop path (NS-P12 part four).
//
// A file dropped on the workspace — anywhere that is not a media field —
// becomes an unplaced node: uploaded, typed by its mime, and left in the tray
// for the creator to place. This is the intake pressure valve, working before
// the transcript parser (NS-P13) and the intake surface (NS-P14) exist.
//
// The dnd-kit context is replaced rather than driven: node drags are pointer
// events with no bearing on a file dropped from the desktop, and what is being
// tested here is the HTML5 drop path that runs beside them.

import { useMemo } from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DragOverlay: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  KeyboardSensor: class {},
  PointerSensor: class {},
  pointerWithin: () => [],
  rectIntersection: () => [],
  useSensor: () => ({}),
  useSensors: () => [],
  useDroppable: () => ({ setNodeRef: () => {}, isOver: false }),
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    isDragging: false,
  }),
}));

const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: (...args: unknown[]) => toastError(...args), success: vi.fn() }),
}));

const uploadMedia = vi.fn();
const upsertNode = vi.fn();
const deleteMedia = vi.fn().mockResolvedValue(undefined);
const getMediaForBuild = vi.fn().mockResolvedValue([]);

vi.mock("@/lib/build", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/build")>();
  return {
    ...actual,
    uploadMedia: (input: unknown) => uploadMedia(input),
    upsertNode: (node: unknown) => upsertNode(node),
    deleteMedia: (id: string) => deleteMedia(id),
    getMediaForBuild: (id: string) => getMediaForBuild(id),
    signedMediaUrl: async (media: { path: string }) => `https://signed.test/${media.path}`,
  };
});

import type { Build, BuildNode, BuildRecord, NodeType } from "@/lib/build";
import type { ComposeBuild } from "@/hooks/useComposeBuild";
import { composeBuildQueryKey } from "@/hooks/useComposeBuild";
import { ComposeFrame } from "./ComposeFrame";

const BUILD_ID = "11111111-0000-4000-8000-000000000001";

const SCREENSHOT_TYPE = {
  key: "screenshot",
  label: "Screenshot",
  category: "evidence",
  colour: "#2EC4B6",
  icon: "Camera",
  renderer: "evidence",
  copyable: false,
  is_active: true,
  sort: 4,
  schema: {
    fields: [
      { key: "media_id", label: "Media", type: "string", format: "media_id", required: true },
      { key: "caption", label: "Caption", type: "string" },
    ],
  },
} as unknown as NodeType;

const build = {
  id: BUILD_ID,
  slug: "a-build",
  title: "A build",
  shape: "other",
  hero_node_id: null,
} as unknown as Build;

function makeNode(id: string, payload: Record<string, unknown> = {}): BuildNode {
  return {
    id,
    build_id: BUILD_ID,
    parent_id: null,
    position: 0,
    type: "screenshot",
    title: "A placed shot",
    note: null,
    payload,
    source_ref: null,
    event_id: null,
    is_gap: false,
    created_at: "2026-08-23T09:00:00Z",
  } as unknown as BuildNode;
}

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
    width: 800,
    height: 600,
    duration: null,
    poster_path: null,
    created_at: "2026-08-23T10:00:00Z",
  };
}

/** Stands in for useComposeBuild: the tray comes from the cache, as it does
 *  in the workspace, so an optimistic insert shows up in the left panel. */
function Harness({ selectedNodeId = null }: { selectedNodeId?: string | null }) {
  const { data } = useQuery({
    queryKey: composeBuildQueryKey(BUILD_ID),
    queryFn: () => record,
    initialData: record,
    staleTime: Infinity,
  });

  const compose = useMemo(
    () =>
      ({
        build,
        tree: data?.tree ?? [],
        tray: data?.tray ?? [],
        events: [],
        nodeTypes: data?.nodeTypes ?? [],
        completeness: null,
        selectedNodeId,
        setSelectedNodeId: () => {},
        patchBuild: () => {},
        isSaving: false,
        lastSavedAt: null,
        isLoading: false,
        isOwner: true,
        loadError: null,
        saveError: null,
      }) as ComposeBuild,
    [data, selectedNodeId]
  );

  return <ComposeFrame build={build} compose={compose} />;
}

let record: BuildRecord;

function renderWorkspace(selectedNodeId: string | null = null) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <TooltipProvider>
          <Harness selectedNodeId={selectedNodeId} />
        </TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

/** A file drop, as the browser delivers one. */
function dropFiles(target: Element, files: File[]) {
  const dataTransfer = { files, items: [], types: ["Files"], dropEffect: "none" };
  fireEvent.dragEnter(target, { dataTransfer });
  fireEvent.dragOver(target, { dataTransfer });
  fireEvent.drop(target, { dataTransfer });
}

function frame(): Element {
  const element = document.querySelector('[data-visual-slot="compose-frame"]');
  if (!element) throw new Error("the workspace frame did not render");
  return element;
}

beforeEach(() => {
  vi.clearAllMocks();
  getMediaForBuild.mockResolvedValue([]);
  record = {
    build,
    tree: [{ ...makeNode("node-1"), children: [] }],
    tray: [],
    events: [],
    nodeTypes: [SCREENSHOT_TYPE],
  } as unknown as BuildRecord;
});

describe("a file dropped on the workspace", () => {
  it("uploads it unplaced and leaves a screenshot node in the tray", async () => {
    uploadMedia.mockResolvedValueOnce(mediaRow("media-1"));
    upsertNode.mockImplementation(async (node: Record<string, unknown>) => ({
      ...makeNode("node-tray"),
      ...node,
      id: "node-tray",
      position: null,
      created_at: "2026-08-23T11:00:00Z",
    }));

    renderWorkspace();
    dropFiles(frame(), [makeFile("shot.png", "image/png")]);

    await waitFor(() => expect(upsertNode).toHaveBeenCalledTimes(1));

    // Uploaded against no node: it is not attached to anything yet.
    expect(uploadMedia.mock.calls[0][0]).toMatchObject({ buildId: BUILD_ID, nodeId: null });

    const written = upsertNode.mock.calls[0][0] as Record<string, unknown>;
    expect(written.type).toBe("screenshot");
    expect(written.payload).toEqual({ media_id: "media-1" });
    expect(written.title).toBe("shot.png");
    // position IS NULL is what makes it a tray node, so it must not be set.
    expect(written.position).toBeUndefined();

    // And it is in the left panel, which is the point of the whole path.
    expect(await screen.findByText("shot.png")).toBeInTheDocument();
  });

  it("types a dropped video as a recording rather than a screenshot", async () => {
    uploadMedia.mockResolvedValueOnce(mediaRow("media-2", "video", "video/mp4"));
    upsertNode.mockResolvedValueOnce({ ...makeNode("node-tray-2"), position: null });

    renderWorkspace();
    dropFiles(frame(), [makeFile("demo.mp4", "video/mp4")]);

    await waitFor(() => expect(upsertNode).toHaveBeenCalledTimes(1));
    expect((upsertNode.mock.calls[0][0] as Record<string, unknown>).type).toBe("recording");
  });

  it("refuses a 30MB file and a type it does not take, without uploading either", async () => {
    renderWorkspace();
    dropFiles(frame(), [
      makeFile("huge.png", "image/png", 30 * 1024 * 1024),
      makeFile("rows.zip", "application/zip"),
    ]);

    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(2));
    expect(uploadMedia).not.toHaveBeenCalled();
    expect(upsertNode).not.toHaveBeenCalled();
    expect(String(toastError.mock.calls[0][0])).toMatch(/30\.0MB/);
    expect(String(toastError.mock.calls[1][0])).toMatch(/mp4/);
  });

  it("takes no tray node when the drop landed on a media field", async () => {
    uploadMedia.mockResolvedValueOnce(mediaRow("media-3"));

    renderWorkspace("node-1");
    const field = document.querySelector('[data-visual-slot="media-field"]');
    expect(field).toBeTruthy();

    dropFiles(field as Element, [makeFile("shot.png", "image/png")]);

    await waitFor(() => expect(uploadMedia).toHaveBeenCalledTimes(1));
    // The field's own drop handled it: attached to the node being edited, and
    // no unplaced node created behind it.
    expect(uploadMedia.mock.calls[0][0]).toMatchObject({ nodeId: "node-1" });
    expect(upsertNode).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "screenshot", payload: { media_id: "media-3" } })
    );
  });
});
