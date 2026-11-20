"use client";

const STAR_COLORS = ["#38bdf8", "#818cf8", "#60a5fa", "#ffffff"] as const;

function random(index: number, salt: number) {
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function makeStar(index: number, x: number, y: number) {
  return {
    x,
    y,
    size: 1.5 + random(index, 3) * 1.5,
    color: STAR_COLORS[Math.floor(random(index, 4) * STAR_COLORS.length)],
    duration: 2 + random(index, 5) * 3,
    delay: -random(index, 6) * 5,
  };
}

const SKY_STARS = Array.from({ length: 88 }, (_, index) =>
  makeStar(index, 1 + random(index, 1) * 98, 4 + random(index, 2) * 74),
);

const DOME_STARS = Array.from({ length: 44 }, (_, index) => {
  const seed = index + 200;
  const angle = random(seed, 1) * Math.PI;
  const spread = 0.3 + random(seed, 2) * 0.7;
  const x = 34 + Math.cos(angle) * spread * 19 + (random(seed, 7) - 0.5) * 5;
  const y = 47 - Math.sin(angle) * spread * 25 + (random(seed, 8) - 0.5) * 6;

  return makeStar(
    seed,
    Math.min(58, Math.max(12, x)),
    Math.min(56, Math.max(8, y)),
  );
});

const STARS = [...SKY_STARS, ...DOME_STARS];

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
            color: star.color,
            backgroundColor: star.color,
            animationDuration: `${star.duration}s`,
            animationDelay: `${star.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
