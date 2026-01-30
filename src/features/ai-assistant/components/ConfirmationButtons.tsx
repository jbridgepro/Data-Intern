/**
 * File: src/features/ai-assistant/components/ConfirmationButtons.tsx
 *
 * Confirmation buttons component for chat messages.
 * Displays context-aware action buttons when the AI asks for confirmation
 * or presents explicit choices (e.g. file type, format, options).
 */

import { Check, X, Play, Edit2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export interface ConfirmationAction {
  label: string;
  action: string; // The command to send when clicked
  variant?: "default" | "outline" | "destructive" | "secondary";
  icon?: React.ReactNode;
}

interface ConfirmationButtonsProps {
  actions: ConfirmationAction[];
  onAction: (action: string) => void;
  className?: string;
}

export const ConfirmationButtons = ({
  actions,
  onAction,
  className,
}: ConfirmationButtonsProps) => {
  if (actions.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("mt-4 pt-3 border-t border-slate-200 dark:border-slate-800", className)}
    >
      <div className="flex flex-wrap gap-2">
        {actions.map((action, index) => (
          <Button
            key={index}
            variant={action.variant || "default"}
            size="sm"
            className="h-8 text-xs"
            onClick={() => onAction(action.action)}
          >
            {action.icon || (action.variant === "destructive" ? <X className="h-3 w-3 mr-1.5" /> : <Check className="h-3 w-3 mr-1.5" />)}
            {action.label}
          </Button>
        ))}
      </div>
    </motion.div>
  );
};

/** Patterns that indicate the AI is asking the user to choose from explicit options. */
const CHOICE_QUESTION_PATTERNS = [
  /what\s+type\s+of\s+(?:file|format)[^?]*(?:would\s+you\s+like|do\s+you\s+want)/i,
  /which\s+(?:file\s+type|format|option)[^?]*(?:would\s+you\s+like|do\s+you\s+want|would\s+you\s+prefer)/i,
  /(?:would\s+you\s+like|do\s+you\s+want)\s+(?:a|for)\s+[^?]*(?:\.\w+|file\s+type|format)/i,
  /choose\s+(?:one|a|your)\s+(?:file\s+type|format|option)/i,
  /(?:options?|choices?)\s*[:–-]/i,
  /you\s+can\s+(?:select|choose)\s+(?:from\s+)?(?:the\s+)?(?:following\s+)?(?:options?|formats?)/i,
  /or\s+tell\s+me\s+another\s+(?:format|type|option)/i,
];

/** List-item patterns: "**.txt** - Plain text" or "- .txt - Plain text", etc. */
const LIST_OPTION_PATTERNS = [
  // **.txt** - Plain text (optional leading bullet)
  /(?:^|[\n\r])\s*(?:[-•*]\s*)?\*\*([^*]+)\*\*\s*[-–—:]\s*(.+?)(?=[\n\r]|$)/g,
  // - .txt - Plain text or • .txt - Plain text
  /(?:^|[\n\r])\s*[-•*]\s+([.**\w]+)\s+[-–—:]\s*(.+?)(?=[\n\r]|$)/g,
];

/**
 * Messages matching these patterns are open-ended or completion reports.
 * Do not show confirmation buttons (Yes/No, etc.) for them.
 */
const NO_CONFIRMATION_PATTERNS = [
  /what\s+would\s+you\s+like\s+to\s+do\b/i,
  /what\s+do\s+you\s+want\s+to\s+do\b/i,
  /\banything\s+else\b/i,
  /\bwhat\s+else\b/i,
  /\bwhat\s+next\b/i,
  /how\s+else\s+can\s+I\s+help\b/i,
  /what\s+can\s+I\s+do\s+(?:for\s+you|next)?\b/i,
];

/**
 * Detects choice-style questions (e.g. "What type of file would you like?")
 * and parses explicitly listed options into button actions.
 * Returns actions for each option plus optional "Other" and "Cancel".
 */
function extractChoiceOptions(messageContent: string): ConfirmationAction[] {
  const content = messageContent.trim();
  const contentLower = content.toLowerCase();

  const hasChoiceQuestion = CHOICE_QUESTION_PATTERNS.some((pattern) => pattern.test(content));
  if (!hasChoiceQuestion) return [];

  const options: Array<{ key: string; description: string }> = [];
  const seenKeys = new Set<string>();

  // Parse list-style options from the message (**.txt** - Plain text, - .txt - Plain text, etc.)
  for (const pattern of LIST_OPTION_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      const rawKey = match[1].trim();
      const description = match[2].trim();
      const cleanKey = rawKey.replace(/^\*\*(.+)\*\*$/, "$1").trim() || rawKey;
      const normalizedKey = cleanKey.toLowerCase();
      if (description.length > 0 && !seenKeys.has(normalizedKey)) {
        seenKeys.add(normalizedKey);
        options.push({ key: cleanKey, description });
      }
    }
  }

  // "Or tell me another format" / "or another format" etc. → add "Other" option
  const hasOtherOption =
    /or\s+tell\s+me\s+another\s+(?:format|type|option)/i.test(content) ||
    /or\s+another\s+(?:format|type|option)/i.test(content) ||
    /\bor\s+other\s+format\b/i.test(contentLower);

  if (options.length === 0 && !hasOtherOption) return [];

  const actions: ConfirmationAction[] = [];
  const isFileType = (k: string) => /^\.?\w+$/.test(k) && (k.startsWith(".") || /\.(txt|md|docx?|pdf|json|csv|html|js|ts|tsx|jsx)$/i.test(k));

  for (const { key, description } of options) {
    const label = description ? `${description} (${key})` : key;
    actions.push({
      label,
      action: key,
      variant: "default",
      icon: isFileType(key) ? <FileText className="h-3 w-3 mr-1.5" /> : undefined,
    });
  }

  if (hasOtherOption) {
    actions.push({
      label: "Other format",
      action: "another format",
      variant: "secondary",
      icon: <Edit2 className="h-3 w-3 mr-1.5" />,
    });
  }

  actions.push({
    label: "Cancel",
    action: "cancel",
    variant: "outline",
    icon: <X className="h-3 w-3 mr-1.5" />,
  });

  return actions;
}

/**
 * Detects if a message is asking for confirmation and extracts action options.
 * Prefers context-aware choice options (e.g. file types) when present;
 * otherwise falls back to confirmation/cancel or explicit action requests.
 */
export function extractConfirmationActions(messageContent: string): ConfirmationAction[] {
  const choiceActions = extractChoiceOptions(messageContent);
  if (choiceActions.length > 0) return choiceActions;

  if (NO_CONFIRMATION_PATTERNS.some((pattern) => pattern.test(messageContent))) {
    return [];
  }

  const actions: ConfirmationAction[] = [];
  const content = messageContent.toLowerCase();

  // Common confirmation patterns (yes/no, proceed/cancel, etc.)
  const confirmationPatterns = [
    {
      pattern: /(?:please|kindly|can you|would you)\s+(?:respond|say|type|confirm|approve|proceed)/i,
      positiveActions: ["yes", "approve", "confirm", "proceed", "go ahead", "do it"],
      negativeActions: ["no", "cancel", "stop", "abort"],
    },
    {
      pattern: /(?:respond|say|type|confirm)\s+(?:with|using)\s+["']?(yes|no|approve|cancel)["']?/i,
      positiveActions: ["yes", "approve"],
      negativeActions: ["no", "cancel"],
    },
    {
      pattern: /(?:would you like|do you want|should i)/i,
      positiveActions: ["yes", "please", "go ahead"],
      negativeActions: ["no", "cancel"],
    },
  ];

  const asksForConfirmation = confirmationPatterns.some((p) => p.pattern.test(messageContent));

  if (!asksForConfirmation) {
    // Explicit action requests (e.g. "type `create`", "type `confirm`")
    if (content.includes("type `create`") || content.includes("type 'create'") || content.includes("type create")) {
      actions.push({
        label: "Create",
        action: "create",
        variant: "default",
        icon: <Play className="h-3 w-3 mr-1.5" />,
      });
      actions.push({
        label: "Cancel",
        action: "cancel",
        variant: "outline",
        icon: <X className="h-3 w-3 mr-1.5" />,
      });
    } else if (content.includes("type `confirm`") || content.includes("type 'confirm'") || content.includes("type confirm")) {
      actions.push({
        label: "Confirm",
        action: "confirm",
        variant: "default",
        icon: <Check className="h-3 w-3 mr-1.5" />,
      });
      actions.push({
        label: "Cancel",
        action: "cancel",
        variant: "outline",
        icon: <X className="h-3 w-3 mr-1.5" />,
      });
    } else if (content.includes("say") && (content.includes("yes") || content.includes("approve"))) {
      actions.push({
        label: "Yes, proceed",
        action: "yes",
        variant: "default",
        icon: <Check className="h-3 w-3 mr-1.5" />,
      });
      actions.push({
        label: "No, cancel",
        action: "no",
        variant: "outline",
        icon: <X className="h-3 w-3 mr-1.5" />,
      });
    }
  } else {
    // Standard confirmation flow
    actions.push({
      label: "Yes, proceed",
      action: "yes",
      variant: "default",
      icon: <Check className="h-3 w-3 mr-1.5" />,
    });
    actions.push({
      label: "No, cancel",
      action: "no",
      variant: "outline",
      icon: <X className="h-3 w-3 mr-1.5" />,
    });
  }

  // Optional "Modify" when the message mentions modify/edit/change
  if (actions.length > 0 && (content.includes("modify") || content.includes("edit") || content.includes("change"))) {
    actions.push({
      label: "Modify",
      action: "modify",
      variant: "secondary",
      icon: <Edit2 className="h-3 w-3 mr-1.5" />,
    });
  }

  return actions;
}
