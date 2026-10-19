"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/** Holds back the rest of a long list until the player asks for it. */
export function ShowMore({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  if (open) return children;
  return (
    <div className="mt-6 flex justify-center">
      <button type="button" onClick={() => setOpen(true)} className="btn btn-sm">
        <ChevronDown className="size-4" aria-hidden />
        {label}
      </button>
    </div>
  );
}
