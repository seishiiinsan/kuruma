import Image from "next/image";
import { packById } from "@/lib/packs";
import { DiscordButton } from "./discord-button";

const FLANK = [
  { id: "nuit-jdm", className: "-left-6 top-10 -rotate-12 sm:left-[6%]" },
  { id: "reve-americain", className: "-right-6 top-16 rotate-12 sm:right-[6%]" },
];

export function PlaySection() {
  return (
    <section className="relative overflow-hidden border-t border-white/10 bg-bg-deep/60 py-20 sm:py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(255_191_46/0.22),transparent_65%)]"
      />
      {FLANK.map(({ id, className }) => {
        const pack = packById(id)!;
        return (
          <span
            key={id}
            aria-hidden
            className={`absolute hidden aspect-[528/938] w-36 opacity-90 drop-shadow-[0_20px_18px_rgb(6_3_30/0.6)] md:block ${className}`}
          >
            <Image src={pack.image} alt="" fill sizes="144px" className="object-contain" />
          </span>
        );
      })}
      <div className="relative mx-auto flex max-w-2xl flex-col items-center px-5 text-center sm:px-6">
        <h2 className="title-drop text-balance font-display text-4xl sm:text-5xl">
          Ton garage t&apos;attend
        </h2>
        <p className="mt-4 max-w-md text-pretty text-lg font-semibold text-muted">
          Connecte-toi avec Discord : tes 10 premiers packs sont déjà prêts.
        </p>
        <DiscordButton label="Ouvrir mes premiers packs" className="mt-8" />
      </div>
    </section>
  );
}
