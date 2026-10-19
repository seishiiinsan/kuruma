import { TIERS, type CardTier } from "@/lib/cards";

export function RarityDiamonds({
  tier,
  size = 9,
}: {
  tier: CardTier;
  size?: number | string;
}) {
  const { diamonds, color, label } = TIERS[tier];
  return (
    <span
      role="img"
      aria-label={`Rareté : ${label}`}
      className="inline-flex items-center gap-[3px]"
    >
      {Array.from({ length: diamonds }, (_, i) => (
        <svg
          key={i}
          width={size}
          height={size}
          viewBox="0 0 10 10"
          aria-hidden
        >
          <path d="M5 0.6 9.4 5 5 9.4 0.6 5Z" fill={color} stroke="rgb(10 6 40 / 0.35)" strokeWidth="1" strokeLinejoin="round" />
        </svg>
      ))}
    </span>
  );
}
