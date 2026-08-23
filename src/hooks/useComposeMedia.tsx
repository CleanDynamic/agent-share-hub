// The compose workspace's media: one query for what the build holds, and the
// three writes the workspace makes against it.
//
// WHY A CONTEXT
// The upload control is a FIELD WIDGET. It is reached through the registry —
// node_types.schema declares a string field with format media_id, resolveWidget
// maps that to MediaRefField, and SchemaForm renders it — and every widget in
// that path receives exactly the same props: a field definition, a value and an
// onChange. An upload needs two things that are not in those props, the build
// id and the node the panel is showing, and threading them through would mean
// changing the widget contract for all six base widgets to serve one of them.
// So they arrive by context instead, mounted once at the workspace frame, and
// SchemaForm, resolveWidget and the Inspector stay exactly as NS-P09 and NS-P10
// left them.
//
// Everything here goes through src/lib/build/. Nothing in this file — and
// nothing in the widget below it — touches supabase.storage directly.

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  MEDIA_MAX_BYTES,
  acceptedMediaTypes,
  deleteMedia,
  getMediaForBuild,
  mediaKindFor,
  uploadMedia,
  upsertNode,
  type BuildMedia,
  type BuildNode,
  type BuildRecord,
  type MediaKind,
} from "@/lib/build";
import { composeBuildQueryKey } from "./useComposeBuild";

/** The same key BuildPage reads, so both surfaces share one cached list. */
export function buildMediaQueryKey(buildId: string | undefined) {
  return ["build-media", buildId] as const;
}

/**
 * What a media field takes.
 *
 * The lib layer accepts documents too — a CSV on a dataset node, a PDF on a
 * document node — but a media field is for what a reader can see or hear, and
 * a control that silently accepted a zip would be lying about what the field
 * is for. The refusal names the kinds rather than the mime types, because
 * "application/zip is not accepted" is not something a creator can act on.
 */
const FIELD_KINDS: readonly MediaKind[] = ["image", "video", "audio"];

const ALLOWED_DESCRIPTION =
  "images (png, jpg, webp, gif, avif), video (mp4, webm, mov) and audio (mp3, m4a, ogg, wav)";

/** The `accept` attribute for a file input, from the lib layer's own list. */
export function acceptedFieldTypes(): string {
  return acceptedMediaTypes()
    .filter((mime) => FIELD_KINDS.includes(mediaKindFor(mime) as MediaKind))
    .join(",");
}

/**
 * Why this file cannot be uploaded, or null when it can.
 *
 * Size is checked FIRST and locally: a 30MB file is refused here, before a
 * single byte crosses the network, rather than after an upload the storage
 * limit was always going to reject.
 */
export function mediaRejection(file: File): string | null {
  const name = file.name || "That file";

  if (file.size > MEDIA_MAX_BYTES) {
    return `${name} is ${megabytes(file.size)}MB. The limit is ${megabytes(MEDIA_MAX_BYTES)}MB, so it was not uploaded.`;
  }

  const kind = mediaKindFor(file.type);
  if (!kind || !FIELD_KINDS.includes(kind)) {
    return `${name} is ${file.type || "an unrecognised type"}. This field takes ${ALLOWED_DESCRIPTION}.`;
  }

  return null;
}

function megabytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

/** image -> screenshot, video and audio -> recording. Both are evidence types. */
export function trayNodeTypeFor(kind: MediaKind): string {
  return kind === "image" ? "screenshot" : "recording";
}

export interface UploadOptions {
  /** Overrides the panel's selected node. Null uploads unattached material. */
  nodeId?: string | null;
  onProgress?: (fraction: number) => void;
}

export interface ComposeMedia {
  buildId: string;
  /** The node the inspector is showing. A field upload attaches to it. */
  nodeId: string | null;
  media: BuildMedia[];
  resolveMedia: (id: string | null | undefined) => BuildMedia | undefined;
  /** Uploads one file and records it. Throws with a readable message. */
  upload: (file: File, options?: UploadOptions) => Promise<BuildMedia>;
  /** Deletes the row and its object. Safe to call for an id already gone. */
  remove: (id: string) => Promise<void>;
  /** A file dropped on the workspace, not on a field: an unplaced node. */
  uploadToTray: (files: File[]) => Promise<void>;
  isUploadingToTray: boolean;
}

const MediaContext = createContext<ComposeMedia | null>(null);

/**
 * The workspace's media context.
 *
 * Rendered outside the panels rather than inside the inspector, because the
 * tray drop path needs the same upload the field does and the frame is the
 * only ancestor they share.
 */
export function MediaProvider({
  buildId,
  nodeId,
  children,
}: {
  buildId: string;
  nodeId: string | null;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const mediaKey = useMemo(() => buildMediaQueryKey(buildId), [buildId]);
  const recordKey = useMemo(() => composeBuildQueryKey(buildId), [buildId]);
  const [trayUploads, setTrayUploads] = useState(0);

  const { data } = useQuery<BuildMedia[]>({
    queryKey: mediaKey,
    queryFn: () => getMediaForBuild(buildId),
    // One query for the workspace. Uploads write their row into this list
    // themselves, so there is nothing to refetch for.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const media = useMemo(() => data ?? [], [data]);
  const mediaById = useMemo(
    () => new Map(media.map((row) => [row.id, row])),
    [media]
  );

  const resolveMedia = useCallback(
    (id: string | null | undefined) => (id ? mediaById.get(id) : undefined),
    [mediaById]
  );

  const upload = useCallback(
    async (file: File, options?: UploadOptions): Promise<BuildMedia> => {
      const reason = mediaRejection(file);
      // Thrown rather than toasted: the control that asked for the upload is
      // the surface that should say why it did not happen.
      if (reason) throw new Error(reason);

      const row = await uploadMedia({
        buildId,
        nodeId: options?.nodeId !== undefined ? options.nodeId : nodeId,
        file,
        onProgress: options?.onProgress,
      });

      // A load still in flight would land after this write and drop the row
      // it does not know about yet. Cancelling it is what makes the new media
      // resolvable the instant the upload returns.
      await queryClient.cancelQueries({ queryKey: mediaKey });
      queryClient.setQueryData<BuildMedia[]>(mediaKey, (rows) => [...(rows ?? []), row]);
      return row;
    },
    [buildId, mediaKey, nodeId, queryClient]
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteMedia(id);
      await queryClient.cancelQueries({ queryKey: mediaKey });
      queryClient.setQueryData<BuildMedia[]>(mediaKey, (rows) =>
        (rows ?? []).filter((row) => row.id !== id)
      );
    },
    [mediaKey, queryClient]
  );

  /**
   * Part four: the intake pressure valve.
   *
   * A file dropped on the workspace becomes a node in the tray — captured,
   * typed by its mime, and not placed anywhere. This is what lets a creator
   * empty a folder of screenshots into a build before the transcript parser
   * (NS-P13) or the intake surface (NS-P14) exist.
   *
   * The media row is written first and the node second, and a node that fails
   * to insert takes its upload back out with it: an object with no row is
   * invisible to the application and nothing would ever collect it.
   */
  const uploadToTray = useCallback(
    async (files: File[]) => {
      const accepted: File[] = [];
      for (const file of files) {
        const reason = mediaRejection(file);
        if (reason) toast.error(reason);
        else accepted.push(file);
      }
      if (accepted.length === 0) return;

      setTrayUploads((count) => count + accepted.length);
      let added = 0;

      try {
        for (const file of accepted) {
          let row: BuildMedia | null = null;
          try {
            row = await upload(file, { nodeId: null });
            const created = await upsertNode({
              build_id: buildId,
              type: trayNodeTypeFor(row.kind as MediaKind),
              // No position: a tray node is one with position IS NULL.
              title: file.name || null,
              payload: { media_id: row.id },
            });

            queryClient.setQueryData<BuildRecord | null>(recordKey, (record) =>
              record ? { ...record, tray: insertByCreatedAt(record.tray, created) } : record
            );
            added += 1;
          } catch (cause) {
            if (row) await remove(row.id).catch(() => undefined);
            toast.error(`${file.name || "That file"} could not be added`, {
              description: cause instanceof Error ? cause.message : String(cause),
            });
          }
        }
      } finally {
        setTrayUploads((count) => Math.max(0, count - accepted.length));
      }

      if (added > 0) {
        toast(
          added === 1
            ? "Added to the tray. Drag it into the anatomy when you know where it goes."
            : `${added} files added to the tray.`
        );
      }
    },
    [buildId, queryClient, recordKey, remove, upload]
  );

  const value = useMemo<ComposeMedia>(
    () => ({
      buildId,
      nodeId,
      media,
      resolveMedia,
      upload,
      remove,
      uploadToTray,
      isUploadingToTray: trayUploads > 0,
    }),
    [buildId, media, nodeId, remove, resolveMedia, trayUploads, upload, uploadToTray]
  );

  return <MediaContext.Provider value={value}>{children}</MediaContext.Provider>;
}

/**
 * The workspace's media, or null outside it.
 *
 * Null rather than a throw: MediaRefField is reached through the registry and
 * can be rendered by anything that renders a schema, and a field that has no
 * upload behind it should show what it holds rather than break the panel.
 */
export function useComposeMedia(): ComposeMedia | null {
  return useContext(MediaContext);
}

/** getTray orders by created_at, so the optimistic tray has to as well. */
function insertByCreatedAt(tray: BuildNode[], row: BuildNode): BuildNode[] {
  const next = [...tray, row];
  next.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  return next;
}
