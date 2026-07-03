'use client';

import { useEffect, useRef } from 'react';

/**
 * Full-bleed hero loop. Plays + loops for every visitor (no reduced-motion gate —
 * this is the brand moment).
 *
 * Robust autoplay without a race: the media is small and often already cached, so
 * `canplay` can fire before React attaches a JSX handler. Instead we drive play()
 * from a `useEffect` (runs after hydration, ref guaranteed): play immediately if
 * the video is already ready, otherwise on the next `canplay`/`loadeddata`. A
 * one-shot retry on first pointer covers the rare browser that defers muted
 * autoplay. The poster shows only until the first frame is decoded.
 */
export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;

    const play = () => v.play().catch(() => {});
    if (v.readyState >= 2) play();
    v.addEventListener('canplay', play);
    v.addEventListener('loadeddata', play);

    const retry = () => play();
    window.addEventListener('pointerdown', retry, { once: true });

    return () => {
      v.removeEventListener('canplay', play);
      v.removeEventListener('loadeddata', play);
      window.removeEventListener('pointerdown', retry);
    };
  }, []);

  return (
    <video
      ref={ref}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      poster="/brand/hero-veil.png"
      className="absolute inset-0 h-full w-full object-cover object-[72%_center]"
    >
      <source src="/brand/hero-veil.mp4" type="video/mp4" />
    </video>
  );
}
