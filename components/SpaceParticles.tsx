"use client";

const STAR_COLORS = ["#ffffff", "#22d3ee", "#6fd4ff", "#a855f7"] as const;

const STARS = Array.from({ length: 78 }, (_, index) => {
  const random = (salt: number) => {
    const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
    return value - Math.floor(value);
  };

  return {
    x: 2 + random(1) * 96,
    y: 3 + random(2) * 94,
    size: 1.2 + random(3) * 2,
    color: STAR_COLORS[Math.floor(random(4) * STAR_COLORS.length)],
    duration: 2.5 + random(5) * 3.5,
    delay: -random(6) * 6,
  };
});

export default function SpaceParticles() {
  return (
    <div className="zh-starfield" aria-hidden="true">
      {STARS.map((star, index) => (
        <span
          key={index}
          className="zh-starfield__star"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            backgroundColor: star.color,
            animationDuration: `${star.duration}s`,
            animationDelay: `${star.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
