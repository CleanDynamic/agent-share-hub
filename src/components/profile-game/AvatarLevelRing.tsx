import type { ReactNode } from "react";
import LevelRing from "./LevelRing";
import { useProfileGameData } from "@/hooks/useProfileGameData";
import { tokens } from "./tokens";

interface AvatarLevelRingProps {
  userId?: string | null;
  size?: number;
  children: ReactNode;
}

/**
 * Wrapper that overlays an XP ring around an existing avatar element.
 * Footprint = `size` × `size`; existing avatar markup is rendered inside.
 */
export function AvatarLevelRing({ userId, size = 32, children }: AvatarLevelRingProps) {
  const { data } = useProfileGameData(userId, { lite: true });
  const level = data?.level ?? 1;
  const progressPct = data?.progressPct ?? 0;
  return (
    <LevelRing level={level} progressPct={progressPct} size={size} color={tokens.xp}>
      {children}
    </LevelRing>
  );
}
