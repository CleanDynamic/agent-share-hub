/* UX-05 Part 3: Settings and Make a space, one window in the composer's modal recipes (`PublishFrame`: a bottom sheet on a
   phone). Make a space asks for Name, Description and Who can post and takes the defaults for the rest. Settings shows the
   rest to the people who run the space.

   ONLY THE CREATOR CAN SAVE. The database lets only the person who made a space change its settings or its moderators
   (UX-04's policies), so a moderator who opens Settings reads them, fields off, with Close in place of Save, and is told so. */

import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Avatar } from "@/components/brand/Avatar";
import { Checkbox } from "@/components/brand/Checkbox";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { PostControl } from "@/components/post/postControls";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { reportError } from "@/lib/errors/report";
import { addModeratorByHandle, createSpace, getSpaceCrowd, listMySpaces, listSpaces, slugOf, updateSpace, type Space, type SpaceReaction, type SpaceWhoCanPost } from "@/lib/openbuilds";
import { t } from "@/lib/theme/tokens";
import { PostError } from "@/lib/openbuilds/types";
import { FIGTREE } from "@/lib/theme/type";

import { FOOT_NOTE, FieldArea, FieldInput, HINT, RecipeButton, Row, SUBTITLE, SegmentedField } from "../compose/modalRecipes";
import { PublishFrame } from "../compose/PublishChecklist";
import { mySpacesKey } from "./openBuildsFeedModel";
import { DEFAULT_SETTINGS, DESCRIPTION_MAX, NAME_MAX, RULES_MAX, copySettings, makeRefusal, settingsOf, spaceChoicesKey, spaceCrowdKey, type SettingsDraft } from "./spaceModel";

const WHO: readonly { value: SpaceWhoCanPost; label: string }[] = [
  { value: "anyone", label: "Anyone" },
  { value: "members", label: "Members" },
  { value: "invite", label: "Invite only" },
];

/** A made space gets its address from its name; a taken one takes a number after it. */
async function makeWithAddress(input: Parameters<typeof createSpace>[0]): Promise<Space> {
  const base = slugOf(input.name);
  for (let attempt = 1; ; attempt += 1) {
    const slug = attempt === 1 ? base : `${base.slice(0, 36)}-${attempt}`;
    try {
      return await createSpace({ ...input, slug });
    } catch (error) {
      if (!(error instanceof PostError && error.code === "23505") || attempt >= 5) throw error;
    }
  }
}

function WhoCanPost({ value, onChange, disabled, phone }: { value: SpaceWhoCanPost; onChange: (value: SpaceWhoCanPost) => void; disabled?: boolean; phone: boolean }) {
  return (
    <Row label="Who can post" id="space-who" group phone={phone} top>
      <RadioGroup aria-labelledby="space-who" value={value} disabled={disabled} onValueChange={(next) => onChange(next as SpaceWhoCanPost)} style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: "8px 16px" }}>
        {WHO.map((option) => (
          <label key={option.value} style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: phone ? 44 : 24, fontFamily: FIGTREE, fontSize: 13, color: t.text }}>
            <RadioGroupItem value={option.value} aria-label={option.label} />
            {option.label}
          </label>
        ))}
      </RadioGroup>
    </Row>
  );
}

export function SpaceWindow({ mode, slug, onClose }: { mode: "make" | "settings"; slug?: string; onClose: () => void }) {
  const phone = useIsPhone();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const viewerId = user?.id ?? null;

  const crowd = useQuery({ queryKey: spaceCrowdKey(slug ?? "", viewerId), queryFn: () => getSpaceCrowd(slug ?? "", viewerId), enabled: mode === "settings" && Boolean(slug) });
  const choices = useQuery({
    queryKey: spaceChoicesKey,
    queryFn: async () => {
      const [mine, everyone] = await Promise.all([listMySpaces().catch(() => []), listSpaces({ limit: 50 })]);
      const seen = new Set<string>();
      return [...mine, ...everyone.spaces].filter((space) => (seen.has(space.id) ? false : (seen.add(space.id), true)));
    },
    enabled: mode === "settings",
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [draft, setDraft] = useState<SettingsDraft>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(mode === "make");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handle, setHandle] = useState("");
  const [added, setAdded] = useState<{ id: string; handle: string }[]>([]);

  useEffect(() => {
    if (mode === "settings" && crowd.data && !loaded) {
      setDraft(settingsOf(crowd.data.space));
      setLoaded(true);
    }
  }, [mode, crowd.data, loaded]);

  const space = crowd.data?.space ?? null;
  const creator = mode === "make" || !loaded || (space !== null && space.creatorId === viewerId);
  const locked = mode === "settings" && loaded && !creator;
  const set = <K extends keyof SettingsDraft>(key: K, value: SettingsDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const toggleReaction = (reaction: SpaceReaction) => set("reactions", draft.reactions.includes(reaction) ? draft.reactions.filter((entry) => entry !== reaction) : [...draft.reactions, reaction]);

  const save = async () => {
    setError(null);
    if (mode === "make") {
      const refusal = makeRefusal(name);
      if (refusal) return setError(refusal);
    }
    setBusy(true);
    try {
      if (mode === "make") {
        const made = await makeWithAddress({ slug: "", name, description: description.trim(), whoCanPost: draft.whoCanPost });
        void qc.invalidateQueries({ queryKey: mySpacesKey(viewerId) });
        onClose();
        navigate(`/openbuilds/spaces/${made.slug}`);
        return;
      }
      if (!space) return;
      await updateSpace(space.id, { whoCanPost: draft.whoCanPost, rules: draft.rules, postOrder: draft.postOrder, defaultView: draft.defaultView, rewardsAllowed: draft.rewardsAllowed, reactions: draft.reactions });
      void qc.invalidateQueries({ queryKey: spaceCrowdKey(space.slug, viewerId) });
      void qc.invalidateQueries({ queryKey: ["posts", "listPostCards"] });
      onClose();
    } catch (failure) {
      reportError(failure, { source: "openbuilds", context: mode === "make" ? "createSpace" : "updateSpace" });
      setError(failure instanceof Error && failure.message ? failure.message : "That didn't save. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const addModerator = async () => {
    if (!space || !handle.trim()) return;
    try {
      const person = await addModeratorByHandle(space.id, handle);
      setAdded((current) => [...current, person]);
      setHandle("");
      void qc.invalidateQueries({ queryKey: spaceCrowdKey(space.slug, viewerId) });
    } catch (failure) {
      toast.error(failure instanceof Error && failure.message ? failure.message : "Couldn't add them. Try again.");
    }
  };

  const others = (choices.data ?? []).filter((entry) => entry.id !== space?.id);
  const moderators = [...(crowd.data?.moderators ?? []).map((person) => ({ id: person.id, handle: person.handle ?? "someone", avatarUrl: person.avatarUrl })), ...added.filter((person) => !(crowd.data?.moderators ?? []).some((known) => known.id === person.id)).map((person) => ({ ...person, avatarUrl: null as string | null }))];

  const title = mode === "make" ? "Make a space" : "Settings";
  const body: ReactNode =
    mode === "make" ? (
      <div>
        <Row label="Name" id="space-name" phone={phone}>
          <FieldInput id="space-name" phone={phone} value={name} maxLength={NAME_MAX} onChange={(event) => setName(event.target.value)} autoFocus />
        </Row>
        <Row label="Description" id="space-description" phone={phone} top>
          <FieldArea id="space-description" phone={phone} rows={3} value={description} maxLength={DESCRIPTION_MAX} onChange={(event) => setDescription(event.target.value)} />
        </Row>
        <WhoCanPost value={draft.whoCanPost} onChange={(value) => set("whoCanPost", value)} phone={phone} />
        {error ? (
          <p role="alert" style={{ margin: "8px 0 0", fontFamily: FIGTREE, fontSize: 12, color: t.text }}>
            {error}
          </p>
        ) : null}
      </div>
    ) : (
      <div>
        <p style={SUBTITLE}>{locked ? "Only the creator can change these." : "Only you and your moderators see this"}</p>
        <WhoCanPost value={draft.whoCanPost} onChange={(value) => set("whoCanPost", value)} disabled={locked} phone={phone} />
        {creator ? (
          <Row label="Moderators" id="space-moderators" group phone={phone} top>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              {moderators.map((person) => (
                <Avatar key={person.id} size={24} userId={person.id} name={person.handle} src={person.avatarUrl} />
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <FieldInput aria-label="Moderator handle" phone={phone} value={handle} placeholder="@handle" onChange={(event) => setHandle(event.target.value)} onKeyDown={(event) => event.key === "Enter" && (event.preventDefault(), void addModerator())} />
              <PostControl onClick={() => void addModerator()} disabled={!handle.trim()}>
                Add
              </PostControl>
            </div>
          </Row>
        ) : null}
        <Row label="Rules" id="space-rules" phone={phone} top>
          <FieldArea id="space-rules" phone={phone} rows={5} value={draft.rules} maxLength={RULES_MAX} disabled={locked} onChange={(event) => set("rules", event.target.value)} />
        </Row>
        <Row label="Order posts by" id="space-order" group phone={phone}>
          <SegmentedField
            label="Order posts by"
            items={[
              { value: "newest", label: "Newest" },
              { value: "most_replied", label: "Most replied" },
              { value: "pinned_first", label: "Pinned first" },
            ]}
            value={draft.postOrder}
            onChange={(value) => !locked && set("postOrder", value)}
            phone={phone}
          />
        </Row>
        <Row label="Open posts in" id="space-view" group phone={phone}>
          <SegmentedField
            label="Open posts in"
            items={[
              { value: "thread", label: "Thread" },
              { value: "wall", label: "Wall" },
            ]}
            value={draft.defaultView}
            onChange={(value) => !locked && set("defaultView", value)}
            phone={phone}
          />
        </Row>
        <Row label="Allow rewards on posts" id="space-rewards" phone={phone}>
          <Switch id="space-rewards" checked={draft.rewardsAllowed} disabled={locked} onCheckedChange={(on) => set("rewardsAllowed", on)} />
        </Row>
        <Row label="Extra reactions" id="space-reactions" group phone={phone} top>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px" }}>
            {(["dislike", "rating"] as const).map((reaction) => (
              <label key={reaction} style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: phone ? 44 : 24, fontFamily: FIGTREE, fontSize: 13, color: t.text }}>
                <Checkbox checked={draft.reactions.includes(reaction)} disabled={locked} onChange={() => toggleReaction(reaction)} />
                {reaction === "dislike" ? "Dislike" : "Rating"}
              </label>
            ))}
          </div>
          <span style={HINT}>Off unless you turn them on</span>
        </Row>
        {creator ? (
          <Row label="Start from another space's settings" id="space-copy" group phone={phone}>
            <div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <PostControl aria-label="Start from another space's settings">Choose a space</PostControl>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" style={{ zIndex: 80 }}>
                  {others.length === 0 ? <DropdownMenuItem disabled>No other spaces</DropdownMenuItem> : null}
                  {others.map((entry) => (
                    <DropdownMenuItem key={entry.id} onSelect={() => setDraft(copySettings(entry))}>
                      {entry.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </Row>
        ) : null}
        {error ? (
          <p role="alert" style={{ margin: "8px 0 0", fontFamily: FIGTREE, fontSize: 12, color: t.text }}>
            {error}
          </p>
        ) : null}
      </div>
    );

  const footer: ReactNode = locked ? (
    <>
      <span style={FOOT_NOTE} />
      <RecipeButton phone={phone} onClick={onClose}>
        Close
      </RecipeButton>
    </>
  ) : (
    <>
      <span style={FOOT_NOTE} />
      <RecipeButton phone={phone} onClick={onClose}>
        Cancel
      </RecipeButton>
      <RecipeButton phone={phone} variant="primary" onClick={() => void save()} disabled={busy || (mode === "settings" && !loaded)}>
        {mode === "make" ? "Make space" : "Save"}
      </RecipeButton>
    </>
  );

  return <PublishFrame open onClose={onClose} title={title} width={560} testId={mode === "make" ? "make-space-window" : "space-settings-window"} body={body} footer={footer} />;
}

export default SpaceWindow;
