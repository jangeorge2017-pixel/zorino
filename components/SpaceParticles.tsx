"use client";

import type { CSSProperties } from "react";

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
    colorIndex: Math.floor(random(index, 4) * STAR_COLORS.length),
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

const DRIFT_PARTICLES = Array.from({ length: 28 }, (_, index) => {
  const seed = index + 500;
  const driftX = -(26 + random(seed, 1) * 22);
  const driftY = -4 + random(seed, 2) * 8;

  return {
    x: 76 + random(seed, 3) * 19,
    y: 36 + random(seed, 4) * 20,
    size: 1.5 + random(seed, 5) * 1.5,
    colorIndex: Math.floor(random(seed, 6) * STAR_COLORS.length),
    duration: 6 + random(seed, 7) * 6,
    delay: -random(seed, 8) * 12,
    midX: driftX * 0.55,
    midY: driftY + (random(seed, 9) - 0.5) * 6,
    endX: driftX,
    endY: driftY,
    peak: 0.7 + random(seed, 10) * 0.2,
  };
});

export default function SpaceParticles() {
  return (
    <>
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
              color: STAR_COLORS[star.colorIndex],
              backgroundColor: STAR_COLORS[star.colorIndex],
              animationDuration: `${star.duration}s`,
              animationDelay: `${star.delay}s`,
            }}
          />
        ))}
      </div>
      <div className="zh-driftfield" aria-hidden="true">
        {DRIFT_PARTICLES.map((particle, index) => (
          <span
            key={index}
            className="zh-driftfield__particle"
            style={
              {
                left: `${particle.x}%`,
                top: `${particle.y}%`,
                width: `${particle.size}px`,
                height: `${particle.size}px`,
                color: STAR_COLORS[particle.colorIndex],
                backgroundColor: STAR_COLORS[particle.colorIndex],
                animationDuration: `${particle.duration}s`,
                animationDelay: `${particle.delay}s`,
                "--zh-drift-mid-x": `${particle.midX}vw`,
                "--zh-drift-mid-y": `${particle.midY}vh`,
                "--zh-drift-end-x": `${particle.endX}vw`,
                "--zh-drift-end-y": `${particle.endY}vh`,
                "--zh-drift-peak": particle.peak,
              } as CSSProperties
            }
          />
        ))}
      </div>
    </>
  );
}
