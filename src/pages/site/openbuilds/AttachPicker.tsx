/* UX-05 Part 4: the attach picker, a 360 popover from `Attach work`.

   A Segmented size switch (Build, Part, Session, Step), a search field, and the work in groups: Your drafts, Your published
   builds, Your posts and replies, Other people's (only builds whose makers allow it: the read asks for that). Rows are 36
   high, the name at the left and its context at the right in `--label`. It reads `listAttachableWork`, and names each row with
   `labelAttachable` (the composer's labels for a draft, the reader's for published work, the maker's @handle on someone else's).

   UX-06: IN A REPLY (`reply`), someone else's work is still listed, since a reader looks for it there, but a reply can carry only
   the replier's own: each of those rows is `aria-disabled`, its name in `--text-disabled`, with `Mention instead` at its right,
   which puts the maker's @handle in the box. `open` and `size` start the picker open at a size (the Wall's Reply with a build). */

import { useState, type CSSProperties } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { Segmented } from "@/components/brand/Segmented";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PostControl } from "@/components/post/postControls";
import { groupAttachable, labelAttachable, listAttachableWork, postKey, type LabelledWork, type WorkSize } from "@/lib/openbuilds";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

const SIZES: readonly { value: WorkSize; label: string }[] = [
  { value: "build", label: "Build" },
  { value: "part", label: "Part" },
  { value: "session", label: "Session" },
  { value: "step", label: "Step" },
];

export const attachableKey = (userId: string, size: WorkSize, query: string) => postKey("listAttachableWork", userId, size, query);

const rowBox: CSSProperties = { boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, width: "100%", height: 32, padding: "0 8px", border: 0, borderRadius: 6, fontFamily: FIGTREE, fontSize: 13, textAlign: "left" };

/** UX-06: someone else's work in a reply: shown, not choosable, with Mention instead. */
function MentionRow({ work, onMention }: { work: LabelledWork; onMention: (handle: string) => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <div aria-disabled="true" style={{ ...rowBox, color: t.textDisabled, cursor: "default" }}>
      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: t.textDisabled }}>{work.label}</span>
      {work.handle ? (
        <button
          type="button"
          aria-label={`Mention @${work.handle} instead`}
          onClick={() => onMention(work.handle ?? "")}
          {...handlers}
          style={{ flexShrink: 0, padding: 0, background: "none", border: 0, borderRadius: 4, fontFamily: FIGTREE, fontSize: 12, color: t.text2, cursor: "pointer", textDecoration: state.hovered ? "underline" : "none", textUnderlineOffset: 3, ...ring(state.focusVisible) }}
        >
          Mention instead
        </button>
      ) : null}
    </div>
  );
}

function Row({ work, onPick }: { work: LabelledWork; onPick: (work: LabelledWork) => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      onClick={() => onPick(work)}
      {...handlers}
      style={{ ...rowBox, background: state.hovered ? t.controlOn : "none", color: t.text, cursor: "pointer", ...ring(state.focusVisible) }}
    >
      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{work.label}</span>
      {work.context ? <span style={{ flexShrink: 0, maxWidth: "45%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, color: t.label }}>{work.context}</span> : null}
    </button>
  );
}

export interface AttachPickerProps {
  userId: string;
  onPick: (work: LabelledWork) => void;
  /** UX-06: the picker in a reply box. */
  reply?: { onMention: (handle: string) => void };
  /** UX-06: start open, at this size. */
  open?: boolean;
  size?: WorkSize;
}

export function AttachPicker({ userId, onPick, reply, open: startOpen = false, size: startSize = "build" }: AttachPickerProps) {
  const [open, setOpen] = useState(startOpen);
  const [size, setSize] = useState<WorkSize>(startSize);
  const [query, setQuery] = useState("");
  const work = useQuery({
    queryKey: attachableKey(userId, size, query.trim()),
    // A reply lists other people's work too (forReply false), to say it can only be mentioned.
    queryFn: async () => labelAttachable(await listAttachableWork({ userId, size, query: query.trim() || undefined, ...(reply ? { forReply: false } : null) })),
    enabled: open,
    placeholderData: keepPreviousData,
  });
  const groups = groupAttachable(work.data ?? []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <PostControl aria-haspopup="dialog">Attach work</PostControl>
      </PopoverTrigger>
      <PopoverContent align="start" style={{ width: 360, maxWidth: "calc(100vw - 32px)", padding: 12, zIndex: 80 }} aria-label="Attach work">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Segmented label="Size of work" items={SIZES} value={size} onChange={(value) => setSize(value as WorkSize)} size={28} fontSize={12} fullWidth />
          <input
            aria-label="Search work"
            placeholder="e.g. screener"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            style={{ boxSizing: "border-box", width: "100%", height: 32, padding: "0 10px", borderRadius: 6, border: `1px solid ${t.controlBorder}`, background: t.well, color: t.text, fontFamily: FIGTREE, fontSize: 16 }}
          />
          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            {work.isError ? (
              <p role="alert" style={{ margin: 0, padding: "8px", fontFamily: FIGTREE, fontSize: 12, color: t.text2 }}>
                Your work didn't load.
              </p>
            ) : work.isPending ? (
              <p style={{ margin: 0, padding: "8px", fontFamily: FIGTREE, fontSize: 12, color: t.label }}>Loading</p>
            ) : groups.length === 0 ? (
              <p style={{ margin: 0, padding: "8px", fontFamily: FIGTREE, fontSize: 12, color: t.label }}>Nothing to attach at this size.</p>
            ) : (
              groups.map((group) => (
                <section key={group.title} aria-label={group.title} style={{ paddingBottom: 8 }}>
                  <h4 style={{ margin: 0, padding: "8px 8px 4px", fontFamily: FIGTREE, fontSize: 12, fontWeight: 500, color: t.label }}>{group.title}</h4>
                  {group.rows.map((row) =>
                    reply && row.origin === "others" ? (
                      <MentionRow
                        key={[row.size, row.buildId, row.nodeId, row.partKey, row.sessionKey].join("|")}
                        work={row}
                        onMention={(handle) => {
                          setOpen(false);
                          reply.onMention(handle);
                        }}
                      />
                    ) : (
                      <Row
                        key={[row.size, row.buildId, row.nodeId, row.partKey, row.sessionKey].join("|")}
                        work={row}
                        onPick={(picked) => {
                          setOpen(false);
                          onPick(picked);
                        }}
                      />
                    ),
                  )}
                </section>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
