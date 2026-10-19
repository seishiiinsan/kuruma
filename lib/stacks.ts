import "server-only";
import type { Stack } from "@/components/game/collection-grid";
import type { Copy } from "./game";

/** Groups copies by car, lowest serial first (the one worth showing). */
export function toStacks(copies: Copy[]): Stack[] {
  const stacks = new Map<string, Stack>();
  for (const copy of copies) {
    const stack = stacks.get(copy.card.slug);
    if (stack) {
      stack.copies.push({ id: copy.id, serial: copy.serial });
      if (copy.obtainedAt > stack.lastObtained) stack.lastObtained = copy.obtainedAt;
    } else {
      stacks.set(copy.card.slug, {
        card: copy.card,
        copies: [{ id: copy.id, serial: copy.serial }],
        lastObtained: copy.obtainedAt,
      });
    }
  }
  for (const stack of stacks.values()) stack.copies.sort((a, b) => a.serial - b.serial);
  return [...stacks.values()];
}
