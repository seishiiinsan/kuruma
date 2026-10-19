"use client";

import { useId, useState, type ReactNode } from "react";

export function Tabs({
  tabs,
}: {
  tabs: { label: string; count?: number; content: ReactNode }[];
}) {
  const [active, setActive] = useState(0);
  const id = useId();

  return (
    <div>
      <div
        role="tablist"
        className="mb-6 inline-flex rounded-2xl bg-bg-deep p-1 shadow-[inset_0_2px_4px_rgb(0_0_0/0.4)]"
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.label}
            type="button"
            role="tab"
            id={`${id}-tab-${index}`}
            aria-selected={active === index}
            aria-controls={`${id}-panel-${index}`}
            onClick={() => setActive(index)}
            className={`rounded-xl px-4 py-2.5 text-sm font-extrabold transition-colors ${
              active === index ? "bg-accent text-accent-ink shadow-[0_2px_0_var(--accent-edge)]" : "text-muted hover:text-ink"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-1.5 tabular-nums opacity-70">{tab.count}</span>
            )}
          </button>
        ))}
      </div>
      {tabs.map((tab, index) => (
        <div
          key={tab.label}
          role="tabpanel"
          id={`${id}-panel-${index}`}
          aria-labelledby={`${id}-tab-${index}`}
          hidden={active !== index}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
