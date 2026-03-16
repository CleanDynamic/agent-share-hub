import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Star, StarHalf } from "lucide-react";

interface Props {
  contentId: string;
  contentTitle: string;
  avgRating: number;
  ratingCount: number;
  isEligible: boolean; // user has unlocked this content
}

function roundedStars(avg: number, count: number): number {
  if (count === 0) return 0;
  if (avg >= 4.5) return 5;
  if (avg >= 4.1) return 4.5;
  if (avg >= 3.5) return 4;
  if (avg >= 3.1) return 3.5;
  if (avg >= 2.5) return 3;
  if (avg >= 2.1) return 2.5;
  if (avg >= 1.5) return 2;
  if (avg >= 1.1) return 1.5;
  return 1;
}

function DisplayStars({ value }: { value: number }) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    if (i <= Math.floor(value)) {
      stars.push(<Star key={i} className="h-4 w-4 fill-primary text-primary" />);
    } else if (i - 0.5 === value) {
      stars.push(<StarHalf key={i} className="h-4 w-4 fill-primary text-primary" />);
    } else {
      stars.push(<Star key={i} className="h-4 w-4 text-muted-foreground/30" />);
    }
  }
  return <div className="flex gap-0.5">{stars}</div>;
}

export function StarRating({ contentId, contentTitle, avgRating, ratingCount, isEligible }: Props) {
  const { isLoggedIn, user } = useAuth();
  const { toast } = useToast();
  const [localAvg, setLocalAvg] = useState(avgRating);
  const [localCount, setLocalCount] = useState(ratingCount);
  const [myRating, setMyRating] = useState<number | null>(null);
  const [hoverStar, setHoverStar] = useState(0);
  const [showInteractive, setShowInteractive] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch user's existing rating
  useEffect(() => {
    if (!isLoggedIn || !user) return;
    supabase
      .from("content_ratings" as any)
      .select("rating")
      .eq("content_id", contentId)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setMyRating((data as any).rating);
      });
  }, [isLoggedIn, user, contentId]);

  // Sync props
  useEffect(() => {
    setLocalAvg(avgRating);
    setLocalCount(ratingCount);
  }, [avgRating, ratingCount]);

  async function submitRating(n: number) {
    if (!user || submitting) return;
    setSubmitting(true);

    const existed = myRating !== null;
    // Optimistic update
    const newCount = existed ? localCount : localCount + 1;
    const oldTotal = localAvg * localCount;
    const newTotal = existed ? oldTotal - myRating! + n : oldTotal + n;
    const newAvg = newCount > 0 ? newTotal / newCount : 0;
    setMyRating(n);
    setLocalAvg(newAvg);
    setLocalCount(newCount);
    setShowInteractive(false);

    if (existed) {
      await supabase
        .from("content_ratings" as any)
        .update({ rating: n, updated_at: new Date().toISOString() } as any)
        .eq("content_id", contentId)
        .eq("user_id", user.id);
    } else {
      await supabase.from("content_ratings" as any).insert({
        content_id: contentId,
        user_id: user.id,
        rating: n,
      } as any);
    }

    // Log interaction
    await supabase.from("user_interactions" as any).insert({
      user_id: user.id,
      content_id: contentId,
      interaction_type: "rated",
      interaction_meta: { rating: n, title: contentTitle },
    } as any);

    toast({ title: "Rating saved", duration: 2000 });

    // Refresh from DB after 1 second
    setTimeout(async () => {
      const { data } = await supabase
        .from("content_items")
        .select("avg_rating, rating_count")
        .eq("id", contentId)
        .maybeSingle();
      if (data) {
        setLocalAvg(Number((data as any).avg_rating) || 0);
        setLocalCount((data as any).rating_count || 0);
      }
    }, 1000);

    setSubmitting(false);
  }

  const displayValue = roundedStars(localAvg, localCount);

  return (
    <div className="space-y-2">
      {/* Display stars */}
      <div className="flex items-center gap-2">
        <DisplayStars value={displayValue} />
        <span className="text-xs text-muted-foreground">
          {localCount === 0 ? "No ratings yet" : `(${localCount} rating${localCount !== 1 ? "s" : ""})`}
        </span>
      </div>

      {/* Interactive rating */}
      {isEligible && isLoggedIn && (
        <>
          {myRating && !showInteractive ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Your rating: {"★".repeat(myRating)}
              </span>
              <button
                onClick={() => setShowInteractive(true)}
                className="text-xs text-secondary hover:underline"
              >
                Change
              </button>
            </div>
          ) : (
            <div>
              {!myRating && <p className="text-xs text-muted-foreground mb-1">Rate this</p>}
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onMouseEnter={() => setHoverStar(n)}
                    onMouseLeave={() => setHoverStar(0)}
                    onClick={() => submitRating(n)}
                    disabled={submitting}
                    className="p-0.5 transition-transform hover:scale-110"
                  >
                    <Star
                      className={`h-5 w-5 transition-colors ${
                        n <= (hoverStar || myRating || 0)
                          ? "fill-primary text-primary"
                          : "text-muted-foreground/30"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
