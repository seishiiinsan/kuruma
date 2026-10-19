import { CardBack } from "@/components/reveal-card";

export default function Loading() {
  return (
    <section
      className="flex flex-1 items-center justify-center px-5 py-24"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center">
        <div className="pack-bob" style={{ "--tilt": "-6deg" } as React.CSSProperties} aria-hidden>
          <CardBack className="w-24" />
        </div>
        <p className="mt-8 font-display text-muted">Chargement…</p>
      </div>
    </section>
  );
}
