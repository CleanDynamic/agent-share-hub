import { useQuery } from "@tanstack/react-query";
import { getProfileGameData } from "@/lib/profile-game/getProfileGameData";

export function useProfileGameData(userId: string | null | undefined, opts?: { lite?: boolean }) {
  const lite = opts?.lite ?? false;
  return useQuery({
    queryKey: ["profile-game", userId, lite ? "lite" : "full"],
    queryFn: () => getProfileGameData(userId!),
    enabled: !!userId,
    staleTime: lite ? 60_000 : 30_000,
    gcTime: lite ? 300_000 : 120_000,
  });
}
