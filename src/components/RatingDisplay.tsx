import { Star, StarHalf } from "lucide-react";

interface Props {
  avgRating: number;
  ratingCount: number;
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

export function RatingDisplay({ avgRating, ratingCount }: Props) {
  if (ratingCount === 0) return null;

  const displayValue = roundedStars(avgRating, ratingCount);
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    if (i <= Math.floor(displayValue)) {
      stars.push(<Star key={i} className="h-4 w-4 fill-primary text-primary" />);
    } else if (i - 0.5 === displayValue) {
      stars.push(<StarHalf key={i} className="h-4 w-4 fill-primary text-primary" />);
    } else {
      stars.push(<Star key={i} className="h-4 w-4 text-muted-foreground/30" />);
    }
  }

  return (
    <div className="flex items-center gap-2 mb-2">
      <div className="flex gap-0.5">{stars}</div>
      <span className="text-[15px] font-bold text-foreground">{avgRating.toFixed(1)}</span>
      <span className="text-[13px] text-muted-foreground">· {ratingCount} rating{ratingCount !== 1 ? "s" : ""}</span>
    </div>
  );
}
