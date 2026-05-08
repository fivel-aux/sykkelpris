"use client";

import { useState } from "react";

// Add more paths here to extend the sequence — order is preserved.
const VIDEOS = ["/videos/hero.mp4", "/videos/hero_2.mp4"];

export function HeroVideo() {
  const [index, setIndex] = useState(0);

  return (
    <video
      key={index}
      autoPlay
      muted
      playsInline
      preload="none"
      poster="/videos/hero-poster.jpg"
      aria-hidden
      onEnded={() => setIndex((i) => (i + 1) % VIDEOS.length)}
      className="pointer-events-none absolute inset-0 h-full w-full object-cover"
    >
      <source src={VIDEOS[index]} type="video/mp4" />
    </video>
  );
}
