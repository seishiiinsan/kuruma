import { CATALOGUE_SIZE } from "@/lib/catalog";
import { HERO, demoPool } from "@/lib/showcase";
import { HeroSection } from "@/components/hero-section";
import { BoosterSection } from "@/components/booster-section";
import { FeaturesSection } from "@/components/features-section";
import { PackShelfSection } from "@/components/pack-shelf-section";
import { PlaySection } from "@/components/play-section";

export default function Home() {
  return (
    <>
      <HeroSection cards={HERO()} catalogueSize={CATALOGUE_SIZE} />
      <BoosterSection pool={demoPool()} catalogueSize={CATALOGUE_SIZE} />
      <PackShelfSection />
      <FeaturesSection />
      <PlaySection />
    </>
  );
}
