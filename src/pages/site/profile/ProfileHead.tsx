/* UX-10 P5: the profile's head. PURE: typed props, no fetching, no data module; `ProfilePage` feeds it.

   One `surface` box at the page column's width. The header picture across its top at 4:1 with the box's top corners (or the
   dot-grid cover texture build covers use when they have none, never a gradient). The profile picture, Avatar at 96 (72 on a
   phone) with a 4px ring in the surface colour, overlapping the header by half its size, at the text's inset. Then the name
   (body font, 20/500, `--text`, the page's h1), the meta line (`label`), Level when shown, one line about them (`text2`), up to
   three links by host, and the record line, where only `reproduced by others` is in `--evidence`.

   ACTIONS. Someone else's profile: Follow (the one primary; Following as a control once followed), Message, and `···` with Copy
   link and Report. Your own: Edit profile, a control, the only button, and Change header and Change picture on the pictures.
   A PRIVATE profile you don't follow: the head and one sentence, with Follow; no feed and no side column. */

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
  edit: "Edit profile",
  changeHeader: "Change header",
  changePicture: "Change picture",
} as const;

const DOT_GRID: CSSProperties = {
  background: t.well,
  backgroundImage: `radial-gradient(${t.dotGrid} 1px, transparent 1px)`,
  backgroundSize: "16px 16px",
};

const LINK: CSSProperties = { color: "inherit", textDecoration: "none" };

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
    <div data-testid="profile-header-picture" data-texture={header ? undefined : "dot-grid"} style={{ position: "relative", width: "100%", aspectRatio: "4 / 1", overflow: "hidden", ...(header ? { background: t.well } : DOT_GRID) }}>
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
            <PostControl aria-label={HEAD_COPY.more}>···</PostControl>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={props.onCopyLink}>{HEAD_COPY.copyLink}</DropdownMenuItem>
            {props.onReport ? <DropdownMenuItem onSelect={props.onReport}>{HEAD_COPY.report}</DropdownMenuItem> : null}
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
        border: `1px solid ${t.surfaceBorder}`,
        borderRadius: 10,
        boxShadow: t.surfaceShadow,
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
          <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginTop: -size / 2 }}>
            <Avatar size={size} userId={props.userId} name={props.name} src={props.avatarUrl} alt={props.avatarAlt ?? ""} style={{ boxShadow: `0 0 0 4px ${t.surface}` }} />
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

        <h1 style={{ margin: "12px 0 0", fontFamily: FIGTREE, fontSize: 20, fontWeight: 500, lineHeight: 1.2, color: t.text, overflowWrap: "anywhere" }}>{props.name}</h1>

        {props.meta.length > 0 ? (
          <div data-testid="profile-meta" style={{ marginTop: 4, fontSize: 12.5, lineHeight: 1.4, color: t.label, fontVariantNumeric: "tabular-nums" }}>
            <Dotted
              parts={props.meta}
              render={(index) => {
                const part = props.meta[index];
                return part.to ? (
                  <Link to={part.to} style={LINK}>
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
          <div data-testid="profile-level" style={{ marginTop: 2, fontSize: 12.5, lineHeight: 1.4, color: t.label }}>
            {`Level ${props.level}`}
          </div>
        ) : null}

        {props.privateLine ? (
          <p data-testid="profile-private" style={{ margin: "12px 0 0", fontSize: 13, lineHeight: "20px", color: t.text2 }}>
            {props.privateLine}
          </p>
        ) : (
          <>
            {props.oneLine || props.links.length > 0 ? (
              <p data-testid="profile-one-line" style={{ margin: "8px 0 0", fontSize: 13, lineHeight: "20px", color: t.text2, overflowWrap: "anywhere" }}>
                {props.oneLine}
                {props.links.map((link, index) => (
                  <span key={link}>
                    {props.oneLine || index > 0 ? " " : null}
                    <a href={link} rel="me noopener" target="_blank" style={{ color: t.text2, textDecoration: "underline", textUnderlineOffset: 3 }}>
                      {linkHostOf(link)}
                    </a>
                  </span>
                ))}
              </p>
            ) : null}

            {props.record.length > 0 ? (
              <div data-testid="profile-record" style={{ marginTop: 8, fontSize: 13, lineHeight: "20px", color: t.text2, fontVariantNumeric: "tabular-nums" }}>
                <Dotted
                  parts={props.record}
                  render={(index) => {
                    const part = props.record[index];
                    return (
                      <Link to={part.to} data-tone={part.evidence ? "evidence" : undefined} style={{ ...LINK, color: part.evidence ? t.evidence : t.text2 }}>
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
