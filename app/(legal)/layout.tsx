import type { ReactNode } from "react";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <article className="mx-auto w-full max-w-2xl px-5 py-12 sm:px-6 sm:py-16 [&_a]:font-bold [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-4 [&_h1]:title-drop [&_h1]:font-display [&_h1]:text-[2rem] [&_h1]:leading-[1.05] sm:[&_h1]:text-[2.75rem] [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-xl [&_li]:mt-1.5 [&_p]:mt-3 [&_p]:leading-relaxed [&_p]:text-ink/85 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-ink/85">
      {children}
    </article>
  );
}
