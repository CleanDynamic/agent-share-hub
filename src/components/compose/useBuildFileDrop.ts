// Dropping a Build File on a page: read it, parse it, and stop there.
//
// This hook is deliberately the whole of the reading half and none of the
// writing half. It ends holding a parsed proposal; it never creates a build,
// never writes a row and never navigates. The creator stays between the file
// and the record, and the surface that owns the review is what asks them.
//
// WINDOW-LEVEL, PAGE-SCOPED. The listeners go on `window` rather than on the
// dashed rectangle, because a creator dragging a file at a page aims at the
// page. The scoping is the mount: the effect adds the listeners when the page
// mounts and removes them when it unmounts, so nothing survives the route
// change and no second page inherits a drop handler it did not ask for.
//
// A NEARER HANDLER WINS. /compose/new already has an element-level drop zone
// for transcripts and Lovable exports (NS-P14, NS-P20). React's listeners are
// attached at its root container, which is below `window`, so by the time this
// one runs a nearer handler has already called preventDefault if it claimed
// the drop. `defaultPrevented` is therefore the check that keeps one file from
// being taken twice by two parsers.
//
// SIZE IS CHECKED BEFORE THE READ, not after. `file.size` is the only measure
// available before the bytes are in memory, and refusing a 40 MB file after
// loading it is not refusing it. The cap is the parser's own — the same number,
// read as bytes rather than characters, which for a file with multi-byte
// characters is marginally the stricter of the two. That is the right way for
// it to err: the alternative is reading a file the parser would refuse anyway.

import { useCallback, useEffect, useRef, useState } from "react";
// The specific modules rather than the "@/lib/build" barrel, deliberately.
// Several existing suites replace that barrel wholesale with the two or three
// functions they care about, and a hook reaching through it would break them
// for reasons that have nothing to do with what they test.
import {
  MAX_BUILDFILE_CHARS,
  buildFileParsed,
  extractEnvelope,
  parseBuildFile,
  type BuildFileError,
  type BuildFileErrorCode,
  type BuildFileSuccess,
} from "@/lib/build/buildfile";
import { getNodeTypes } from "@/lib/build/nodeTypes";
import { PORTABLE_FORMAT_VERSION } from "@/lib/build/portable";
import type { NodeType } from "@/lib/build/types";

/** What the extractor tells someone to save. Nothing else is opened. */
export const BUILD_FILE_EXTENSIONS = [".md", ".json", ".txt"];

/** The parser's cap, read as bytes. See the note above on why that is right. */
export const MAX_BUILD_FILE_BYTES = MAX_BUILDFILE_CHARS;

/**
 * The parser's codes, plus the two refusals that happen before it is reached.
 *
 * A superset rather than a change to BuildFileErrorCode: buildfile.ts owns that
 * union and this prompt does not modify it. Every BuildFileError is assignable
 * here, so a parser failure and a pre-parse refusal render through one panel.
 */
export type BuildFileDropErrorCode =
  | BuildFileErrorCode
  | "WRONG_FILE_KIND"
  | "TOO_MANY_FILES"
  | "FILE_UNREADABLE";

export interface BuildFileDropError {
  code: BuildFileDropErrorCode;
  message: string;
}

export type BuildFileDropState =
  | { name: "idle" }
  | { name: "reading"; fileName: string }
  | {
      name: "parsed";
      fileName: string;
      result: BuildFileSuccess;
    }
  | {
      name: "failed";
      /** Null when nothing openable was dropped at all. */
      fileName: string | null;
      errors: BuildFileDropError[];
      /** Kept only so the version refusal can name the version it read. */
      raw: string | null;
    };

export interface UseBuildFileDropOptions {
  /**
   * Off while a review is open or a write is in flight. A second file dropped
   * on top of an unanswered proposal would silently replace it.
   */
  enabled?: boolean;
}

export interface BuildFileDrop {
  state: BuildFileDropState;
  /** A file is over the page right now. For the surface's own highlight. */
  isDragging: boolean;
  /** The same path a drop takes, for a file input or a click-to-browse. */
  acceptFile: (file: File) => Promise<void>;
  /** Back to idle, forgetting whatever was read. */
  reset: () => void;
}

function extensionOf(name: string): string {
  const cut = name.lastIndexOf(".");
  return cut === -1 ? "" : name.slice(cut).toLowerCase();
}

/** Extension first; a .md served as text/markdown is still a .md. */
function looksLikeBuildFile(file: File): boolean {
  return BUILD_FILE_EXTENSIONS.includes(extensionOf(file.name));
}

/** Whether what is being dragged is a file at all, rather than selected text. */
function draggingFiles(transfer: DataTransfer | null): boolean {
  if (!transfer) return false;
  const types = transfer.types;
  if (!types) return false;
  // DataTransfer.types is a DOMStringList in older browsers, not an array.
  return Array.from(types as ArrayLike<string>).includes("Files");
}

/**
 * The version the refused file declared, for the plain-language line.
 *
 * A second extraction rather than a value threaded out of the parser: this runs
 * only on the UNSUPPORTED_VERSION path, which is a file that will not be
 * imported, and reading it through the module's own public entry point is
 * steadier than parsing the refusal message back into a number.
 */
export function declaredVersion(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const envelope = extractEnvelope(raw);
    if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) return null;
    const version = (envelope as Record<string, unknown>).neoscale_build;
    if (typeof version === "number") return String(version);
    if (typeof version === "string" && version.trim()) return version.trim();
    return null;
  } catch {
    return null;
  }
}

/**
 * The refusal in words a creator can act on.
 *
 * The parser's own message is precise and written for someone who knows what an
 * envelope is. This is the sentence above it, and the two are shown together
 * rather than one replacing the other — the plain one says what to do, the
 * precise one is what they would need if they went back to the AI and asked.
 */
export function plainLanguageRefusal(
  error: BuildFileDropError | null,
  raw: string | null = null
): string {
  if (!error) return "That file could not be read.";

  switch (error.code) {
    case "UNSUPPORTED_VERSION": {
      const version = declaredVersion(raw);
      return version
        ? `This file says it's version ${version} — this site reads version ${PORTABLE_FORMAT_VERSION}.`
        : `This file is written to a version of the format this site doesn't read. This site reads version ${PORTABLE_FORMAT_VERSION}.`;
    }
    case "NOT_JSON":
    case "NOT_AN_OBJECT":
      return "This doesn't look like a Build File — is it the file the AI gave you?";
    case "FILE_EMPTY":
      return "That file is empty. Is it the one the AI gave you?";
    case "FILE_TOO_LARGE":
      return "That file is too big to read. A Build File is text, and 2 MB is already a very long one.";
    case "TOO_MANY_NODES":
    case "TOO_MANY_EVENTS":
      return "That file holds more than this can take in one go. Ask the AI to split it and bring each part into the same build.";
    case "WRONG_FILE_KIND":
      return "That isn't a file this can open. Drop the .md, .json or .txt the AI gave you.";
    case "TOO_MANY_FILES":
      return "Drop one file at a time — the Build File the AI wrote for this build.";
    case "FILE_UNREADABLE":
      return "That file couldn't be read off your machine. Try dropping it again.";
    default:
      return "This doesn't look like a Build File — is it the file the AI gave you?";
  }
}

export function useBuildFileDrop(options: UseBuildFileDropOptions = {}): BuildFileDrop {
  const enabled = options.enabled ?? true;

  const [state, setState] = useState<BuildFileDropState>({ name: "idle" });
  const [isDragging, setDragging] = useState(false);

  /**
   * dragenter and dragleave fire per element crossed, so a single drag across
   * one page raises many of both. Counting them is what keeps the highlight
   * from flickering as the cursor passes over a card.
   */
  const depth = useRef(0);

  /** Prefetched so the parse does not wait on the registry. Cached per session. */
  const registry = useRef<NodeType[] | null>(null);
  /** One file at a time, whatever lands while a read is in flight. */
  const busy = useRef(false);
  /**
   * A parsed proposal nobody has answered yet.
   *
   * A second file dropped on top of one would replace it silently, and the
   * creator would be confirming a file they are no longer looking at. A failed
   * parse is the opposite case and stays open to a new drop: trying another
   * file is exactly the next thing to do.
   */
  const awaitingAnswer = useRef(false);

  useEffect(() => {
    let live = true;
    getNodeTypes()
      .then((types) => {
        if (live) registry.current = types;
      })
      // Not fatal here: acceptFile awaits the registry itself and reports a
      // failure there, where there is a surface to report it on.
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const reset = useCallback(() => {
    depth.current = 0;
    awaitingAnswer.current = false;
    setDragging(false);
    setState({ name: "idle" });
  }, []);

  const refuse = useCallback(
    (fileName: string | null, errors: BuildFileDropError[], raw: string | null = null) => {
      awaitingAnswer.current = false;
      setState({ name: "failed", fileName, errors, raw });
    },
    []
  );

  const acceptFile = useCallback(
    async (file: File) => {
      if (busy.current || awaitingAnswer.current) return;

      if (!looksLikeBuildFile(file)) {
        refuse(file.name, [
          {
            code: "WRONG_FILE_KIND",
            message: `${file.name} is not one of ${BUILD_FILE_EXTENSIONS.join(", ")}.`,
          },
        ]);
        return;
      }

      // Before the read, deliberately. See the header.
      if (file.size > MAX_BUILD_FILE_BYTES) {
        refuse(file.name, [
          {
            code: "FILE_TOO_LARGE",
            message:
              `${file.name} is ${Math.round(file.size / 1000).toLocaleString("en-GB")} kB. ` +
              `The limit is ${Math.round(MAX_BUILD_FILE_BYTES / 1000).toLocaleString("en-GB")} kB.`,
          },
        ]);
        return;
      }

      busy.current = true;
      setState({ name: "reading", fileName: file.name });

      let raw: string;
      try {
        raw = await file.text();
      } catch (cause) {
        busy.current = false;
        refuse(file.name, [
          {
            code: "FILE_UNREADABLE",
            message: cause instanceof Error ? cause.message : String(cause),
          },
        ]);
        return;
      }

      let types: NodeType[];
      try {
        types = registry.current ?? (await getNodeTypes());
        registry.current = types;
      } catch (cause) {
        busy.current = false;
        refuse(file.name, [
          {
            code: "FILE_UNREADABLE",
            message:
              "The node type registry could not be loaded, so the file could not be read against it. " +
              (cause instanceof Error ? cause.message : String(cause)),
          },
        ]);
        return;
      }

      const result = parseBuildFile(raw, types);
      busy.current = false;

      if (buildFileParsed(result)) {
        awaitingAnswer.current = true;
        setState({ name: "parsed", fileName: file.name, result });
        return;
      }

      refuse(file.name, result.errors as BuildFileDropError[], raw);
    },
    [refuse]
  );

  useEffect(() => {
    if (!enabled) {
      depth.current = 0;
      setDragging(false);
      return;
    }

    const onDragEnter = (event: DragEvent) => {
      if (!draggingFiles(event.dataTransfer)) return;
      depth.current += 1;
      setDragging(true);
    };

    const onDragOver = (event: DragEvent) => {
      if (!draggingFiles(event.dataTransfer)) return;
      // Without this the drop never fires — the browser navigates to the file.
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    };

    const onDragLeave = (event: DragEvent) => {
      if (!draggingFiles(event.dataTransfer)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragging(false);
    };

    const onDrop = (event: DragEvent) => {
      depth.current = 0;
      setDragging(false);

      // A nearer handler already claimed this file. See the header.
      if (event.defaultPrevented) return;
      if (!draggingFiles(event.dataTransfer)) return;

      event.preventDefault();

      if (busy.current || awaitingAnswer.current) return;

      const files = event.dataTransfer?.files;
      if (!files || files.length === 0) return;
      if (files.length > 1) {
        refuse(null, [
          { code: "TOO_MANY_FILES", message: `${files.length} files were dropped at once.` },
        ]);
        return;
      }

      void acceptFile(files[0]);
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);

    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [acceptFile, enabled, refuse]);

  return { state, isDragging, acceptFile, reset };
}
