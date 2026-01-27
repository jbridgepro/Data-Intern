/**
 * File: src/features/ai-assistant/components/ConfirmationButtons.tsx
 * 
 * Confirmation buttons component for chat messages.
 * Displays action buttons when AI asks for user confirmation.
 */

import { Check, X, Play, Edit2 } from "lucide-react";
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

/**
 * Detects if a message is asking for confirmation and extracts action options
 */
export function extractConfirmationActions(messageContent: string): ConfirmationAction[] {
  const actions: ConfirmationAction[] = [];
  const content = messageContent.toLowerCase();

  // Check for common confirmation patterns
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

  // Check if message asks for confirmation
  const asksForConfirmation = confirmationPatterns.some(p => p.pattern.test(messageContent));
  
  if (!asksForConfirmation) {
    // Check for explicit action requests
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

  // Check for modify/edit options
  if (content.includes("modify") || content.includes("edit") || content.includes("change")) {
    actions.push({
      label: "Modify",
      action: "modify",
      variant: "secondary",
      icon: <Edit2 className="h-3 w-3 mr-1.5" />,
    });
  }

  return actions;
}
