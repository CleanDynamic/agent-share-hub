import { useMemo, useState } from "react";
import { Sparkles, Star, Wand2, ShieldCheck, Compass, BookOpen, type LucideIcon } from "lucide-react";
import TrackPicker, { type TrackOption } from "@/components/skilltree/track-picker";
import TrackUndecidedState from "@/components/skilltree/track-undecided-state";
import SkillTreeCanvas, { type TierNode } from "@/components/skilltree/skill-tree-canvas";
import TrackXpBar from "@/components/skilltree/track-xp-bar";
import PerkDetailPanel, { type Perk } from "@/components/skilltree/perk-detail-panel";
import RespecDialog from "@/components/skilltree/respec-dialog";
import { trackMeta, type TrackId } from "@/components/skilltree/tokens";
import { usePerksCatalogue, useUserPerks, useSetTrack, useRespec } from "@/hooks/useProgress";
import type { UserProgress, VisibleSurfaces, PerkRow } from "@/lib/progress";

const TIER_THRESHOLDS = [100, 300, 700, 1500];
const ICONS: Record<string, LucideIcon> = {
  Sparkles, Star, Wand2, ShieldCheck, Compass, BookOpen,
};

export default function SkillTreeTab({
  progress,
  surfaces,
}: {
  progress: UserProgress | null;
  surfaces: VisibleSurfaces | undefined;
}) {
  const track = (surfaces?.track ?? null) as TrackId | null;
  const trackXp = (progress as any)?.track_xp ?? 0;
  const lastRespec = surfaces?.last_respec_at ?? null;

  const perksQ = usePerksCatalogue();
  const userPerksQ = useUserPerks();
  const setTrack = useSetTrack();
  const respec = useRespec();

  const [undecided, setUndecided] = useState(false);
  const [openTier, setOpenTier] = useState<number | null>(null);
  const [respecOpen, setRespecOpen] = useState(false);

  const allPerks = perksQ.data ?? [];
  const ownedSlugs = new Set((userPerksQ.data ?? []).map((p) => p.perk_slug));

  const trackPerks: PerkRow[] = useMemo(
    () => (track ? allPerks.filter((p) => p.track === track).sort((a, b) => a.tier - b.tier) : []),
    [allPerks, track],
  );

  const unlockedTier = useMemo(() => {
    let n = 0;
    for (const t of TIER_THRESHOLDS) if (trackXp >= t) n++; else break;
    return n;
  }, [trackXp]);

  // No track yet
  if (!track) {
    if (undecided) {
      return <TrackUndecidedState onChoose={() => setUndecided(false)} />;
    }
    const options: TrackOption[] = (Object.keys(trackMeta) as TrackId[]).map((id) => {
      const meta = trackMeta[id];
      const perksForTrack = allPerks.filter((p) => p.track === id).slice(0, 3).map((p) => p.name);
      return {
        id, name: meta.name, color: meta.color, philosophy: meta.philosophy,
        perks: perksForTrack.length ? perksForTrack : ["—"],
      };
    });
    return (
      <TrackPicker
        tracks={options}
        onChoose={(t) => setTrack.mutate(t)}
        onDefer={() => setUndecided(true)}
      />
    );
  }

  const meta = trackMeta[track];
  const tiers: TierNode[] = trackPerks.slice(0, 4).map((p, i) => ({
    tier: i + 1,
    perkName: p.name,
    perkIcon: ICONS[p.icon_name] ?? Sparkles,
  }));

  const selectedPerkRow = openTier ? trackPerks[openTier - 1] : null;
  const selectedPerk: Perk | null = selectedPerkRow
    ? {
        name: selectedPerkRow.name,
        icon: ICONS[selectedPerkRow.icon_name] ?? Sparkles,
        track,
        trackName: meta.name,
        trackColor: meta.color,
        tier: selectedPerkRow.tier,
        description: selectedPerkRow.description,
        unlocks: selectedPerkRow.effect_key,
      }
    : null;

  // Respec cooldown
  const canRespec = (() => {
    if (!lastRespec) return true;
    const diff = Date.now() - new Date(lastRespec).getTime();
    return diff >= 30 * 24 * 60 * 60 * 1000;
  })();
  const nextRespecDate = (() => {
    if (!lastRespec || canRespec) return undefined;
    const d = new Date(new Date(lastRespec).getTime() + 30 * 24 * 60 * 60 * 1000);
    return d.toLocaleDateString();
  })();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "rgba(255,255,255,0.55)" }}>
          Track: <span style={{ color: meta.color, fontWeight: 600 }}>{meta.name}</span>
        </div>
        <button
          onClick={() => setRespecOpen(true)}
          style={{
            background: "transparent", border: 0, padding: 0,
            color: "rgba(255,255,255,0.45)", fontSize: 12, cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          Switch path
        </button>
      </div>

      <TrackXpBar trackXp={trackXp} tierThresholds={TIER_THRESHOLDS} trackColor={meta.color} />

      <SkillTreeCanvas
        track={track}
        trackColor={meta.color}
        tiers={tiers}
        unlockedTier={unlockedTier}
        onNodeClick={(t) => setOpenTier(t)}
      />

      {selectedPerk && openTier && (
        <PerkDetailPanel
          perk={selectedPerk}
          trackXp={trackXp}
          requiredXp={TIER_THRESHOLDS[openTier - 1]}
          isUnlocked={ownedSlugs.has(selectedPerkRow!.slug) || unlockedTier >= openTier}
          onClose={() => setOpenTier(null)}
        />
      )}

      {respecOpen && (
        <RespecDialog
          currentTrack={track}
          canRespec={canRespec}
          nextRespecDate={nextRespecDate}
          onConfirm={() => {
            // Server-side: pick next track (cycle) — UI quick path; replace with proper picker later.
            const order: TrackId[] = ["architect", "curator", "mentor", "explorer"];
            const next = order[(order.indexOf(track) + 1) % order.length];
            respec.mutate(next, { onSettled: () => setRespecOpen(false) });
          }}
          onCancel={() => setRespecOpen(false)}
        />
      )}
    </div>
  );
}
