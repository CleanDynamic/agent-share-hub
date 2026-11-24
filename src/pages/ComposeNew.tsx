// /compose/new — the intake step that used to be a redirect.
//
// The blank surface is what loses submissions. A creator arriving here has
// already done the work somewhere else, in a chat window, and the useful thing
// to do with that is take it rather than ask them to retype it as a form.
//
// Three ways in, and they are peers: paste a transcript, drop a file, or start
// empty. Starting empty is a plain link that is always on screen — it is the
// honest option for someone who has nothing to paste, and burying it would make
// this a toll gate rather than an offer.
//
// TWO PARSERS, NO PICKER (NS-P20). The zone also takes a Lovable session export
// — .json, or .zip — and works out which parser it belongs to by reading the
// file's CONTENT, not its extension and not a control the creator has to set.
// They drop what they have. Only genuinely undecidable input asks, once, with
// two options, and nothing about the answer is remembered.
//
// A FOURTH WAY IN (NS-P21): a repository URL. It gets its own field rather
// than sharing the paste zone, because it is the one input that is decided by
// LOOKING at it rather than by reading it — a URL either names a GitHub
// repository or it does not, and there is no content to detect. A GitHub URL
// pasted into the transcript box is still routed to parse-repo rather than fed
// to parse-transcript, which would read a single line as a whole session.
//
// A REPOSITORY IS A SUGGESTION SOURCE. What comes back is a repo node, a
// stack, prerequisites and at most one entrypoint file — never an import of
// the source. The proposal is reviewed on the same surface as the other two,
// because it is the same envelope.
//
// A FIFTH WAY IN (NS-P34): a Build File, written by the AI that helped build
// the thing. It gets its own card rather than sharing the paste zone, and for
// the opposite reason to the repository field — a Build File is a .md or a
// .json, exactly what the paste zone already takes, so the two are told apart
// by where the file was dropped rather than by reading it. The paste zone's
// behaviour is deliberately untouched: a file dropped there still goes to the
// transcript and Lovable readers as it always has, and a file dropped on the
// Build File card, or anywhere else on the page, is read by the local parser.
//
// A SIXTH WAY IN (EX-P09): a conversation the buildgallery connector sent from
// the creator's AI chat. It is already parsed and parked on import_sessions,
// so it needs no zone and no parser — a panel at the top of the offer lists
// what is waiting, and Review opens the SAME tick-box screen a paste gets, with
// the stored proposal in place of a fresh one. Confirming creates the draft and
// writes it through the same materialiseProposal; skipping leaves the import
// waiting, because nothing was created for it yet.
//
// THE SECOND DESTINATION (EX-P10). Review now asks one question before the tick
// boxes: a new build, or a draft the creator already has. A draft the chat
// named (target_build_id) is pre-selected when it is still theirs and still a
// draft; otherwise the step falls back to a new build and says why. Confirming
// into an existing draft calls the same claimImport with that draft's id and
// no createBuild — the writer appends after what the draft holds and skips
// what it already wrote (docs/connector/RECON.md answer 3), so nothing in the
// draft is touched by this page.
//
// ORDER. On paste or drop the draft build is created FIRST, then the parser is
// called with its id. The parser needs a real build to check ownership against,
// and creating first means a parser failure leaves the creator with a usable
// empty draft rather than with nothing — which is the whole difference between
// a bad minute and a lost submission.

import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { createBuild, getBuildHeader } from "@/lib/build";
import {
  MAX_RAW_TEXT_CHARS,
  keepEverything,
  materialiseProposal,
  requestProposal,
  type IntakeArrival,
  type IntakeSelectionState,
  type MaterialiseCounts,
  type TranscriptProposal,
} from "@/lib/build/intake";
import {
  detectExportSource,
  readDroppedFile,
  requestLovableProposal,
  type ExportSource,
} from "@/lib/build/lovable";
import {
  applyRepoHeader,
  isRepoUrl,
  parseRepoUrl,
  repoUrlComplaint,
  requestRepoProposal,
  type RepoProposal,
} from "@/lib/build/repo";
import {
  claimImport,
  discardImport,
  listClaimTargets,
  listWaitingImports,
  loadImportProposal,
  type ClaimTarget,
  type WaitingImport,
} from "@/lib/build/imports";
import { IntakeProposal } from "@/components/compose/IntakeProposal";
import { WaitingImports, importToolName } from "@/components/compose/WaitingImports";
import {
  ImportDestination,
  type DestinationPreset,
  type ImportDestinationChoice,
} from "@/components/compose/ImportDestination";
import { IntakeProgress } from "@/components/compose/IntakeProgress";
import { BuildFileIntake } from "@/components/compose/BuildFileIntake";
import {
  BUILD_FILE_EXTENSIONS,
  useBuildFileDrop,
} from "@/components/compose/useBuildFileDrop";
import {
  WorkspaceBar,
  workspaceGround,
  workspacePanel,
} from "@/components/shell/WorkspaceBar";
import {
  FONT_STACK,
  GAP_RED,
  HAIRLINE,
  TEAL,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  bodyText,
  hexToRgba,
  labelText,
  pageHeadingText,
} from "@/components/build/tokens";
import { Button } from "@/components/brand/Button";
import { DropField } from "@/components/brand/DropField";
import { useIsPhone, useMinWidth } from "@/components/shell/useMinWidth";
import { PhoneTopBar } from "@/components/phone/PhoneTopBar";
import { StartPhone } from "@/components/compose/StartPhone";
import { useResolvedTheme } from "@/contexts/ThemeContext";
import { feedback } from "@/lib/theme/motion";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE, hero } from "@/lib/theme/type";
import { screenError } from "@/lib/auth/authMessages";

/** A build is never asked to name itself before it exists. */
const DRAFT_TITLE = "Untitled build";

/**
 * What a creator can drop: a transcript as text, or a Lovable session export as
 * .json or .zip. The extension only decides whether the file is worth opening —
 * what it IS, is decided by reading it.
 */
const ACCEPTED_EXTENSIONS = [".txt", ".md", ".markdown", ".text", ".json", ".zip"];

type Stage =
  | { name: "idle" }
  | {
      name: "parsing";
      buildId: string;
      sourceLabel: string;
      characterCount: number;
      /** Overrides the turn-splitting copy, which is untrue for a repository. */
      description?: string;
    }
  /** Undecidable input. Asked once, answered once, and never recorded. */
  | { name: "asking"; rawText: string; sourceLabel: string }
  /**
   * The destination question a waiting import is asked before its review
   * (EX-P10): a new build, or one of the creator's drafts. The proposal is
   * already loaded, so Continue costs no read; Back leaves the import waiting.
   */
  | {
      name: "destination";
      importId: string;
      proposal: TranscriptProposal;
      sourceLine: string;
      /** "Claude Code", for the sentence saying where a named draft came from. */
      sentBy: string | null;
      targets: ClaimTarget[];
      preset: DestinationPreset;
      /** The drafts could not be read; a new build is still on offer. */
      targetsError: string | null;
    }
  /**
   * One review stage, two origins. A PARSED proposal already has its draft —
   * the build was created before the parser ran — and `repoUrl` is set only on
   * the repo path, for the header facts the shared writer deliberately knows
   * nothing about. A waiting IMPORT has no draft yet unless the creator chose
   * an existing one: claimImport creates a new draft at confirm time or writes
   * into the chosen one, so a review that ends in Skip leaves nothing behind.
   */
  | {
      name: "review";
      proposal: TranscriptProposal;
      origin:
        | { kind: "parsed"; buildId: string; repoUrl: string | null }
        | {
            kind: "import";
            importId: string;
            sourceLine: string;
            destination: ImportDestinationChoice;
          };
    };

function looksAcceptable(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    file.type.startsWith("text/") ||
    file.type === "application/json" ||
    file.type === "application/zip" ||
    ACCEPTED_EXTENSIONS.some((extension) => name.endsWith(extension))
  );
}

/** parse-repo's two refusals a creator can act on, read by status (G4); anything else is the plain line. */
function repoFailure(label: string, cause: unknown): string {
  const status = (cause as { cause?: { status?: unknown } } | null)?.cause?.status;
  if (status === 404) return `Couldn't read ${label}. It may be private, renamed or not there, so check the URL. Your draft is here and empty.`;
  if (status === 429 || status === 403) return `Couldn't read ${label}. GitHub is limiting requests, so try again in a few minutes. Your draft is here and empty.`;
  return `Couldn't read ${label}. Your draft is here and empty.`;
}

/** G4: our words for a failure, never its own text; `fallback` is the sentence for what was being done. */
function messageOf(cause: unknown, fallback: string): string {
  return screenError(cause, fallback, { source: "compose", context: "compose-start" });
}

/**
 * Where the chat asked for the import to go, checked against what the creator
 * has now (EX-P10). A named draft still in the list is pre-selected; one that
 * is still a draft but beyond the list's first page is read by id and put at
 * the top of it, uncounted; one published or deleted since falls back to a new
 * build, and the step says which. Nothing is trusted from the import itself
 * beyond the id: the header is read through the data layer, under RLS.
 *
 * EX-P18-fix2b: RLS is not the owner check, because an admin can read every
 * draft. A build that is not the signed-in creator's own answers exactly as
 * one that does not exist, checked before its status as verifyClaimTarget
 * checks it, so the step never offers, names or describes someone else's.
 */
async function resolveDestination(
  targetId: string | null,
  targets: ClaimTarget[],
  creatorId: string | null,
): Promise<{ preset: DestinationPreset; targets: ClaimTarget[] }> {
  if (!targetId) return { preset: { kind: "none" }, targets };
  if (targets.some((target) => target.id === targetId)) {
    return { preset: { kind: "draft", buildId: targetId }, targets };
  }
  const header = await getBuildHeader(targetId);
  if (!header || header.creator_id !== creatorId) return { preset: { kind: "missing" }, targets };
  if (header.status !== "draft") return { preset: { kind: "published" }, targets };
  return {
    preset: { kind: "draft", buildId: targetId },
    targets: [
      {
        id: header.id,
        title: header.title,
        updated_at: header.updated_at,
        part_count: null,
        step_count: null,
      },
      ...targets,
    ],
  };
}

/**
 * The review's destination sentence for an existing draft, in place of the
 * default "lands in the tray, unplaced": the same tray, and it already holds
 * things, which the creator should hear before they confirm.
 */
function joinedDraftNote(title: string): string {
  return (
    `Everything you keep is added to the tray of “${title}”, alongside what is ` +
    "already there, for you to arrange. Nothing already in it changes."
  );
}

/**
 * The arrival line for a draft that already held work: what the writer WROTE,
 * not what was ticked, because a draft that already carried this conversation
 * gets nothing added and is told so rather than congratulated.
 */
function joinedDraftMessage(title: string, counts: MaterialiseCounts): string {
  const landed = counts.events + counts.nodes;
  if (landed === 0) {
    return counts.alreadyMaterialised
      ? `“${title}” already held this conversation, so nothing was added.`
      : `Nothing kept. “${title}” is as it was.`;
  }
  const added = [
    counts.nodes > 0 ? `${counts.nodes} ${counts.nodes === 1 ? "item" : "items"} in the tray` : null,
    counts.events > 0
      ? `${counts.events} ${counts.events === 1 ? "prompt" : "prompts"} at the end of the sequence`
      : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" and ");
  return (
    `Added to “${title}”: ${added}` +
    (counts.nodes > 0 ? ". Drag from the tray into the build to place them." : ".")
  );
}

/**
 * The intake step, on the workspace ground (BG-P16).
 *
 * IT HAD NO WAY OUT AT ALL. Of the four authoring routes this was the worst:
 * compose had a "← buildgallery" link, rebuild and convert each had their own
 * back link, and /compose/new had nothing — a creator who opened it and changed
 * their mind had the browser's Back button. It now carries the same bar as the
 * workspace it leads to, so the exit is in one place across the whole act.
 *
 * The ground was #08080C and the card was `panelGlass` — a blurred surface on a
 * void, which is the reading-surface treatment on a working surface. Flat now:
 * `--bg` under a `--recess` panel with a `--line` hairline.
 */
function Shell({ children, flush = false }: { children: React.ReactNode; /** The phone offer draws its own margins. */ flush?: boolean }) {
  const phone = useIsPhone();
  const navigate = useNavigate();
  const theme = useResolvedTheme();
  if (phone) {
    /* Mobile prompt 25: the phone's bar (back to Drafts, the logo, nothing) over one scrolling column on the page shade. No
       dock: this route is outside the frame. */
    return (
      <div data-visual-slot="compose-intake" style={{ position: "fixed", inset: 0, ...workspaceGround, display: "flex", flexDirection: "column", isolation: "isolate" }}>
        <PhoneTopBar left="back" leftLabel="Back to Drafts" onLeft={() => navigate("/drafts")} centre="logo" theme={theme} />
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0, ...(flush ? null : { padding: "8px 16px calc(24px + env(safe-area-inset-bottom))" }) }}>{children}</div>
        </div>
      </div>
    );
  }
  return (
    <div
      data-visual-slot="compose-intake"
      style={{
        position: "fixed",
        inset: 0,
        ...workspaceGround,
        display: "flex",
        flexDirection: "column",
        isolation: "isolate",
      }}
    >
      <WorkspaceBar
        mode="compose"
        exit={{ to: "/drafts" }}
        context={{ kind: "readonly", text: "New build" }}
      />
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          overflowY: "auto",
          padding: 24,
        }}
      >
        <div
          style={{
            ...workspacePanel,
            /* Synth 10: one panel on the page shade, at most 1080 wide, 24 inside, no line round it. */
            backgroundColor: t.surface,
            borderWidth: 0,
            width: "100%",
            maxWidth: 1080,
            margin: "auto",
            padding: 24,
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export default function ComposeNew() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isLoggedIn, loading: authLoading, user } = useAuth();
  const creatorId = user?.id ?? null;

  const [stage, setStage] = useState<Stage>({ name: "idle" });
  const [text, setText] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [selection, setSelection] = useState<IntakeSelectionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isWriting, setWriting] = useState(false);
  const [isDragging, setDragging] = useState(false);
  const [isStarting, setStarting] = useState(false);
  /* Synth 10: the 1.4fr / 1fr grid from 1101; below it one column with the paste box first. */
  const wideGrid = useMinWidth(1101);
  const phone = useIsPhone();

  /** What the connector left waiting. null until the first read answers. */
  const [waiting, setWaiting] = useState<WaitingImport[] | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [discardingId, setDiscardingId] = useState<string | null>(null);
  const [waitingError, setWaitingError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const buildFileInputRef = useRef<HTMLInputElement | null>(null);
  /** One build per intake, whatever the creator clicks twice. */
  const busyRef = useRef(false);

  /**
   * The Build File path. Off unless this page is idle, so a file dropped while
   * a transcript is parsing or a proposal is open cannot cut in front of it.
   */
  const drop = useBuildFileDrop({ enabled: stage.name === "idle" && !isStarting });

  const goToWorkspace = useCallback(
    (buildId: string, arrival: IntakeArrival) => {
      // replace: /compose/new must not sit in history, or Back re-enters it
      // and creates a second draft.
      navigate(`/compose/${buildId}`, { replace: true, state: { intake: arrival } });
    },
    [navigate]
  );

  /**
   * The waiting list, read once the session is known. A read failure is not a
   * reason to hide the four ways in that need no list, so it is shown on the
   * panel's own line rather than as the page's error.
   */
  useEffect(() => {
    if (authLoading || !isLoggedIn) return;
    let cancelled = false;
    listWaitingImports()
      .then((rows) => {
        if (!cancelled) setWaiting(rows);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setWaiting([]);
        setWaitingError(messageOf(cause, "Couldn't load your waiting imports. Try again."));
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, isLoggedIn]);

  /** Start empty. One click, one build, straight into the workspace. */
  const startEmpty = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setStarting(true);
    setError(null);

    try {
      const build = await createBuild({ title: DRAFT_TITLE });
      goToWorkspace(build.id, {
        tone: "settled",
        message: "Empty draft. Add your first node from the panel on the left.",
      });
    } catch (cause) {
      busyRef.current = false;
      setStarting(false);
      setError(messageOf(cause, "Couldn't start your draft. Try again."));
    }
  }, [goToWorkspace]);

  /**
   * Take a transcript: build first, parse second.
   *
   * A parser failure is not a dead end — the draft exists by then, so the
   * creator is sent to it with the reason rather than left on this screen with
   * a transcript they would have to paste again.
   */
  const takeTranscript = useCallback(
    async (rawText: string, sourceLabel: string, source: Exclude<ExportSource, "ambiguous"> = "transcript") => {
      if (busyRef.current) return;

      const trimmed = rawText.trim();
      if (!trimmed) {
        setError("There is nothing to read yet. Paste a transcript or drop a file.");
        return;
      }
      // Both parsers share the limit, so the message is the same either way.
      if (rawText.length > MAX_RAW_TEXT_CHARS) {
        setError(
          `That is ${rawText.length.toLocaleString("en-GB")} characters, over the ` +
            `${MAX_RAW_TEXT_CHARS.toLocaleString("en-GB")} the parser takes. Split it and ` +
            `bring each part into the same build.`
        );
        return;
      }

      busyRef.current = true;
      setError(null);

      let buildId: string;
      try {
        const build = await createBuild({ title: DRAFT_TITLE });
        buildId = build.id;
      } catch (cause) {
        busyRef.current = false;
        setError(messageOf(cause, "Couldn't start your draft. Try again."));
        return;
      }

      setStage({
        name: "parsing",
        buildId,
        sourceLabel,
        characterCount: rawText.length,
      });

      try {
        const proposal =
          source === "lovable"
            ? await requestLovableProposal(buildId, rawText, sourceLabel)
            : await requestProposal(buildId, rawText, sourceLabel);
        busyRef.current = false;
        setSelection(keepEverything(proposal));
        setStage({ name: "review", proposal, origin: { kind: "parsed", buildId, repoUrl: null } });
      } catch (cause) {
        // The draft is already real. Hand it over with the reason attached.
        busyRef.current = false;
        goToWorkspace(buildId, {
          tone: "failed",
          message:
            messageOf(cause, `Couldn't read ${source === "lovable" ? "the export" : "the transcript"}. Your draft is here and empty.`),
        });
      }
    },
    [goToWorkspace]
  );

  /**
   * Take a repository URL: build first, parse second, exactly as a paste does.
   *
   * The order matters for the same reason it does above — the parser verifies
   * ownership against a real build row, and creating the draft first means a
   * parse failure hands the creator a usable empty draft rather than nothing.
   * It matters MORE here, because more of what can go wrong is outside this
   * application: a private repository, a renamed one, a rate-limited GitHub.
   * parse-repo answers each of those with its own sentence, and requestRepoProposal
   * carries that sentence through instead of "non-2xx status code".
   */
  const takeRepo = useCallback(
    async (url: string) => {
      if (busyRef.current) return;

      const trimmed = url.trim();
      const coordinates = parseRepoUrl(trimmed);
      if (!coordinates) {
        // Refused here rather than at the function, so a creator who pasted a
        // GitLab URL is told that before a draft is created for it.
        setError(repoUrlComplaint(trimmed));
        return;
      }

      busyRef.current = true;
      setError(null);

      let buildId: string;
      try {
        const build = await createBuild({ title: DRAFT_TITLE });
        buildId = build.id;
      } catch (cause) {
        busyRef.current = false;
        setError(messageOf(cause, "Couldn't start your draft. Try again."));
        return;
      }

      const label = `${coordinates.owner}/${coordinates.repo}`;
      setStage({
        name: "parsing",
        buildId,
        sourceLabel: label,
        // Nothing has been read yet, so there is no character count to show.
        characterCount: 0,
        description:
          "Reading the manifests, the README and one entrypoint file, not the " +
          "whole repository. Nothing is saved until you have looked at what it found.",
      });

      try {
        const proposal = await requestRepoProposal(buildId, trimmed, label);
        busyRef.current = false;
        setSelection(keepEverything(proposal));
        setStage({
          name: "review",
          proposal,
          origin: { kind: "parsed", buildId, repoUrl: trimmed },
        });
      } catch (cause) {
        // The draft is already real. Hand it over with the reason attached.
        busyRef.current = false;
        goToWorkspace(buildId, {
          tone: "failed",
          message: messageOf(cause, repoFailure(label, cause)),
        });
      }
    },
    [goToWorkspace]
  );

  /**
   * Take a dropped file.
   *
   * readDroppedFile unpacks an archive if the bytes say it is one, so what
   * comes back is always text. detectExportSource then reads that text and
   * decides which parser owns it — the creator is never asked to classify
   * their own file, and is only asked anything at all when the content itself
   * is undecidable.
   */
  const takeFile = useCallback(
    async (file: File) => {
      if (!looksAcceptable(file)) {
        setError(
          `${file.name} is not a file this reads. Drop a .txt or .md transcript, a Lovable ` +
            `export as .json or .zip, or paste the text.`
        );
        return;
      }

      let contents: string;
      try {
        contents = await readDroppedFile(file);
      } catch (cause) {
        setError(messageOf(cause, `Couldn't read ${file.name}. Choose another file.`));
        return;
      }

      const source = detectExportSource(contents);
      if (source === "ambiguous") {
        // Asked once, and nothing about the answer is kept.
        setError(null);
        setStage({ name: "asking", rawText: contents, sourceLabel: file.name });
        return;
      }

      // Only a transcript goes back into the textarea. A Lovable export is
      // machine JSON, and filling the paste box with it would be noise.
      if (source === "transcript") setText(contents);
      await takeTranscript(contents, file.name, source);
    },
    [takeTranscript]
  );

  const confirm = useCallback(async () => {
    if (stage.name !== "review" || !selection) return;
    setWriting(true);
    setError(null);

    try {
      let buildId: string;
      let counts: MaterialiseCounts;
      /** The existing draft this went into, when it did not start a new one. */
      let joined: string | null = null;

      if (stage.origin.kind === "import") {
        // A new draft is created now, by claimImport, or the chosen one is
        // written into; either way through the same materialiseProposal. The
        // counts are the writer's own — for an existing draft, what was
        // ticked and what was written can differ.
        const { destination } = stage.origin;
        const claimed = await claimImport(
          stage.origin.importId,
          stage.proposal,
          selection,
          destination.kind === "existing"
            ? { kind: "existing", buildId: destination.buildId }
            : { kind: "new", title: DRAFT_TITLE },
        );
        buildId = claimed.buildId;
        counts = claimed.counts;
        if (destination.kind === "existing") joined = destination.title;
      } else {
        buildId = stage.origin.buildId;
        counts = await materialiseProposal(buildId, stage.proposal, selection);

        // The repo path only. builds.repo_url and the proposal's made_with are
        // header facts materialiseProposal deliberately knows nothing about, and
        // neither is worth losing the written rows over: a failure here leaves a
        // creator with everything that matters and two fields to set by hand.
        if (stage.origin.repoUrl) {
          try {
            await applyRepoHeader(buildId, stage.proposal as RepoProposal, stage.origin.repoUrl);
          } catch {
            // Deliberately swallowed. The tray is written; the header is a nicety.
          }
        }
      }

      const landed = counts.events + counts.nodes;
      goToWorkspace(buildId, {
        tone: "settled",
        message: joined
          ? joinedDraftMessage(joined, counts)
          : landed === 0
            ? "Nothing kept. Add your first node from the panel on the left."
            : counts.events === 0
              // A repository has no sequence, so naming an empty one would read
              // as something having gone missing.
              ? `${counts.nodes} ${counts.nodes === 1 ? "item is" : "items are"} in your tray. ` +
                `Drag them into the build to place them.`
              : `${counts.nodes} ${counts.nodes === 1 ? "item is" : "items are"} in your tray and ` +
                `${counts.events} ${counts.events === 1 ? "prompt is" : "prompts are"} in the sequence. ` +
                `Drag from the tray into the build to place them.`,
      });
    } catch (cause) {
      setWriting(false);
      setError(messageOf(cause, "Couldn't save that. Nothing was lost. Try again."));
    }
  }, [goToWorkspace, selection, stage]);

  const skipProposal = useCallback(() => {
    if (stage.name !== "review") return;
    if (stage.origin.kind === "import") {
      // No draft was made for it, so there is nothing to go to. The import
      // stays in the list, waiting, exactly as it was.
      setSelection(null);
      setError(null);
      setStage({ name: "idle" });
      return;
    }
    goToWorkspace(stage.origin.buildId, {
      tone: "settled",
      message: "Empty draft. Add your first node from the panel on the left.",
    });
  }, [goToWorkspace, stage]);

  /**
   * Open a waiting import: first the destination question, then the review.
   * The stored proposal is read only now — the list carries counts, never the
   * envelope — and the creator's drafts with it, so the step opens with both in
   * hand. A drafts read that fails is not a reason to refuse the import: the
   * step still offers a new build and says why the drafts are missing.
   */
  const reviewImport = useCallback(
    async (item: WaitingImport, sourceLine: string) => {
      if (busyRef.current || openingId || discardingId) return;
      setOpeningId(item.id);
      setWaitingError(null);
      setError(null);

      try {
        const proposal = await loadImportProposal(item.id);
        let targets: ClaimTarget[] = [];
        let targetsError: string | null = null;
        try {
          targets = await listClaimTargets();
        } catch (cause) {
          targetsError = messageOf(cause, "Couldn't load your drafts. Try again.");
        }
        const resolved = await resolveDestination(item.target_build_id, targets, creatorId);
        setStage({
          name: "destination",
          importId: item.id,
          proposal,
          sourceLine,
          sentBy: importToolName(item),
          targets: resolved.targets,
          preset: resolved.preset,
          targetsError,
        });
      } catch (cause) {
        setWaitingError(messageOf(cause, "Couldn't open that conversation. Try again."));
      } finally {
        setOpeningId(null);
      }
    },
    [creatorId, discardingId, openingId]
  );

  /**
   * The destination is chosen: on to the review, with everything defaulting to
   * keep as it does after a parse. Nothing has been written.
   */
  const chooseDestination = useCallback(
    (choice: ImportDestinationChoice) => {
      if (stage.name !== "destination") return;
      setSelection(keepEverything(stage.proposal));
      setError(null);
      setStage({
        name: "review",
        proposal: stage.proposal,
        origin: {
          kind: "import",
          importId: stage.importId,
          sourceLine: stage.sourceLine,
          destination: choice,
        },
      });
    },
    [stage]
  );

  /** Back from the destination step. The import stays in the list, waiting. */
  const leaveDestination = useCallback(() => {
    setError(null);
    setStage({ name: "idle" });
  }, []);

  /** Bin a waiting import. The panel has already asked once. */
  const discardWaiting = useCallback(
    async (item: WaitingImport) => {
      if (busyRef.current || openingId || discardingId) return;
      setDiscardingId(item.id);
      setWaitingError(null);

      try {
        await discardImport(item.id);
        setWaiting((rows) => (rows ?? []).filter((row) => row.id !== item.id));
      } catch (cause) {
        setWaitingError(messageOf(cause, "Couldn't discard that conversation. Try again."));
      } finally {
        setDiscardingId(null);
      }
    },
    [discardingId, openingId]
  );

  // --- gates -----------------------------------------------------------------

  if (authLoading) {
    return (
      <Shell>
        <p style={{ ...bodyText, margin: 0, color: TEXT_MUTED }}>Checking your session…</p>
      </Shell>
    );
  }

  if (!isLoggedIn) {
    const returnTo = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(returnTo)}`} replace />;
  }

  // Ahead of the page's own stages: a creator who has dropped a Build File is
  // looking at what it found, not at the four ways in they have finished with.
  if (drop.state.name !== "idle") {
    return (
      <Shell>
        <BuildFileIntake state={drop.state} onReset={drop.reset} />
      </Shell>
    );
  }

  if (stage.name === "parsing") {
    return (
      <Shell>
        <IntakeProgress
          sourceLabel={stage.sourceLabel}
          characterCount={stage.characterCount}
          description={stage.description}
        />
      </Shell>
    );
  }

  if (stage.name === "asking") {
    return (
      <Shell>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h1 style={{ ...pageHeadingText, margin: 0 }}>Which is this?</h1>
          <p style={{ ...bodyText, margin: 0, color: TEXT_SECONDARY }}>
            {stage.sourceLabel} is valid JSON, but nothing in it looks like a
            Lovable session export or like a chat transcript. Rather than guess
            and read it wrongly, this asks once. The answer is used for this
            file and not remembered.
          </p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <button
            type="button"
            onClick={() => void takeTranscript(stage.rawText, stage.sourceLabel, "lovable")}
            style={{
              ...bodyText,
              padding: "10px 16px",
              borderRadius: 10,
              border: `1px solid ${hexToRgba(TEAL, 0.45)}`,
              background: hexToRgba(TEAL, 0.12),
              color: TEXT_PRIMARY,
              cursor: "pointer",
              fontFamily: FONT_STACK,
            }}
          >
            A Lovable session export
          </button>
          <button
            type="button"
            onClick={() => {
              setText(stage.rawText);
              void takeTranscript(stage.rawText, stage.sourceLabel, "transcript");
            }}
            style={{
              ...bodyText,
              padding: "10px 16px",
              borderRadius: 10,
              border: `1px solid ${HAIRLINE}`,
              background: "transparent",
              color: TEXT_PRIMARY,
              cursor: "pointer",
              fontFamily: FONT_STACK,
            }}
          >
            A chat transcript
          </button>
        </div>

        <button
          type="button"
          onClick={() => setStage({ name: "idle" })}
          style={{
            ...labelText,
            alignSelf: "flex-start",
            padding: 0,
            border: "none",
            background: "none",
            color: TEXT_MUTED,
            cursor: "pointer",
            textDecoration: "underline",
            fontFamily: FONT_STACK,
          }}
        >
          Neither, go back
        </button>
      </Shell>
    );
  }

  if (stage.name === "destination") {
    return (
      <Shell>
        <ImportDestination
          sourceLine={stage.sourceLine}
          sentBy={stage.sentBy}
          targets={stage.targets}
          preset={stage.preset}
          targetsError={stage.targetsError}
          onContinue={chooseDestination}
          onBack={leaveDestination}
        />
      </Shell>
    );
  }

  if (stage.name === "review" && selection) {
    return (
      <Shell>
        <IntakeProposal
          proposal={stage.proposal}
          selection={selection}
          onChange={setSelection}
          onConfirm={confirm}
          onSkip={skipProposal}
          isWriting={isWriting}
          error={error}
          {...(stage.origin.kind === "import"
            ? {
                sourceLine: stage.origin.sourceLine,
                testId: "waiting-import-proposal",
                confirmTestId: "waiting-import-confirm",
                // The one difference on the tick-box screen for an existing
                // draft: where the kept parts land, said plainly.
                ...(stage.origin.destination.kind === "existing"
                  ? { arrivalNote: joinedDraftNote(stage.origin.destination.title) }
                  : {}),
              }
            : {})}
        />
      </Shell>
    );
  }

  // --- the offer --------------------------------------------------------------

  const busy = isStarting || busyRef.current;

  /* The transcript box and the drop area take the same file the same way. */
  const fileDropHandlers = {
    onDragOver: (event: React.DragEvent) => {
      event.preventDefault();
      if (!isDragging) setDragging(true);
    },
    onDragLeave: (event: React.DragEvent) => {
      // Only when the pointer leaves the zone itself, not a child of it.
      if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
      setDragging(false);
    },
    onDrop: (event: React.DragEvent) => {
      event.preventDefault();
      setDragging(false);
      const file = event.dataTransfer.files?.[0];
      if (file) void takeFile(file);
    },
  };

  const readPasted = () => {
    // A GitHub URL pasted into the transcript box is still a repository. Feeding one line to parse-transcript would read
    // it as a whole session and propose nothing worth keeping.
    const pasted = text.trim();
    if (!/\s/.test(pasted) && isRepoUrl(pasted)) {
      void takeRepo(pasted);
      return;
    }

    const source = detectExportSource(text);
    if (source === "ambiguous") {
      setError(null);
      setStage({ name: "asking", rawText: text, sourceLabel: "pasted text" });
      return;
    }
    void takeTranscript(text, source === "lovable" ? "pasted Lovable export" : "pasted transcript", source);
  };

  if (phone) {
    return (
      <Shell flush>
        <StartPhone
          waiting={
            <WaitingImports
              imports={waiting ?? []}
              busy={busy}
              openingId={openingId}
              discardingId={discardingId}
              onReview={(item, sourceLine) => void reviewImport(item, sourceLine)}
              onDiscard={(item) => void discardWaiting(item)}
              error={waitingError}
            />
          }
          busy={busy}
          isStarting={isStarting}
          text={text}
          onText={(value) => {
            setText(value);
            if (error) setError(null);
          }}
          onReadPasted={readPasted}
          repoUrl={repoUrl}
          onRepoUrl={(value) => {
            setRepoUrl(value);
            if (error) setError(null);
          }}
          onReadRepo={() => void takeRepo(repoUrl)}
          onFile={(file) => void takeFile(file)}
          onBuildFile={(file) => void drop.acceptFile(file)}
          onStartEmpty={() => void startEmpty()}
          error={error}
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h1 style={{ ...hero, margin: 0, color: t.text }}>Start a build</h1>
        <p style={{ margin: 0, fontFamily: FIGTREE, fontSize: 15, lineHeight: "20px", color: t.text2 }}>
          It arrives already structured, so you see what it found before anything is saved.
        </p>
      </div>

      {/* EX-P09. What the connector left waiting, above the fold so a creator who sent a conversation from their chat finds
          it before they are offered a paste box. It renders nothing at all when the list is empty. */}
      <WaitingImports
        imports={waiting ?? []}
        busy={busy}
        openingId={openingId}
        discardingId={discardingId}
        onReview={(item, sourceLine) => void reviewImport(item, sourceLine)}
        onDiscard={(item) => void discardWaiting(item)}
        error={waitingError}
      />

      {/* The ways in are equals: the paste box on the left, a drop area, a repository and a Build File stacked on the
          right. Below 1101 the paste box comes first and the rest follow in one column. */}
      <div style={{ display: "grid", gridTemplateColumns: wideGrid ? "minmax(0, 1.4fr) minmax(0, 1fr)" : "minmax(0, 1fr)", gap: 16, alignItems: "start" }}>
        <div
          data-visual-slot="intake-paste"
          {...fileDropHandlers}
          style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16, borderRadius: r.card, background: t.module, boxSizing: "border-box", minWidth: 0 }}
        >
          <label htmlFor="intake-transcript" style={{ fontFamily: FIGTREE, fontSize: 17, fontWeight: 600, lineHeight: "22px", color: t.text }}>
            Paste a transcript
          </label>

          <textarea
            id="intake-transcript"
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              if (error) setError(null);
            }}
            disabled={busy}
            spellCheck={false}
            placeholder={
              "You said:\nBuild me a script that renames photos by the date they were taken.\n\nChatGPT said:\nUse exiftool…"
            }
            style={{
              width: "100%",
              boxSizing: "border-box",
              minHeight: 240,
              resize: "vertical",
              fontFamily: DM_MONO,
              fontSize: 13,
              lineHeight: "18px",
              color: t.text,
              background: t.field,
              border: 0,
              borderRadius: r.area,
              padding: 12,
            }}
          />

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button variant="primary" size={32} onClick={readPasted} disabled={busy}>
              Read it
            </Button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <DropField
            data-visual-slot="intake-file"
            armed={isDragging}
            over={isDragging}
            {...fileDropHandlers}
            style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8, padding: 16 }}
          >
            <span style={{ fontFamily: FIGTREE, fontSize: 17, fontWeight: 600, lineHeight: "22px", color: t.text }}>Drop a file</span>
            <span style={{ fontFamily: FIGTREE, fontSize: 13, lineHeight: "16px", color: t.label }}>
              {isDragging ? "Let go to read it." : "A chat export, .json or .zip"}
            </span>
            <Button variant="secondary" size={32} onClick={() => fileInputRef.current?.click()} disabled={busy}>
              Choose a file
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.markdown,.text,.json,.zip,text/plain,text/markdown,application/json,application/zip"
              onChange={(event) => {
                const file = event.target.files?.[0];
                // Cleared so choosing the same file twice fires change again.
                event.target.value = "";
                if (file) void takeFile(file);
              }}
              style={{ display: "none" }}
            />
          </DropField>

          {/* A URL is decided by looking at it; a transcript is decided by reading it, so it is its own way in (NS-P21). */}
          <div
            data-visual-slot="intake-repo-url"
            style={{ display: "flex", flexDirection: "column", gap: 8, padding: 16, borderRadius: r.card, background: t.module, boxSizing: "border-box" }}
          >
            <label htmlFor="intake-repo-url" style={{ fontFamily: FIGTREE, fontSize: 17, fontWeight: 600, lineHeight: "22px", color: t.text }}>
              Or paste a repository URL
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              <input
                id="intake-repo-url"
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                value={repoUrl}
                onChange={(event) => {
                  setRepoUrl(event.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={(event) => {
                  // Enter submits: a one-line field that needed a mouse to send would be the slowest way in on the page.
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  if (!busy) void takeRepo(repoUrl);
                }}
                disabled={busy}
                placeholder="https://github.com/owner/repository"
                style={{
                  flex: "1 1 200px",
                  minWidth: 0,
                  boxSizing: "border-box",
                  height: 40,
                  fontFamily: FIGTREE,
                  fontSize: 15,
                  color: t.text,
                  background: t.field,
                  border: 0,
                  borderRadius: r.field,
                  padding: "0 16px",
                }}
              />
              <Button variant="secondary" size={32} onClick={() => void takeRepo(repoUrl)} disabled={busy}>
                Read the repo
              </Button>
            </div>
            <span style={{ fontFamily: FIGTREE, fontSize: 13, lineHeight: "16px", color: t.label }}>
              Public GitHub repositories only. Nothing is cloned. The manifests, the README and one entrypoint file are read, and everything found is a suggestion you confirm.
            </span>
          </div>

          {/* NS-P34. A Build File dropped anywhere on this card is read, and so is one chosen with the button. */}
          <div
            data-visual-slot="intake-build-file"
            data-testid="import-drop"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              // Claimed here so the window listener does not read it a second time.
              event.preventDefault();
              const file = event.dataTransfer.files?.[0];
              if (file) void drop.acceptFile(file);
            }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 8,
              padding: 16,
              borderRadius: r.card,
              background: drop.isDragging ? t.field : t.module,
              boxSizing: "border-box",
              transition: feedback("background-color"),
            }}
          >
            <span style={{ fontFamily: FIGTREE, fontSize: 17, fontWeight: 600, lineHeight: "22px", color: t.text }}>Or drop a Build File</span>
            <span style={{ fontFamily: FIGTREE, fontSize: 13, lineHeight: "16px", color: t.label }}>
              {drop.isDragging ? "Let go to read it." : `The file the AI wrote up for you (${BUILD_FILE_EXTENSIONS.join(", ")}).`}
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
              <Button variant="secondary" size={32} data-testid="import-choose-build-file" onClick={() => buildFileInputRef.current?.click()} disabled={busy}>
                Choose a Build File
              </Button>
              <Link to="/import" style={{ fontFamily: FIGTREE, fontSize: 13, color: t.text2, textDecoration: "underline", textUnderlineOffset: 3, whiteSpace: "nowrap" }}>
                Get the Extractor
              </Link>
            </div>
            <input
              ref={buildFileInputRef}
              type="file"
              accept={BUILD_FILE_EXTENSIONS.join(",")}
              onChange={(event) => {
                const file = event.target.files?.[0];
                // Cleared so choosing the same file twice fires change again.
                event.target.value = "";
                if (file) void drop.acceptFile(file);
              }}
              style={{ display: "none" }}
            />
          </div>
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          style={{
            margin: 0,
            padding: "12px 16px",
            borderRadius: r.card,
            background: t.breakageFill,
            color: t.text,
            fontFamily: FIGTREE,
            fontSize: 15,
            lineHeight: "20px",
          }}
        >
          {error}
        </p>
      ) : null}

      {/* Always on screen, never behind a disclosure: someone with nothing to paste must not have to hunt for the way in. */}
      <div>
        <button
          type="button"
          onClick={() => void startEmpty()}
          disabled={busy}
          style={{
            fontFamily: FIGTREE,
            fontSize: 13,
            lineHeight: "20px",
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: busy ? "wait" : "pointer",
            color: t.text2,
            textDecoration: "underline",
            textUnderlineOffset: 3,
          }}
        >
          {isStarting ? "Creating a draft…" : "Start empty instead"}
        </button>
      </div>
    </Shell>
  );
}
