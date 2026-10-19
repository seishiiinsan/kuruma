import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="title-drop text-balance font-display text-[2rem] leading-[1.05] sm:text-[2.75rem]">
          {title}
        </h1>
        {description && <p className="mt-3 max-w-xl text-pretty text-muted">{description}</p>}
      </div>
      {action && <div className="self-start sm:self-auto">{action}</div>}
    </div>
  );
}

/** Section heading inside a page: display face, smaller. */
export function SectionTitle({
  children,
  detail,
  count,
  id,
}: {
  children: ReactNode;
  detail?: ReactNode;
  /** A tally set in muted next to the title. */
  count?: ReactNode;
  id?: string;
}) {
  return (
    <div>
      <h2 id={id} className="title-drop font-display text-xl sm:text-2xl">
        {children}
        {count !== undefined && <span className="ml-2 text-muted tabular-nums">{count}</span>}
      </h2>
      {detail && <p className="mt-1.5 max-w-2xl text-pretty text-sm text-muted">{detail}</p>}
    </div>
  );
}

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`panel ${className}`}>{children}</div>;
}

/** Sunken slot for "nothing here yet", with the next step to take. */
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="panel-sunken flex flex-col items-center gap-3 px-6 py-14 text-center">
      <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden className="text-line">
        <path d="M20 3 37 20 20 37 3 20Z" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
        <path d="M20 13 27 20 20 27 13 20Z" fill="currentColor" />
      </svg>
      <p className="font-display text-lg">{title}</p>
      {children && <p className="max-w-sm text-pretty text-sm text-muted">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Loading placeholder with the panel's shape. */
export function Skeleton({ className = "h-96" }: { className?: string }) {
  return <div className={`panel-sunken animate-pulse ${className}`} />;
}

export const buttonPrimary = "btn btn-gold";
export const buttonInk = "btn btn-blue";
export const buttonGhost = "btn";
export const buttonDanger = "btn btn-danger";
export const buttonClaim = "btn btn-green";

export const formatScore = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
