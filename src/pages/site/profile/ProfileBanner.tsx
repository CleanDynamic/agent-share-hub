/* UI-P34 — the Profile's banner and its actions.

   PURE. A cover (the maker's most-reproduced build's, else `CoverFallback`
   seeded with the user id), the profile arc, a scrim, and over the bottom edge
   the maker: a square holding their avatar, the eyebrow, the name in Sentient,
   the handle and bio, and the actions.

   DESKTOP: one 220px glass-edged box with the row at its bottom (left and right
   20, bottom 18); the actions sit at the row's end. PHONE: a 290px section — the
   cover 180 tall with the arc, the square straddling its bottom edge at left 14,
   and the text beside the square, under the cover — and the actions in a row of
   their own (`ProfileActions` with `phone`). */

import type { CSSProperties, ReactNode } from "react";
import { Check, MessageSquare, Plus } from "lucide-react";

import { Avatar } from "@/components/brand/Avatar";
import { Button } from "@/components/brand/Button";
import { CoverFallback } from "@/components/brand/CoverFallback";
import { Eyebrow } from "@/components/brand/Eyebrow";
import { t } from "@/lib/theme/tokens";
import { display, FIGTREE } from "@/lib/theme/type";

import { eyebrowLine, handleLine } from "./profileModel";

/** Who the profile is, as the banner shows them. */
export interface ProfileMakerView {
  id: string;
  name: string;
  handle: string;
  bio: string | null;
  place: string | null;
  /** "Feb 2026". */
  since: string | null;
  avatarUrl: string | null;
  /** Forces the avatar's hue (the dev fixtures). */
  avatarHue?: number;
  /** The cover's picture, filling its box. Null draws `CoverFallback` seeded with `id`. */
  cover: ReactNode | null;
  /** Forces the fallback's sky (the dev fixtures). */
  sky?: number;
}

export interface ProfileActionsProps {
  isOwn: boolean;
  following: boolean;
  followBusy?: boolean;
  onFollow: () => void;
  onUnfollow: () => void;
  /** Absent when messaging is not offered (a signed-out reader, or your own profile). */
  onMessage?: () => void;
  onEdit?: () => void;
  phone?: boolean;
}

/** Follow / Following, Message — or Edit profile on your own. */
export function ProfileActions({ isOwn, following, followBusy, onFollow, onUnfollow, onMessage, onEdit, phone = false }: ProfileActionsProps) {
  const size = phone ? 48 : 36;
  const fontSize = phone ? 15 : 13;
  const full = phone;

  if (isOwn) {
    return (
      <Button variant="secondary" size={size} fontSize={fontSize} fullWidth={full} data-testid="profile-edit" onClick={onEdit}>
        Edit profile
      </Button>
    );
  }

  return (
    <>
      {following ? (
        <Button
          variant="secondary"
          size={size}
          fontSize={fontSize}
          fullWidth={full}
          icon={Check}
          disabled={followBusy}
          data-testid="profile-follow"
          onClick={onUnfollow}
        >
          Following
        </Button>
      ) : (
        <Button
          variant="primary"
          size={size}
          fontSize={fontSize}
          fullWidth={full}
          icon={Plus}
          disabled={followBusy}
          data-testid="profile-follow"
          onClick={onFollow}
        >
          Follow
        </Button>
      )}
      {onMessage ? (
        <Button variant="secondary" size={size} fontSize={fontSize} fullWidth={full} icon={MessageSquare} data-testid="profile-message" onClick={onMessage}>
          Message
        </Button>
      ) : null}
    </>
  );
}

const FILL: CSSProperties = { position: "absolute", inset: 0 };

function Cover({ maker }: { maker: ProfileMakerView }) {
  return maker.cover ?? <CoverFallback seed={maker.id} radius={0} sky={maker.sky} />;
}

export interface ProfileBannerProps extends ProfileActionsProps {
  maker: ProfileMakerView;
}

const ELLIPSIS: CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

export function ProfileBanner({ maker, phone = false, ...actions }: ProfileBannerProps) {
  const line = handleLine(maker.handle, maker.bio);
  const mark = (size: number, avatar: number) => (
    <div
      data-ui="profile-square"
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        background: t.inverse,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "none",
        flexShrink: 0,
      }}
    >
      <Avatar size={avatar} userId={maker.id} name={maker.name} hue={maker.avatarHue} src={maker.avatarUrl} />
    </div>
  );

  if (phone) {
    return (
      <section data-testid="profile-banner" style={{ position: "relative", height: 290 }}>
        <div style={{ height: 180, borderRadius: 8, overflow: "hidden", position: "relative", border: `1px solid ${t.moduleBorder}` }}>
          <div style={FILL}>
            <Cover maker={maker} />
          </div>
        </div>
        <div style={{ position: "absolute", left: 14, top: 130 }}>{mark(92, 70)}</div>
        <div style={{ position: "absolute", left: 120, right: 0, top: 190, display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <Eyebrow>{eyebrowLine(maker.place, maker.since, true)}</Eyebrow>
          <h1 style={{ ...display(30, { mobilePageHeading: true }), margin: 0, color: t.text, ...ELLIPSIS }}>{maker.name}</h1>
          <div style={{ fontFamily: FIGTREE, fontSize: 12, lineHeight: "normal", color: t.text2, ...ELLIPSIS }}>{line}</div>
        </div>
      </section>
    );
  }

  /* The cover is a media well and the identity row sits on a module strip under it: no scrim gradient to read the name through. */
  return (
    <section
      data-testid="profile-banner"
      style={{ position: "relative", height: "100%", borderRadius: 8, overflow: "hidden", border: `1px solid ${t.moduleBorder}`, boxShadow: t.moduleShadow }}
    >
      <div style={FILL}>
        <Cover maker={maker} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "12px 16px",
          padding: 16,
          background: t.module,
          borderTop: `1px solid ${t.hairlineModule}`,
        }}
      >
        {mark(72, 56)}
        <div style={{ flex: "1 1 260px", display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <Eyebrow>{eyebrowLine(maker.place, maker.since)}</Eyebrow>
          <h1 style={{ ...display(32), margin: 0, color: t.text, ...ELLIPSIS }}>{maker.name}</h1>
          <div style={{ fontFamily: FIGTREE, fontSize: 12, lineHeight: "normal", color: t.text2, ...ELLIPSIS }}>{line}</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <ProfileActions {...actions} />
        </div>
      </div>
    </section>
  );
}

export default ProfileBanner;
