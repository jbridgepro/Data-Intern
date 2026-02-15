/**
 * File: src/components/layout/ToolInfoSheet.tsx
 *
 * Front-end: Accessible, responsive info panel for tool headers.
 * Shows a plain-language overview, steps, optional AI section, and examples.
 * On mobile: bottom-sheet style; on desktop: centered modal.
 * Dismiss via Escape, overlay click, or Close button.
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Sparkles, ListOrdered, Lightbulb, ChevronDown, ChevronRight, ExternalLink, Settings } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

/** Link for AI setup: open a URL (e.g. Ollama) or navigate to an in-app tab (e.g. Settings) */
export interface ToolInfoSetupLink {
  label: string;
  /** External or internal URL; opens in new tab when present */
  url?: string;
  /** In-app tab to switch to (e.g. "settings"); dispatches filepro:navigate when present */
  navigateToTab?: string;
  /** When navigating to Settings, scroll to this section id (e.g. "ai-assistant") */
  section?: string;
}

/** Optional AI-specific content for tools that offer AI features */
export interface ToolInfoAISection {
  /** What the AI does in plain language */
  what: string;
  /** How to enable or set up AI (e.g. API key, enable in settings) */
  setup: string;
  /** Optional links for setup: Open Settings, Ollama, etc. */
  setupLinks?: ToolInfoSetupLink[];
  /** Example use cases when AI is enabled */
  examplesWithAi: string[];
  /** Example use cases when AI is not enabled */
  examplesWithoutAi: string[];
}

/** Structured content for the tool info sheet */
export interface ToolInfoContent {
  /** Short overview of what the tool does */
  overview: string;
  /** Step-by-step how to use the tool */
  steps: string[];
  /** Optional section for AI features */
  ai?: ToolInfoAISection;
  /** Optional short examples or use cases */
  examples?: string[];
}

export interface ToolInfoSheetProps {
  /** Tool title (e.g. "Folder Creation") */
  title: string;
  /** Structured content */
  content: ToolInfoContent;
  open: boolean;
  onClose: () => void;
}

/**
 * Renders an accessible modal/sheet with tool overview, steps, optional AI info, and examples.
 * Responsive: bottom-sheet on small screens, centered modal on larger.
 */
export function ToolInfoSheet({ title, content, open, onClose }: ToolInfoSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [aiSectionOpen, setAiSectionOpen] = useState(true);

  // Focus the close button when opened and restore focus on close (accessibility)
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const timer = requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });
    return () => {
      cancelAnimationFrame(timer);
      previouslyFocused?.focus();
    };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Portal to document.body so the sheet escapes Settings (and other) stacking contexts and appears on top
  const sheetContent = (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-9999 flex items-end justify-center sm:items-center"
          aria-modal="true"
          aria-labelledby="tool-info-title"
          role="dialog"
        >
          {/* Backdrop - click to close */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel: bottom sheet on mobile, centered on desktop */}
          <motion.div
            ref={panelRef}
            role="document"
            aria-describedby="tool-info-content"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
            className="relative z-10 w-full max-h-[85vh] sm:max-h-[80vh] sm:max-w-lg sm:rounded-xl rounded-t-xl bg-card border border-border shadow-xl flex flex-col"
          >
            {/* Header with close */}
            <div className="flex items-center justify-between gap-3 p-4 border-b border-border shrink-0">
              <h2 id="tool-info-title" className="font-semibold text-lg text-foreground">
                About {title}
              </h2>
              <Button
                ref={closeButtonRef}
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 shrink-0"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <ScrollArea id="tool-info-content" className="flex-1 overflow-y-auto">
              <div className="p-4 pt-2 space-y-6 pb-6">
                {/* Overview */}
                <section>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {content.overview}
                  </p>
                </section>

                {/* How to use */}
                <section>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
                    <ListOrdered className="h-4 w-4 text-primary" />
                    How to use
                  </h3>
                  <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground">
                    {content.steps.map((step, i) => (
                      <li key={i} className="leading-relaxed">
                        {step}
                      </li>
                    ))}
                  </ol>
                </section>

                {/* AI section (optional, collapsible) */}
                {content.ai && (
                  <section className="rounded-lg border border-border bg-muted/30 overflow-hidden">
                    <Collapsible
                      open={aiSectionOpen}
                      onOpenChange={setAiSectionOpen}
                    >
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 p-3 text-left hover:bg-muted/50 transition-colors"
                        >
                          {aiSectionOpen ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                          <Sparkles className="h-4 w-4 text-primary shrink-0" />
                          <span className="text-sm font-semibold text-foreground">
                            AI features
                          </span>
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="px-3 pb-3 space-y-3 border-t border-border/50 pt-3">
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {content.ai.what}
                          </p>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            <span className="font-medium text-foreground">Setup: </span>
                            {content.ai.setup}
                          </p>
                          {/* Setup links: Settings, local models (Ollama, etc.) */}
                          {content.ai.setupLinks && content.ai.setupLinks.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-foreground">
                                Quick links
                              </p>
                              <ul className="flex flex-wrap gap-2">
                                {content.ai.setupLinks.map((link, i) => (
                                  <li key={i}>
                                    {link.navigateToTab ? (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 gap-1.5 text-xs"
                                        onClick={() => {
                                          window.dispatchEvent(
                                            new CustomEvent("filepro:navigate", {
                                              detail: {
                                                tab: link.navigateToTab,
                                                section: link.section,
                                              },
                                            })
                                          );
                                          onClose();
                                        }}
                                      >
                                        <Settings className="h-3.5 w-3.5" />
                                        {link.label}
                                      </Button>
                                    ) : link.url ? (
                                      <a
                                        href={link.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
                                      >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                        {link.label}
                                      </a>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <div className="grid gap-2">
                            <p className="text-xs font-medium text-foreground">With AI enabled:</p>
                            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5">
                              {content.ai.examplesWithAi.map((ex, i) => (
                                <li key={i}>{ex}</li>
                              ))}
                            </ul>
                            <p className="text-xs font-medium text-foreground mt-1">Without AI:</p>
                            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5">
                              {content.ai.examplesWithoutAi.map((ex, i) => (
                                <li key={i}>{ex}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </section>
                )}

                {/* Examples (optional) */}
                {content.examples && content.examples.length > 0 && (
                  <section>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
                      <Lightbulb className="h-4 w-4 text-primary" />
                      Examples
                    </h3>
                    <ul className="list-disc list-inside space-y-0.5 text-sm text-muted-foreground">
                      {content.examples.map((ex, i) => (
                        <li key={i} className="leading-relaxed">
                          {ex}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            </ScrollArea>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return typeof document !== "undefined" ? createPortal(sheetContent, document.body) : null;
}
