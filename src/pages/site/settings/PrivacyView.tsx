/* UX-15 P5: Privacy and blocking. PURE.

   Your profile: `Private profile` (the existing `is_private`), and a link to Customise profile for `Who sees` (not copied here).
   Blocked people: the people you blocked, newest first, each a `PlainRow` with avatar, name, @handle and `Unblock`; or
   `You haven't blocked anyone.` How blocking works: one paragraph that matches the database exactly. */

import { Button } from "@/components/brand/Button";
import { Avatar } from "@/components/brand/Avatar";
import { PlainRow } from "@/components/vision/PlainRow";
import { Switch } from "@/components/ui/switch";
import { PageLink } from "@/lib/routing/PageLink";
import { BLOCK_COPY, type BlockedPerson } from "@/lib/settings/blocks";
import { CUSTOMISE_PROFILE_HREF } from "@/lib/settings/privacySettings";
import { t } from "@/lib/theme/tokens";

import { Group, Note, SectionPage, SettingRow } from "./SettingParts";

export interface PrivacyViewProps {
  isPrivate: boolean;
  onTogglePrivate: (on: boolean) => void;
  blocked: readonly BlockedPerson[];
  onUnblock: (person: BlockedPerson) => void;
  /** Ids being unblocked right now. */
  busy?: ReadonlySet<string>;
}

export function PrivacyView({ isPrivate, onTogglePrivate, blocked, onUnblock, busy }: PrivacyViewProps) {
  return (
    <SectionPage title="Privacy and blocking">
      <Group title="Your profile">
        <SettingRow
          id="pref-private"
          label="Private profile"
          hint="Only people who follow you can see your builds and posts."
          control={<Switch aria-labelledby="pref-private" checked={isPrivate} onCheckedChange={onTogglePrivate} />}
        />
        <SettingRow
          last
          label="Who sees your notes and level"
          hint="Set in Customise profile, with the rest of how your profile looks."
          control={
            <PageLink to={CUSTOMISE_PROFILE_HREF} style={{ fontSize: 13, color: t.text, textDecoration: "underline", textUnderlineOffset: 3, textDecorationThickness: 1 }}>
              Customise profile
            </PageLink>
          }
        />
      </Group>

      <Group title="Blocked people">
        {blocked.length === 0 ? (
          <Note>{BLOCK_COPY.none}</Note>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {blocked.map((person, index) => {
              const name = person.displayName || person.username || "Someone";
              return (
                <li key={person.id}>
                  <PlainRow
                    height={56}
                    last={index === blocked.length - 1}
                    label={
                      <span style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                        <Avatar size={28} userId={person.id} name={name} src={person.avatarUrl} alt="" />
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: "block", color: t.text, fontWeight: 500, overflowWrap: "anywhere" }}>{name}</span>
                          {person.username ? <span style={{ display: "block", color: t.label, fontSize: 12 }}>{`@${person.username}`}</span> : null}
                        </span>
                      </span>
                    }
                    value={
                      <Button variant="secondary" size={32} fontSize={12} aria-label={`${BLOCK_COPY.unblock} ${person.username ? `@${person.username}` : name}`} disabled={busy?.has(person.id)} onClick={() => onUnblock(person)}>
                        {BLOCK_COPY.unblock}
                      </Button>
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Group>

      <Group title="How blocking works">
        <Note>{BLOCK_COPY.how}</Note>
      </Group>
    </SectionPage>
  );
}

export default PrivacyView;
