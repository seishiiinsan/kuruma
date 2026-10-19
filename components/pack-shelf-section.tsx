import Image from "next/image";
import { PACKS, packSize } from "@/lib/packs";

/** The nine boosters on one shelf: one design, one colour per car culture. */
export function PackShelfSection() {
  return (
    <section className="overflow-hidden py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="title-drop text-balance font-display text-3xl sm:text-[2.6rem] sm:leading-[1.1]">
            Un booster par culture auto
          </h2>
          <p className="mt-4 text-pretty text-muted">
            Six packs gratuits, chacun avec sa scène qui sort quatre fois plus souvent, et trois packs
            premium à ouvrir avec les jetons gagnés en jouant.
          </p>
        </div>

        <ul className="mt-12 grid grid-cols-3 gap-x-3 gap-y-8 sm:grid-cols-5 lg:grid-cols-9 lg:gap-x-4">
          {PACKS.map((pack, i) => (
            <li key={pack.id} className="flex flex-col items-center text-center">
              <span
                className="pack-bob relative block aspect-[528/938] w-full max-w-28 drop-shadow-[0_16px_14px_rgb(6_3_30/0.6)]"
                style={{ animationDelay: `${-i * 0.37}s`, ["--tilt" as string]: `${(i % 3) - 1}deg` }}
              >
                <Image src={pack.image} alt={`Booster ${pack.name}`} fill sizes="(min-width: 1024px) 112px, 30vw" className="object-contain" />
              </span>
              <span className="mt-3 text-sm font-black leading-tight">{pack.name}</span>
              <span className="mt-0.5 text-xs font-bold text-muted">
                {pack.free ? "Gratuit" : "Premium"} · {packSize(pack)} cartes
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
