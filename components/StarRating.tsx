import { Star } from "lucide-react";

type StarRatingProps = {
  rating: number;
  reviewCount?: number;
  size?: "sm" | "md";
};

export default function StarRating({
  rating,
  reviewCount,
  size = "sm",
}: StarRatingProps) {
  const starSize = size === "md" ? 16 : 14;

  return (
    <div className={`star-rating star-rating--${size}`}>
      <div className="star-rating-stars" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            size={starSize}
            className={i < Math.floor(rating) ? "star-filled" : "star-empty"}
            fill={i < Math.floor(rating) ? "currentColor" : "none"}
          />
        ))}
      </div>
      {reviewCount !== undefined && (
        <span className="star-rating-count">({reviewCount.toLocaleString("en-US")})</span>
      )}
    </div>
  );
}
