"use client";

import dynamic from "next/dynamic";

const SpaceParticles = dynamic(() => import("@/components/SpaceParticles"), {
  ssr: false,
});

export default function SpaceParticlesClient() {
  return <SpaceParticles />;
}