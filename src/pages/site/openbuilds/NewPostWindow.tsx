/* UX-05 Part 4: the New post window, in the composer's modal recipes (`PublishFrame`: a bottom sheet on a phone).

   Post to (a menu of checkboxes over the spaces the reader can post in), one box whose first line is the heading, Attach work
   and Add image or file under it, whatever was attached, the rows added from + Add, and Cancel and Post. Text or one attachment is
   enough. Post closes the window at once and the post is written into the lists ahead of the server's answer (`sendPost`); a
   refusal hands the window's content back, which is why the window can be opened with a draft. */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { VisuallyHidden } from "@/components/brand/VisuallyHidden";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { AttachmentView } from "@/components/post/PostCard";
import { PostControl } from "@/components/post/postControls";
import { cardAttachment, type CardAttachment } from "@/components/post/postCardModel";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { fileKindFor, MEDIA_MAX_BYTES } from "@/lib/build/media";
import { reportError } from "@/lib/errors/report";
import { listPostableSpaces, readNamedWork, uploadEntryMedia, type AttachmentInput, type LabelledWork, type Space } from "@/lib/openbuilds";
import { NO_CARD_WORK, workNamedBy, type CardWork } from "@/lib/openbuilds/cardWork";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { FOOT_NOTE, FieldInput, HINT, RecipeButton, Row, areaStyle } from "../compose/modalRecipes";
import { PublishFrame } from "../compose/PublishChecklist";
import { AttachPicker } from "./AttachPicker";
import { EMPTY_DRAFT, attachmentOf, hasContent, sendPost, type NewPostDraft } from "./sendPost";
import { postableKey } from "./spaceModel";

export const EMPTY_SEND = "Write something or attach work.";

/** What a picked row attaches. */
export function inputOf(work: LabelledWork): AttachmentInput {
  if (work.size === "build") return { kind: "build", buildId: work.buildId };
  if (work.size === "part") return { kind: "part", buildId: work.buildId, partKey: work.partKey ?? "" };
  if (work.size === "session") return { kind: "session", buildId: work.buildId, sessionKey: work.sessionKey ?? "" };
  return { kind: "step", buildId: work.buildId, nodeId: work.nodeId ?? "" };
}

const keyOf = (input: AttachmentInput): string => JSON.stringify(input);

const ADDABLE: readonly { value: NewPostDraft["added"][number]; label: string }[] = [
  { value: "reward", label: "Reward" },
  { value: "open", label: "Still open" },
  { value: "tags", label: "Tags" },
  { value: "closes", label: "Closes on" },
];

const mergeWork = (a: CardWork, b: CardWork): CardWork => ({ builds: new Map([...a.builds, ...b.builds]), nodes: new Map([...a.nodes, ...b.nodes]) });

export function NewPostWindow({ spaceSlug, draft: restored, onClose, onReopen }: { spaceSlug?: string; draft?: NewPostDraft; onClose: () => void; onReopen: (draft: NewPostDraft) => void }) {
  const phone = useIsPhone();
  const qc = useQueryClient();
  const { user, profile } = useAuth();
  const viewerId = user?.id ?? null;
  const spaces = useQuery({ queryKey: postableKey(viewerId), queryFn: listPostableSpaces, enabled: viewerId !== null });
  const postable: Space[] = spaces.data ?? [];

  const [draft, setDraft] = useState<NewPostDraft>(restored ?? EMPTY_DRAFT);
  const [work, setWork] = useState<CardWork>(NO_CARD_WORK);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const picked = useRef(restored !== undefined);
  const file = useRef<HTMLInputElement>(null);

  // Opened from a space: that space is chosen. Once, and never over a choice the reader made.
  useEffect(() => {
    if (picked.current || !spaceSlug) return;
    const space = postable.find((entry) => entry.slug === spaceSlug);
    if (space) {
      picked.current = true;
      setDraft((current) => ({ ...current, spaceIds: [space.id] }));
    }
  }, [postable, spaceSlug]);

  // A restored draft's attachments need their work read again to be drawn.
  useEffect(() => {
    if (!restored) return;
    void readFor(restored.attachments.map((attachment) => attachment.input));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chosen = postable.filter((space) => draft.spaceIds.includes(space.id));
  const rewardOk = chosen.every((space) => space.rewardsAllowed);
  const change = (patch: Partial<NewPostDraft>) => {
    setNotice(null);
    setDraft((current) => ({ ...current, ...patch }));
  };

  async function readFor(inputs: readonly AttachmentInput[]) {
    const fake = { attachments: inputs.map((input, index) => attachmentOf(input, index)) } as unknown as Parameters<typeof workNamedBy>[0][number];
    try {
      const read = await readNamedWork(workNamedBy([fake]));
      setWork((current) => mergeWork(current, read));
    } catch (error) {
      reportError(error, { source: "openbuilds", context: "readAttachedWork" });
    }
  }

  const attach = (picked: LabelledWork) => {
    const input = inputOf(picked);
    if (draft.attachments.some((attachment) => attachment.key === keyOf(input))) return;
    change({ attachments: [...draft.attachments, { key: keyOf(input), input }] });
    void readFor([input]);
  };

  const remove = (key: string) => {
    const gone = draft.attachments.find((attachment) => attachment.key === key);
    const lostOpen = gone !== undefined && "buildId" in gone.input && draft.openNodeId !== null && draft.stillOpen && gone.input.kind === "build";
    change({ attachments: draft.attachments.filter((attachment) => attachment.key !== key), ...(lostOpen ? { stillOpen: draft.added.includes("open"), openNodeId: null } : null) });
  };

  const toggleStep = (nodeId: string) => {
    if (draft.openNodeId === nodeId && draft.stillOpen) change({ openNodeId: null, stillOpen: false, added: draft.added.filter((row) => row !== "open") });
    else change({ openNodeId: nodeId, stillOpen: true, added: draft.added.includes("open") ? draft.added : [...draft.added, "open"] });
  };

  const addRow = (row: NewPostDraft["added"][number]) => change({ added: draft.added.includes(row) ? draft.added : [...draft.added, row], ...(row === "open" ? { stillOpen: true } : null) });
  const dropRow = (row: NewPostDraft["added"][number]) =>
    change({
      added: draft.added.filter((entry) => entry !== row),
      ...(row === "reward" ? { reward: "" } : null),
      ...(row === "tags" ? { tags: "" } : null),
      ...(row === "closes" ? { closes: "" } : null),
      ...(row === "open" ? { stillOpen: false, openNodeId: null } : null),
    });

  const toggleSpace = (id: string) => {
    picked.current = true;
    const next = draft.spaceIds.includes(id) ? draft.spaceIds.filter((entry) => entry !== id) : [...draft.spaceIds, id];
    const rewardsOk = postable.filter((space) => next.includes(space.id)).every((space) => space.rewardsAllowed);
    change({ spaceIds: next, ...(rewardsOk ? null : { added: draft.added.filter((row) => row !== "reward"), reward: "" }) });
  };

  const addFile = async (picked: File | undefined) => {
    if (!picked) return;
    const kind = fileKindFor(picked);
    if ("refused" in kind) return setNotice(kind.refused);
    if (picked.size > MEDIA_MAX_BYTES) return setNotice(`${picked.name} is over 25 MB.`);
    setUploading(true);
    try {
      const up = await uploadEntryMedia(picked);
      const input: AttachmentInput = { kind: "media", mediaPath: up.path, mediaKind: up.mediaKind };
      setDraft((current) => ({ ...current, attachments: [...current.attachments, { key: keyOf(input), input, name: picked.name }] }));
    } catch (error) {
      reportError(error, { source: "openbuilds", context: "uploadEntryMedia" });
      setNotice(`${picked.name} didn't upload. Try again.`);
    } finally {
      setUploading(false);
      if (file.current) file.current.value = "";
    }
  };

  const post = () => {
    if (!hasContent(draft)) return setNotice(EMPTY_SEND);
    const sent = draft;
    onClose();
    void sendPost({
      qc,
      draft: sent,
      spaces: postable,
      sender: { id: viewerId ?? "", handle: profile?.username ?? null, name: profile?.display_name ?? null, avatarUrl: profile?.avatar_url ?? null },
      work,
      reopen: onReopen,
    });
  };

  /* ── what is drawn ── */

  const open = { id: "new-post", stillOpen: draft.stillOpen, aboutNodeId: draft.openNodeId };
  const drawn = draft.attachments.map((attachment): { key: string; card: CardAttachment | null; build: boolean } => {
    if (attachment.input.kind === "media") return { key: attachment.key, card: { kind: "file", key: attachment.key, name: attachment.name ?? "File", href: null }, build: false };
    return { key: attachment.key, card: cardAttachment(open, attachmentOf(attachment.input, 0), work, new Map()), build: attachment.input.kind === "build" };
  });

  const names = chosen.map((space) => space.name).join(", ");
  const body: ReactNode = (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <PostControl aria-label={`Post to: ${names || "Everyone"}`}>{`Post to: ${names || "Everyone"}`}</PostControl>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {postable.length === 0 ? <DropdownMenuItem disabled>No spaces to post in</DropdownMenuItem> : null}
          {postable.map((space) => (
            <DropdownMenuCheckboxItem key={space.id} checked={draft.spaceIds.includes(space.id)} onSelect={(event) => event.preventDefault()} onCheckedChange={() => toggleSpace(space.id)}>
              {space.name}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div>
        <label htmlFor="new-post-box">
          <VisuallyHidden>Post</VisuallyHidden>
        </label>
        <textarea
          id="new-post-box"
          value={draft.body}
          rows={6}
          autoFocus
          onChange={(event) => change({ body: event.target.value })}
          style={areaStyle(phone, 6, { fontSize: phone ? 16 : 14, outline: "none" })}
        />
        {notice ? (
          <p role="alert" style={{ margin: "6px 0 0", fontFamily: FIGTREE, fontSize: 12.5, color: t.text }}>
            {notice}
          </p>
        ) : null}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {viewerId ? <AttachPicker userId={viewerId} onPick={attach} /> : null}
        <PostControl onClick={() => file.current?.click()} disabled={uploading}>
          Add image or file
        </PostControl>
        <input ref={file} type="file" aria-label="Choose an image or file" hidden onChange={(event) => void addFile(event.target.files?.[0])} />
      </div>

      {drawn.map(({ key, card, build }) =>
        card ? (
          <div key={key}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <AttachmentView attachment={card} onPickTile={build ? toggleStep : undefined} />
              </div>
              <PostControl aria-label={`Remove ${card.kind === "build" ? card.title : card.kind === "file" ? card.name : card.kind === "step" ? card.head : card.kind === "line" ? card.text : "attachment"}`} onClick={() => remove(key)}>
                Remove
              </PostControl>
            </div>
            {build && card.kind === "build" && card.tiles.length > 0 ? <p style={{ margin: "6px 0 0", fontFamily: FIGTREE, fontSize: 12, color: t.label }}>Click a step to mark it still open</p> : null}
          </div>
        ) : null,
      )}

      {draft.added.map((row) => (
        <Row key={row} label={ADDABLE.find((entry) => entry.value === row)?.label ?? row} id={`np-${row}`} phone={phone} noRule>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {row === "reward" ? <FieldInput id="np-reward" phone={phone} inputMode="decimal" placeholder="Pounds, like 40" value={draft.reward} onChange={(event) => change({ reward: event.target.value.replace(/[^0-9.]/g, "") })} /> : null}
            {row === "open" ? <span style={{ ...HINT, flex: 1 }}>Marked as wanted</span> : null}
            {row === "tags" ? <FieldInput id="np-tags" phone={phone} placeholder="scoring, cv" value={draft.tags} onChange={(event) => change({ tags: event.target.value })} /> : null}
            {row === "closes" ? <FieldInput id="np-closes" phone={phone} type="date" value={draft.closes} onChange={(event) => change({ closes: event.target.value })} /> : null}
            <PostControl aria-label={`Remove ${ADDABLE.find((entry) => entry.value === row)?.label ?? row}`} onClick={() => dropRow(row)}>
              Remove
            </PostControl>
          </div>
        </Row>
      ))}

      <div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <PostControl>+ Add</PostControl>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {ADDABLE.filter((entry) => !draft.added.includes(entry.value) && (entry.value !== "reward" || rewardOk)).map((entry) => (
              <DropdownMenuItem key={entry.value} onSelect={() => addRow(entry.value)}>
                {entry.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  const footer: ReactNode = (
    <>
      <span style={FOOT_NOTE} />
      <RecipeButton phone={phone} onClick={onClose}>
        Cancel
      </RecipeButton>
      <RecipeButton phone={phone} variant="primary" onClick={post} disabled={uploading}>
        Post
      </RecipeButton>
    </>
  );

  return <PublishFrame open onClose={onClose} title="New post" width={560} testId="new-post-window" body={body} footer={footer} />;
}

export default NewPostWindow;
