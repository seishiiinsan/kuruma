# Booster art

The twenty-one files in `public/booster/*.webp` are drawn by `pack-art.html` from one
template: crimped foil seals, the kuruma wordmark, a slanted photo window, the
name plate and a badge row (card count, perk). A pack only changes its colour,
its car (a real photo from the catalogue, duotoned in the pack colour), its
theme line and its perk. Premium packs add a gold rule; Légende a holo one.

Photos: the catalogue's own Wikimedia Commons photos (credits on each card page):
Lancia Stratos, Nissan Skyline GT-R, Porsche 911, Citroën DS, Dodge Charger,
Toyota Land Cruiser, Trabant 601, Aston Martin DB5, McLaren F1, and for the
auto show packs Mazda RX-7, Bugatti Type 35, Lamborghini Countach, Jaguar C-Type,
Ferrari F40, Alpine A110, Chevrolet Camaro.

To regenerate after a change:

1. `cp scripts/packs/pack-art.html public/__pack-art.html`
2. Add a dev-only route `app/api/dev-pack-art/route.ts` that writes the POSTed
   body to `public/booster/<id>.webp` (`?id=` query).
3. `next dev`, open `/__pack-art.html`, press « Tout enregistrer ».
4. Delete both temporary files. Keep colours in sync with `lib/packs.ts`.
