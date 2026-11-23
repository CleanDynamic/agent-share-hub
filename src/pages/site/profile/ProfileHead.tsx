/* UX-10 P5, restyled by Synth 12 Part A: the profile's head. PURE: typed props, no fetching, no data module; `ProfilePage` feeds it.

   One panel across the 1280 container (Panel fill, radius 12, no edge). The header picture across its top at 4:1, capped at
   320 tall, with the panel's top corners; with none, a Panel-coloured area with the Deep dot pattern at a 6px pitch (Leaf
   dots on White in the light). The profile picture, 96 radius 20 (72 on a phone) with a 4px Panel ring, overlapping the
   picture by half its size. At the right: Follow (the main button; "Following" secondary once followed), Message
   (secondary), and More (a round icon: Copy link, Report, Block). Your own: Edit profile, and Change header and Change
   picture on the pictures.

   Then the name as the page's h1 (31/36 Geist 600), the meta line (15 Text 3; the follower counts underlined links), the
   one line (15), and the record line ("12 builds"). A PRIVATE profile you don't follow: the head and one sentence. */

import type { CSSProperties, ReactNode } from "react";

import { Avatar } from "@/components/brand/Avatar";
import { PostControl, PostPrimary } from "@/components/post/postControls";
import { cropInCell } from "@/components/post/media/cropStyle";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageLink as Link } from "@/lib/routing/PageLink";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { linkHostOf, type MetaPart, type RecordPart } from "./profileFeedModel";
import { PAGE_TITLE } from "@/components/shell/PageHeader";

export interface HeadCrop {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ProfileHeadProps {
  userId: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  /** The picture's ALT; null where the name beside it says who it is. */
  avatarAlt: string | null;
  header: { url: string; crop: HeadCrop | null; alt: string | null } | null;
  meta: readonly MetaPart[];
  /** "Level 7", shown only when the owner allows it or it is your own profile. */
  level: number | null;
  oneLine: string | null;
  links: readonly string[];
  record: readonly RecordPart[];
  isOwn: boolean;
  /** Private and you don't follow: the head and one sentence. */
  privateLine?: string | null;
  following: boolean;
  followBusy?: boolean;
  onFollow: () => void;
  onUnfollow: () => void;
  onMessage: () => void;
  onEdit: () => void;
  onCopyLink: () => void;
  /** Report in `···`. Absent: not offered (no report flow takes a person yet; see the UX-10 report). */
  onReport?: () => void;
  /** UX-15 P5: `Block @maya` in `···`, for someone else's profile. Absent: not offered. */
  onBlock?: () => void;
  /** UX-15 P5: where the pair stands. `by_me`: Unblock replaces Follow and Message. `by_them`: no actions, and no reason given. */
  blocked?: "by_me" | "by_them" | null;
  onUnblock?: () => void;
  onChangeHeader?: (from: HTMLElement | null) => void;
  onChangePicture?: (from: HTMLElement | null) => void;
  /** "Uploading 40%" beside the picture or on the header while an upload runs. */
  uploading?: { which: "avatar" | "banner"; percent: number } | null;
}

export const HEAD_COPY = {
  follow: "Follow",
  following: "Following",
  message: "Message",
  more: "More for this profile",
  copyLink: "Copy link",
  report: "Report",
  block: "Block",
  unblock: "Unblock",
  edit: "Edit profile",
  changeHeader: "Change header",
  changePicture: "Change picture",
} as const;

/** The fallback: the Panel shade with the Deep dots at a 6px pitch. */
const DOT_GRID: CSSProperties = {
  background: t.surface,
  backgroundImage: `radial-gradient(${t.dotDeep} 1px, transparent 1.2px)`,
  backgroundSize: "6px 6px",
};

/** The 4:1 picture stops growing here. */
export const HEADER_MAX_HEIGHT = 320;

const LINK: CSSProperties = { color: "inherit", textDecoration: "none" };
const COUNT_LINK: CSSProperties = { color: "inherit", textDecoration: "underline", textUnderlineOffset: 3 };

function Dotted({ parts, render }: { parts: readonly { key: string }[]; render: (index: number) => ReactNode }) {
  return (
    <>
      {parts.map((part, index) => (
        <span key={part.key}>
          {index > 0 ? <span aria-hidden="true">{" · "}</span> : null}
          {render(index)}
        </span>
      ))}
    </>
  );
}

function HeaderPicture({ header }: { header: ProfileHeadProps["header"] }) {
  return (
    <div data-testid="profile-header-picture" data-texture={header ? undefined : "dot-grid"} style={{ position: "relative", width: "100%", aspectRatio: "4 / 1", maxHeight: HEADER_MAX_HEIGHT, overflow: "hidden", borderRadius: "12px 12px 0 0", ...(header ? { background: t.module } : DOT_GRID) }}>
      {header ? (
        <img
          src={header.url}
          alt={header.alt ?? ""}
          width={1200}
          height={300}
          decoding="async"
          fetchPriority="high"
          style={header.crop ? cropInCell(header.crop, 4) : { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : null}
    </div>
  );
}

export function ProfileHead(props: ProfileHeadProps) {
  const phone = useIsPhone();
  const size = phone ? 72 : 96;
  const inset = phone ? 16 : 24;
  const { isOwn, following } = props;

  const actions = isOwn ? (
    <PostControl onClick={props.onEdit}>{HEAD_COPY.edit}</PostControl>
  ) : props.blocked === "by_them" ? null : props.blocked === "by_me" ? (
    <>
      <PostControl onClick={props.onUnblock}>{HEAD_COPY.unblock}</PostControl>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <PostControl round aria-label={HEAD_COPY.more}>···</PostControl>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={props.onCopyLink}>{HEAD_COPY.copyLink}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  ) : (
    <>
      {following ? (
        <PostControl aria-pressed onClick={props.onUnfollow} disabled={props.followBusy}>
          {HEAD_COPY.following}
        </PostControl>
      ) : (
        <PostPrimary onClick={props.onFollow} disabled={props.followBusy}>
          {HEAD_COPY.follow}
        </PostPrimary>
      )}
      {props.privateLine ? null : <PostControl onClick={props.onMessage}>{HEAD_COPY.message}</PostControl>}
      {props.privateLine ? null : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <PostControl round aria-label={HEAD_COPY.more}>···</PostControl>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={props.onCopyLink}>{HEAD_COPY.copyLink}</DropdownMenuItem>
            {props.onReport ? <DropdownMenuItem onSelect={props.onReport}>{HEAD_COPY.report}</DropdownMenuItem> : null}
            {props.onBlock ? <DropdownMenuItem onSelect={props.onBlock}>{`${HEAD_COPY.block} @${props.handle}`}</DropdownMenuItem> : null}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  );

  return (
    <header
      data-testid="profile-head"
      style={{
        boxSizing: "border-box",
        width: "100%",
        background: t.surface,
        borderRadius: 12,
        overflow: "hidden",
        fontFamily: FIGTREE,
      }}
    >
      <div style={{ position: "relative" }}>
        <HeaderPicture header={props.header} />
        {isOwn && props.onChangeHeader ? (
          <span style={{ position: "absolute", top: 12, right: 12 }}>
            <PostControl onClick={(event) => props.onChangeHeader?.(event.currentTarget)}>
              {props.uploading?.which === "banner" ? `Uploading ${props.uploading.percent}%` : HEAD_COPY.changeHeader}
            </PostControl>
          </span>
        ) : null}
      </div>
      <div style={{ padding: `0 ${inset}px ${inset}px` }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ position: "relative", display: "flex", alignItems: "flex-end", gap: 12, marginTop: -size / 2 }}>
            <Avatar size={size} userId={props.userId} name={props.name} src={props.avatarUrl} alt={props.avatarAlt ?? ""} style={{ borderRadius: phone ? 16 : 20, boxShadow: `0 0 0 4px ${t.surface}` }} />
            {isOwn && props.onChangePicture ? (
              <PostControl onClick={(event) => props.onChangePicture?.(event.currentTarget)}>
                {props.uploading?.which === "avatar" ? `Uploading ${props.uploading.percent}%` : HEAD_COPY.changePicture}
              </PostControl>
            ) : null}
          </div>
          <div data-testid="profile-actions" style={{ display: "flex", gap: 8, paddingTop: 12 }}>
            {actions}
          </div>
        </div>

        {/* Page shell exception: the name stays beside its avatar rather than in a PageHeader at 64 / 88, in the shared title style, the page's one h1. */}
        <h1 style={{ ...PAGE_TITLE, margin: "12px 0 0", fontFamily: FIGTREE, fontSize: 31, lineHeight: "36px", fontWeight: 600, color: t.text, overflowWrap: "anywhere" }}>{props.name}</h1>

        {props.meta.length > 0 ? (
          <div data-testid="profile-meta" style={{ marginTop: 4, fontSize: 15, lineHeight: "20px", color: t.label, fontVariantNumeric: "tabular-nums" }}>
            <Dotted
              parts={props.meta}
              render={(index) => {
                const part = props.meta[index];
                return part.to ? (
                  <Link to={part.to} style={COUNT_LINK}>
                    {part.text}
                  </Link>
                ) : (
                  part.text
                );
              }}
            />
          </div>
        ) : null}

        {props.level !== null ? (
          <div data-testid="profile-level" style={{ marginTop: 2, fontSize: 15, lineHeight: "20px", color: t.label }}>
            {`Level ${props.level}`}
          </div>
        ) : null}

        {props.privateLine ? (
          <p data-testid="profile-private" style={{ margin: "12px 0 0", fontSize: 15, lineHeight: "20px", color: t.text2 }}>
            {props.privateLine}
          </p>
        ) : (
          <>
            {props.oneLine || props.links.length > 0 ? (
              <p data-testid="profile-one-line" style={{ margin: "8px 0 0", fontSize: 15, lineHeight: "20px", color: t.text, overflowWrap: "anywhere" }}>
                {props.oneLine}
                {props.links.map((link, index) => (
                  <span key={link}>
                    {props.oneLine || index > 0 ? " " : null}
                    <a href={link} rel="me noopener" target="_blank" style={{ color: t.text, textDecoration: "underline", textUnderlineOffset: 3 }}>
                      {linkHostOf(link)}
                    </a>
                  </span>
                ))}
              </p>
            ) : null}

            {props.record.length > 0 ? (
              <div data-testid="profile-record" style={{ marginTop: 8, fontSize: 15, lineHeight: "20px", color: t.text2, fontVariantNumeric: "tabular-nums" }}>
                <Dotted
                  parts={props.record}
                  render={(index) => {
                    const part = props.record[index];
                    return (
                      <Link to={part.to} style={{ ...LINK, color: t.text2 }}>
                        {part.text}
                      </Link>
                    );
                  }}
                />
              </div>
            ) : null}
          </>
        )}
      </div>
    </header>
  );
}

export default ProfileHead;
