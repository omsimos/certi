import { type RefObject, useRef } from "react";

// The elements one pointer-glow zone drives: the section, its etched background, the glow
// inside it, and the italic headline words that catch the same light.
export type GlowZone = {
  zone: RefObject<HTMLElement | null>;
  etch: RefObject<HTMLDivElement | null>;
  glow: RefObject<HTMLDivElement | null>;
  foil: RefObject<HTMLSpanElement | null>;
};

export function useGlowZone(): GlowZone {
  return {
    zone: useRef<HTMLElement>(null),
    etch: useRef<HTMLDivElement>(null),
    glow: useRef<HTMLDivElement>(null),
    foil: useRef<HTMLSpanElement>(null),
  };
}
