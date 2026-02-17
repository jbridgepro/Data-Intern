/**
 * File: src/components/layout/PageHeader.tsx
 *
 * Front-end: Reusable page header used across all main feature pages.
 * Matches the pattern from Folder Creation and File Creation:
 * - Icon in primary-tinted box, title, subtitle on the left
 * - Optional Info button that opens a tool info sheet (overview, steps, examples)
 * - Favorite (star) toggle button to add/remove from sidebar Favorites
 * - Optional right-side actions (e.g. Reset, Search)
 */

import { useState } from "react";
import { Info, Star } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToolInfoSheet } from "./ToolInfoSheet";
import type { ToolInfoContent } from "./ToolInfoSheet";
import { useFavorites } from "@/contexts/FavoritesContext";
import { cn } from "@/lib/utils";

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
  /**
   * Unique tool/page identifier used for the Favorites toggle.
   * Must match the nav-item id used in the Sidebar (e.g. "mapper", "terminal",
   * "quick-tool:calculator"). When provided, a star button appears in the header.
   */
  toolId?: string;
}

/**
 * Renders a consistent page header for all main feature pages.
 * When info is provided, an Info button opens a lightweight sheet with tool overview and guidance.
 * When toolId is provided, a star button allows the user to favorite/unfavorite the page.
 */
export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  info,
  right,
  toolId,
}: PageHeaderProps) {
  const [infoOpen, setInfoOpen] = useState(false);
  const { isFavorite, toggleFavorite } = useFavorites();

  const isFavorited = toolId ? isFavorite(toolId) : false;

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
        <div className="flex items-center gap-1">
          {/* Favorite toggle button - placed next to the Info button for consistent layout */}
          {toolId && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => toggleFavorite(toolId)}
              className={cn(
                "h-8 w-8 transition-colors",
                isFavorited
                  ? "text-amber-400 hover:text-amber-500 dark:text-amber-300 dark:hover:text-amber-200"
                  : "text-muted-foreground/40 hover:text-amber-400 dark:hover:text-amber-300",
              )}
              aria-label={
                isFavorited ? "Remove from Favorites" : "Add to Favorites"
              }
              title={isFavorited ? "Remove from Favorites" : "Add to Favorites"}
            >
              <Star
                className="h-4 w-4"
                fill={isFavorited ? "currentColor" : "none"}
              />
            </Button>
          )}
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
          {right != null && (
            <div className="flex items-center gap-2 ml-1">{right}</div>
          )}
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
