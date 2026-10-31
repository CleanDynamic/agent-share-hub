import { Suspense, createContext, lazy, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useLoadAtIdle } from "@/lib/routing/lazyHost";

/** SV-26 P2: the reblog window loads the first time a reader reblogs, or at idle. */
const loadHost = () => import("@/components/reblog/ReblogComposeHost");
const ReblogComposeHost = lazy(loadHost);

export interface ReblogTargetInput {
  id: string;
  slug?: string;
  title: string;
  description?: string | null;
  post_type?: string | null;
  content_type?: string | null;
  cover_image_url?: string | null;
  created_at?: string | null;
  creator_id?: string | null;
  author?: {
    display_name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
    id?: string | null;
  } | null;
  /** When reblogging an existing reblog, pass the reblog id here. */
  parent_reblog_id?: string | null;
  /** When reblogging an existing reblog, pass its root original post id here. */
  root_original_post_id?: string | null;
  /** When quote-reblogging an excerpt from the source post. */
  excerptContext?: {
    text: string;
    sourceBlockId?: string | null;
    sourceBlockTypeLabel?: string | null;
  } | null;
}

interface ReblogComposeContextValue {
  openReblog: (post: ReblogTargetInput) => void;
}

const Ctx = createContext<ReblogComposeContextValue | null>(null);

export function useReblogCompose() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useReblogCompose must be used within ReblogComposeProvider");
  return v;
}

export function ReblogComposeProvider({ children }: { children: ReactNode }) {
  const { isLoggedIn } = useAuth();
  const [target, setTarget] = useState<ReblogTargetInput | null>(null);
  useLoadAtIdle(loadHost);

  const openReblog = useCallback(
    (post: ReblogTargetInput) => {
      if (!isLoggedIn) {
        toast.error("Sign in to reblog");
        return;
      }
      setTarget(post);
    },
    [isLoggedIn]
  );
  const closeReblog = useCallback(() => setTarget(null), []);

  const value = useMemo(() => ({ openReblog }), [openReblog]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {target && (
        <Suspense fallback={null}>
          <ReblogComposeHost target={target} onClose={closeReblog} />
        </Suspense>
      )}
    </Ctx.Provider>
  );
}
