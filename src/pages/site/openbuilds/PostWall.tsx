/* UX-06 Part 5, Synth 11: the Wall, every build in a post's replies side by side. PURE: typed props, no fetching, no router
   hooks but `Link`.

   Cards in `useCardColumns`' columns (three, two below 1101, one below 761), 8 apart. A published build is a Card (the Card
   fill, radius 12, no border, no picture area): the name 15/600, `Avatar` 20 with the handle, `Rebuilt from @maya` (or
   `new build`) 13 in Text 3, `Pinned`, and Open build, Reply, Rebuild. A build still in a draft is a dashed card (1px dashed
   `--field-edge`): `In progress · 2 sessions` and `updated 20m ago`.

   Under the cards, the way in: `Built something for this? Reply with a build.` and the view's one primary, `Reply with a build`,
   which opens the reply box with the picker at Build. While that box is open it carries the primary. */

import type { CSSProperties, ReactNode } from "react";

import { Avatar } from "@/components/brand/Avatar";
import { PostControl, PostPrimary } from "@/components/post/postControls";
import { DashedSlot } from "@/components/vision/DashedSlot";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";
import { useCardColumns } from "@/pages/site/builds/BuildsFrame";

import type { WallCard } from "./postModel";

export const WALL_WAY_IN = "Built something for this? Reply with a build.";

export interface PostWallProps {
  cards: readonly WallCard[];
  onReply: (replyId: string) => void;
  onReplyWithBuild: () => void;
  /** The reply box, when Reply with a build opened it. */
  box?: ReactNode;
  /** Part 6: the Line up steps table, under the cards. */
  lineUp?: ReactNode;
}

const line = (size: number, color: string, extra: CSSProperties = {}): CSSProperties => ({ margin: 0, fontFamily: FIGTREE, fontSize: size, lineHeight: "16px", color, ...extra });

/** Off-screen cards are laid out only when they come near. */
const offScreen: CSSProperties = { contentVisibility: "auto", containIntrinsicSize: "auto 200px" };

function Who({ author }: { author: WallCard["author"] }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
      <Avatar size={20} userId={author.id} name={author.name} src={author.avatarUrl} />
      <span style={line(13, t.text2)}>{author.handle ? `@${author.handle}` : author.name}</span>
    </div>
  );
}

function Card({ card, onReply }: { card: WallCard; onReply: (replyId: string) => void }) {
  const body = (
    <>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <h3 style={{ ...line(15, t.text, { fontWeight: 600, lineHeight: "20px" }), overflowWrap: "anywhere" }}>{card.title}</h3>
        {card.pinned ? <span style={{ ...line(13, t.text2), flex: "none" }}>Pinned</span> : null}
      </div>
      <Who author={card.author} />
      <p style={{ ...line(13, t.label), marginTop: 8 }}>{card.line}</p>
      {card.kind === "in-progress" ? <p style={{ ...line(13, t.label), marginTop: 4 }}>{card.updated}</p> : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
        {card.kind === "published" ? <PostControl to={card.to}>Open build</PostControl> : null}
        <PostControl onClick={() => onReply(card.replyId)}>Reply</PostControl>
        {card.kind === "published" ? <PostControl to={card.rebuildTo}>Rebuild</PostControl> : null}
      </div>
    </>
  );
  return card.kind === "published" ? (
    <li data-testid="wall-card" data-kind={card.kind} style={{ ...offScreen, listStyle: "none", background: t.module, borderRadius: 12, padding: 16, minWidth: 0 }}>
      {body}
    </li>
  ) : (
    <DashedSlot as="li" wide data-testid="wall-card" data-kind={card.kind} style={{ ...offScreen, listStyle: "none", padding: 16, borderRadius: 12, border: `1px dashed ${t.fieldEdge}` }}>
      {body}
    </DashedSlot>
  );
}

export function PostWall({ cards, onReply, onReplyWithBuild, box, lineUp }: PostWallProps) {
  const columns = useCardColumns();
  return (
    <div data-columns={columns}>
      <ol aria-label="Builds in replies" style={{ margin: "8px 0 0", padding: 0, display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 8, alignItems: "start" }}>
        {cards.map((card) => (
          <Card key={card.replyId} card={card} onReply={onReply} />
        ))}
      </ol>
      {lineUp}
      <div style={{ marginTop: 16 }}>
        {box ?? (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <p style={line(15, t.text2, { lineHeight: "20px" })}>{WALL_WAY_IN}</p>
            <PostPrimary onClick={onReplyWithBuild} block>
              Reply with a build
            </PostPrimary>
          </div>
        )}
      </div>
    </div>
  );
}
