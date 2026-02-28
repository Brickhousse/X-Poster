"use client";
import type { ReactNode } from "react";

interface TooltipProps {
  text: string;
  children: ReactNode;
  position?: "top" | "bottom";
  align?: "center" | "start" | "end";
}

export function Tooltip({ text, children, position = "top", align = "center" }: TooltipProps) {
  const alignClass =
    align === "start" ? "left-0" :
    align === "end"   ? "right-0" :
    "left-1/2 -translate-x-1/2";

  return (
    <div className="relative inline-flex group">
      {children}
      <span
        className={`pointer-events-none absolute ${alignClass} z-50
          whitespace-nowrap rounded-md bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-900
          opacity-0 transition-opacity duration-150 group-hover:opacity-100 shadow-lg
          ${position === "top" ? "bottom-full mb-2" : "top-full mt-2"}`}
      >
        {text}
      </span>
    </div>
  );
}
