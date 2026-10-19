"use client";

import { useSyncExternalStore } from "react";

let cached: boolean | null = null;

function probe() {
  if (cached !== null) return cached;
  try {
    const canvas = document.createElement("canvas");
    cached = Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    cached = false;
  }
  return cached;
}

const noop = () => () => {};

/** True once mounted on a device that can draw WebGL; false on the server and on fallback devices. */
export function useWebGL() {
  return useSyncExternalStore(noop, probe, () => false);
}

/** Tier colours as linear RGB triples for shaders (match --tier-* in globals.css). */
export const TIER_RGB = {
  common: [0.54, 0.565, 0.65],
  rare: [0.231, 0.486, 1],
  epic: [0.608, 0.361, 1],
  legendary: [0.914, 0.663, 0.047],
} as const;

export function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
