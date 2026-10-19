"use client";

import { getImageProps } from "next/image";

/** The `sizes` every TradingCard photo uses; preloading must ask for the same srcset. */
export const CARD_PHOTO_SIZES = "(min-width: 640px) 256px, 180px";
/** The reveal progress strip's thumbnails. */
export const THUMB_SIZES = "36px";

function preload(src: string, sizes: string) {
  const { props } = getImageProps({ src, alt: "", fill: true, sizes });
  const img = new window.Image();
  if (props.sizes) img.sizes = props.sizes;
  if (props.srcSet) img.srcset = props.srcSet;
  img.src = props.src;
  // decode() resolves once the pixels are ready to paint, not just downloaded.
  return img.decode().catch(() => undefined);
}

/**
 * Fetches and decodes the photos of the cards about to be revealed, so no card
 * ever turns over onto an empty photo window. Gives up waiting after `timeoutMs`
 * (a slow network shouldn't hold the reveal hostage); the downloads carry on.
 */
export function preloadCardPhotos(images: string[], timeoutMs = 4000): Promise<void> {
  const all = Promise.all(
    images.flatMap((src) => [preload(src, CARD_PHOTO_SIZES), preload(src, THUMB_SIZES)]),
  ).then(() => undefined);
  return Promise.race([all, new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))]);
}
