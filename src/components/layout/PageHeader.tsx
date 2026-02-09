/**
 * File: src/components/layout/PageHeader.tsx
 *
 * Front-end: Reusable page header used across all main feature pages.
 * Matches the pattern from Folder Creation and File Creation:
 * - Icon in primary-tinted box, title, subtitle on the left
 * - Optional Info button that opens a tool info sheet (overview, steps, examples)
 * - Optional right-side actions (e.g. Reset, Search)
 */

import { useState } from "react";
import { Info } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToolInfoSheet } from "./ToolInfoSheet";
import type { ToolInfoContent } from "./ToolInfoSheet";

export interface PageHeaderProps {
  /** Lucide icon component to show in the header */
  icon: LucideIcon;
  /** Main page title (e.g. "Folder Creation") */
  title: string;
  /** Short description shown below the title */
  subtitle: string;
  /** Optional content for the Info sheet (overview, steps, examples, AI section) */
  info?: ToolInfoContent;
  /** Optional content on the right (buttons, search, etc.) */
  right?: React.ReactNode;
}

/**
 * Renders a consistent page header for all main feature pages.
 * When info is provided, an Info button opens a lightweight sheet with tool overview and guidance.
 */
export function PageHeader({ icon: Icon, title, subtitle, info, right }: PageHeaderProps) {
  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <>
      <div className="p-4 border-b flex items-center justify-between bg-card/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-lg">{title}</h2>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {info != null && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setInfoOpen(true)}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              aria-label="Learn how to use this tool"
              title="How to use this tool"
            >
              <Info className="h-4 w-4" />
            </Button>
          )}
          {right != null && right}
        </div>
      </div>
      {info != null && (
        <ToolInfoSheet
          title={title}
          content={info}
          open={infoOpen}
          onClose={() => setInfoOpen(false)}
        />
      )}
    </>
  );
}
