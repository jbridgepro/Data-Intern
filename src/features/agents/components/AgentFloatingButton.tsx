/**
 * File: src/features/agents/components/AgentFloatingButton.tsx
 *
 * Floating button to toggle agent sidebar (alternative to sidebar button).
 */

import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAgentManager } from "../hooks/useAgentManager";

interface AgentFloatingButtonProps {
  onClick: () => void;
  isOpen: boolean;
}

export const AgentFloatingButton = ({
  onClick,
  isOpen,
}: AgentFloatingButtonProps) => {
  const { getRunningAgents } = useAgentManager();
  const runningAgents = getRunningAgents();
  const hasRunningAgents = runningAgents.length > 0;

  if (isOpen) return null; // Hide when sidebar is open

  return (
    <Button
      onClick={onClick}
      className={cn(
        "fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50",
        "bg-blue-600 hover:bg-blue-700 text-white",
        "transition-all duration-200",
        hasRunningAgents && "animate-pulse",
      )}
      size="lg"
    >
      <div className="relative">
        <Bot className="h-6 w-6" />
        {hasRunningAgents && (
          <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center bg-green-500 text-white text-xs">
            {runningAgents.length}
          </Badge>
        )}
      </div>
    </Button>
  );
};
