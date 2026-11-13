/* UX-10 P8: Customise profile, opened by Edit profile. One window in the New topic window's recipe (`PublishFrame`, a bottom sheet
   on a phone). It replaces EditProfileSheet and its typed cover URL field.

   Six groups, each headed with `SectionHead`: About you; Pictures; Pinned (order and remove; pinning is from an item's ···); Feed;
   Side sections; Who sees. The footer: Reset to default as a quiet text button on the left, then Cancel and Save. Save writes
   everything in one request (`onSave`); Cancel with changes asks once, `Leave without saving?`. Reorder is by buttons, never drag
   only, and every control has an accessible name. */

import { useId, useState, type ReactNode } from "react";

import { Button } from "@/components/brand/Button";
import { Checkbox } from "@/components/brand/Checkbox";
import { Segmented } from "@/components/brand/Segmented";
import { SectionHead } from "@/components/vision/SectionHead";
import { PageLink } from "@/lib/routing/PageLink";
import { useIsPhone } from "@/components/shell/useMinWidth";
import type { ProfileDraft } from "@/lib/profile/customise";
import {
  ABOUT_COUNT_FROM,
  ABOUT_MAX,
  DEFAULT_SETTINGS,
  LINKS_MAX,
  ONE_LINE_MAX,
  movePin,
  type BuildDisplay,
  type FeedFilter,
  type LevelVisible,
  type NotesVisible,
  type SideKey,
} from "@/lib/profile/settings";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { FOOT_NOTE, FieldArea, FieldInput, HINT, RecipeButton, Row } from "../compose/modalRecipes";
import { PublishFrame } from "../compose/PublishChecklist";
import { SIDE_TITLES } from "./ProfileSide";

export interface CustomisePicture {
  /** The preview's URL, or null with none. */
  url: string | null;
}

export interface CustomiseProfileProps {
  open: boolean;
  onClose: () => void;
  initial: ProfileDraft;
  /** Each pin's heading, by `kind:id`. */
  pinLabels: ReadonlyMap<string, string>;
  pictures: { avatar: CustomisePicture; header: CustomisePicture };
  onPicture: (action: "change" | "crop" | "remove", which: "avatar" | "banner", from: HTMLElement | null) => void;
  onSave: (draft: ProfileDraft) => Promise<void>;
}

export const CUSTOMISE_COPY = {
  title: "Customise profile",
  groups: { about: "About you", pictures: "Pictures", pinned: "Pinned", feed: "Feed", side: "Side sections", who: "Who sees" },
  displayName: "Display name",
  oneLine: "One line",
  location: "Location",
  links: "Links",
  addLink: "Add link",
  about: "About",
  picture: "Profile picture",
  header: "Header",
  change: "Change",
  remove: "Remove",
  noPins: "Pin up to 3 things from your feed with ··· > Pin to profile.",
  openOn: "Open on",
  showBuildsAs: "Show builds as",
  oneBuild: "You can change one build from its ··· menu.",
  notes: "Notes in your feed",
  level: "Your level",
  saves: "Your saves are always private.",
  morePrivacy: "More privacy settings",
  reset: "Reset to default",
  cancel: "Cancel",
  save: "Save",
  leave: "Leave without saving?",
  leaveYes: "Leave",
  leaveNo: "Keep editing",
} as const;

const FEED_ITEMS: readonly { value: FeedFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "builds", label: "Builds" },
  { value: "topics", label: "Topics" },
  { value: "replies", label: "Replies" },
  { value: "notes", label: "Notes" },
];
const DISPLAY_ITEMS: readonly { value: BuildDisplay; label: string }[] = [
  { value: "first_post", label: "First post" },
  { value: "map", label: "Map card" },
];
const NOTES_ITEMS: readonly { value: NotesVisible; label: string }[] = [
  { value: "everyone", label: "Everyone" },
  { value: "followers", label: "Followers" },
  { value: "only_me", label: "Only me" },
];
const LEVEL_ITEMS: readonly { value: LevelVisible; label: string }[] = [
  { value: "everyone", label: "Everyone" },
  { value: "only_me", label: "Only me" },
];

const KIND_WORD = { build: "build", topic: "topic", reply: "reply", repro_note: "note" } as const;

/** Whether the draft differs from what was stored. */
export const draftChanged = (a: ProfileDraft, b: ProfileDraft): boolean => JSON.stringify(a) !== JSON.stringify(b);

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} style={{ marginTop: 24 }}>
      <SectionHead title={title} headingLevel={3} />
      <div style={{ marginTop: 8 }}>{children}</div>
    </section>
  );
}

function SmallButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children?: ReactNode }) {
  return (
    <RecipeButton small aria-label={label} onClick={onClick} disabled={disabled}>
      {children ?? label}
    </RecipeButton>
  );
}

const chars = (text: string) => [...text].length;

export function CustomiseProfile({ open, onClose, initial, pinLabels, pictures, onPicture, onSave }: CustomiseProfileProps) {
  const phone = useIsPhone();
  const ids = useId();
  const [draft, setDraft] = useState<ProfileDraft>(initial);
  const [asking, setAsking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const change = (patch: Partial<ProfileDraft>) => setDraft((was) => ({ ...was, ...patch }));
  const settings = (patch: Partial<ProfileDraft["settings"]>) => setDraft((was) => ({ ...was, settings: { ...was.settings, ...patch } }));

  const cancel = () => {
    if (draftChanged(draft, initial) && !asking) setAsking(true);
    else onClose();
  };

  const save = async () => {
    setSaving(true);
    setRefusal(null);
    try {
      await onSave(draft);
      onClose();
    } catch (error) {
      setRefusal(error instanceof Error ? error.message : "Your profile didn't save.");
    } finally {
      setSaving(false);
    }
  };

  const aboutCount = chars(draft.about);
  const sections = draft.settings.sideSections;

  const body = (
    <div style={{ fontFamily: FIGTREE }}>
      <Group title={CUSTOMISE_COPY.groups.about}>
        <Row label={CUSTOMISE_COPY.displayName} id={`${ids}-name`} phone={phone} noRule>
          <FieldInput id={`${ids}-name`} phone={phone} value={draft.displayName} maxLength={60} onChange={(event) => change({ displayName: event.target.value })} />
        </Row>
        <Row label={CUSTOMISE_COPY.oneLine} id={`${ids}-line`} phone={phone}>
          <FieldInput id={`${ids}-line`} phone={phone} value={draft.oneLine} maxLength={ONE_LINE_MAX} onChange={(event) => change({ oneLine: event.target.value })} />
        </Row>
        <Row label={CUSTOMISE_COPY.location} id={`${ids}-place`} phone={phone}>
          <FieldInput id={`${ids}-place`} phone={phone} value={draft.location} maxLength={80} onChange={(event) => change({ location: event.target.value })} />
        </Row>
        <Row label={CUSTOMISE_COPY.links} id={`${ids}-links`} group phone={phone}>
          <div role="group" aria-labelledby={`${ids}-links`} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {draft.links.map((link, index) => (
              <div key={index} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <FieldInput
                  phone={phone}
                  aria-label={`Link ${index + 1}`}
                  type="url"
                  placeholder="https://"
                  value={link}
                  maxLength={200}
                  onChange={(event) => change({ links: draft.links.map((one, at) => (at === index ? event.target.value : one)) })}
                />
                <SmallButton label={`Remove link ${index + 1}`} onClick={() => change({ links: draft.links.filter((_, at) => at !== index) })}>
                  {CUSTOMISE_COPY.remove}
                </SmallButton>
              </div>
            ))}
            {draft.links.length < LINKS_MAX ? (
              <div>
                <SmallButton label={CUSTOMISE_COPY.addLink} onClick={() => change({ links: [...draft.links, ""] })} />
              </div>
            ) : null}
          </div>
        </Row>
        <Row label={CUSTOMISE_COPY.about} id={`${ids}-about`} phone={phone} top>
          <FieldArea id={`${ids}-about`} phone={phone} rows={5} value={draft.about} maxLength={ABOUT_MAX} onChange={(event) => change({ about: event.target.value })} />
          {aboutCount > ABOUT_COUNT_FROM ? (
            <div data-testid="customise-about-count" style={{ ...HINT, marginTop: 4, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{`${aboutCount} / ${ABOUT_MAX}`}</div>
          ) : null}
        </Row>
      </Group>

      <Group title={CUSTOMISE_COPY.groups.pictures}>
        {(
          [
            ["avatar", CUSTOMISE_COPY.picture, pictures.avatar],
            ["banner", CUSTOMISE_COPY.header, pictures.header],
          ] as const
        ).map(([which, label, picture]) => (
          <div key={which} style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 56 }}>
            <button
              type="button"
              aria-label={picture.url ? `Crop ${label.toLowerCase()}` : label}
              disabled={!picture.url}
              onClick={(event) => onPicture("crop", which, event.currentTarget)}
              style={{
                width: which === "avatar" ? 40 : 160,
                height: 40,
                padding: 0,
                borderRadius: which === "avatar" ? "50%" : 6,
                overflow: "hidden",
                border: `1px solid ${t.wellBorder}`,
                background: t.well,
                cursor: picture.url ? "pointer" : "default",
                flex: "none",
              }}
            >
              {picture.url ? <img src={picture.url} alt="" width={which === "avatar" ? 40 : 160} height={40} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : null}
            </button>
            <span style={{ flexGrow: 1, fontSize: 13, color: t.text2 }}>{label}</span>
            <SmallButton label={`${CUSTOMISE_COPY.change} ${label.toLowerCase()}`} onClick={() => onPicture("change", which, null)}>
              {CUSTOMISE_COPY.change}
            </SmallButton>
            {picture.url ? (
              <SmallButton label={`${CUSTOMISE_COPY.remove} ${label.toLowerCase()}`} onClick={() => onPicture("remove", which, null)}>
                {CUSTOMISE_COPY.remove}
              </SmallButton>
            ) : null}
          </div>
        ))}
      </Group>

      <Group title={CUSTOMISE_COPY.groups.pinned}>
        {draft.pins.length === 0 ? (
          <p style={{ ...HINT, margin: 0 }}>{CUSTOMISE_COPY.noPins}</p>
        ) : (
          <ol aria-label={CUSTOMISE_COPY.groups.pinned} style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {draft.pins.map((pin, index) => {
              const name = pinLabels.get(`${pin.kind}:${pin.id}`) ?? `A pinned ${KIND_WORD[pin.kind]}`;
              return (
                <li key={`${pin.kind}:${pin.id}`} data-testid="customise-pin" style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 32, borderTop: index === 0 ? "none" : `1px solid ${t.hairline}` }}>
                  <span style={{ flexGrow: 1, minWidth: 0, fontSize: 13, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                  <SmallButton label={`Move ${name} up`} disabled={index === 0} onClick={() => change({ pins: movePin(draft.pins, index, -1) })}>
                    Move up
                  </SmallButton>
                  <SmallButton label={`Move ${name} down`} disabled={index === draft.pins.length - 1} onClick={() => change({ pins: movePin(draft.pins, index, 1) })}>
                    Move down
                  </SmallButton>
                  <SmallButton label={`Remove ${name}`} onClick={() => change({ pins: draft.pins.filter((_, at) => at !== index) })}>
                    {CUSTOMISE_COPY.remove}
                  </SmallButton>
                </li>
              );
            })}
          </ol>
        )}
      </Group>

      <Group title={CUSTOMISE_COPY.groups.feed}>
        <Row label={CUSTOMISE_COPY.openOn} id={`${ids}-open`} group phone={phone} noRule>
          <Segmented<FeedFilter> label={CUSTOMISE_COPY.openOn} semantics="radio" size={28} items={FEED_ITEMS} value={draft.settings.feedFilter} onChange={(feedFilter) => settings({ feedFilter })} />
        </Row>
        <Row label={CUSTOMISE_COPY.showBuildsAs} id={`${ids}-display`} group hint={CUSTOMISE_COPY.oneBuild} phone={phone}>
          <Segmented<BuildDisplay> label={CUSTOMISE_COPY.showBuildsAs} semantics="radio" size={28} items={DISPLAY_ITEMS} value={draft.settings.buildDisplay} onChange={(buildDisplay) => settings({ buildDisplay })} />
        </Row>
      </Group>

      <Group title={CUSTOMISE_COPY.groups.side}>
        <ol aria-label={CUSTOMISE_COPY.groups.side} style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {sections.map((section, index) => {
            const name = SIDE_TITLES[section.key as SideKey];
            return (
              <li key={section.key} data-testid="customise-side" style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 32, borderTop: index === 0 ? "none" : `1px solid ${t.hairline}` }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, flexGrow: 1, fontSize: 13, color: t.text, cursor: "pointer" }}>
                  <Checkbox
                    role="switch"
                    aria-checked={!section.hidden}
                    checked={!section.hidden}
                    label={`Show ${name}`}
                    onChange={() => settings({ sideSections: sections.map((one, at) => (at === index ? { ...one, hidden: !one.hidden } : one)) })}
                  />
                  {name}
                </label>
                <SmallButton label={`Move ${name} up`} disabled={index === 0} onClick={() => settings({ sideSections: movePin(sections, index, -1) })}>
                  Move up
                </SmallButton>
                <SmallButton label={`Move ${name} down`} disabled={index === sections.length - 1} onClick={() => settings({ sideSections: movePin(sections, index, 1) })}>
                  Move down
                </SmallButton>
              </li>
            );
          })}
        </ol>
      </Group>

      <Group title={CUSTOMISE_COPY.groups.who}>
        <Row label={CUSTOMISE_COPY.notes} id={`${ids}-notes`} group phone={phone} noRule>
          <Segmented<NotesVisible> label={CUSTOMISE_COPY.notes} semantics="radio" size={28} items={NOTES_ITEMS} value={draft.settings.notesVisible} onChange={(notesVisible) => settings({ notesVisible })} />
        </Row>
        <Row label={CUSTOMISE_COPY.level} id={`${ids}-level`} group hint={CUSTOMISE_COPY.saves} phone={phone}>
          <Segmented<LevelVisible> label={CUSTOMISE_COPY.level} semantics="radio" size={28} items={LEVEL_ITEMS} value={draft.settings.levelVisible} onChange={(levelVisible) => settings({ levelVisible })} />
        </Row>
        {/* UX-15 P2: private profile and blocking live in Settings. */}
        <PageLink to="/settings/privacy" style={{ ...FOOT_NOTE, color: t.label, textDecoration: "underline", textUnderlineOffset: 3, textDecorationThickness: 1, alignSelf: "flex-start" }}>
          {CUSTOMISE_COPY.morePrivacy}
        </PageLink>
      </Group>
    </div>
  );

  const footer = asking ? (
    <>
      <span style={FOOT_NOTE} role="alert">
        {CUSTOMISE_COPY.leave}
      </span>
      <RecipeButton phone={phone} onClick={() => setAsking(false)}>
        {CUSTOMISE_COPY.leaveNo}
      </RecipeButton>
      <RecipeButton phone={phone} onClick={onClose}>
        {CUSTOMISE_COPY.leaveYes}
      </RecipeButton>
    </>
  ) : (
    <>
      <span style={{ ...FOOT_NOTE, display: "flex", alignItems: "center", gap: 8 }}>
        <Button variant="ghost" size={phone ? 44 : 32} onClick={() => change({ settings: { ...DEFAULT_SETTINGS, sideSections: DEFAULT_SETTINGS.sideSections.map((one) => ({ ...one })) } })}>
          {CUSTOMISE_COPY.reset}
        </Button>
        {refusal ? <span role="alert">{refusal}</span> : null}
      </span>
      <RecipeButton phone={phone} onClick={cancel}>
        {CUSTOMISE_COPY.cancel}
      </RecipeButton>
      <RecipeButton phone={phone} variant="primary" onClick={() => void save()} disabled={saving}>
        {CUSTOMISE_COPY.save}
      </RecipeButton>
    </>
  );

  return <PublishFrame open={open} onClose={cancel} title={CUSTOMISE_COPY.title} width={560} testId="customise-profile" body={body} footer={footer} />;
}

export default CustomiseProfile;
