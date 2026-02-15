/**
 * File: src/components/common/EmptyState.tsx
 *
 * Reusable empty state component for features with no data
 * Provides consistent pattern: Icon + Title + Description + Action + Tips
 */

import * as React from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  tips?: Array<{ label: string; text: string }>;
  className?: string;
}

export const EmptyState = ({
  icon,
  title,
  description,
  action,
  tips,
  className = "",
}: EmptyStateProps) => {
  return (
    <div className={`flex-1 flex items-center justify-center p-8 ${className}`}>
      <Card className="max-w-lg glass-card border-slate-200/50 dark:border-slate-800/50">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
            {icon}
          </div>
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription className="text-sm mt-2">{description}</CardDescription>
        </CardHeader>

        {action && (
          <CardContent>
            <Button onClick={action.onClick} className="w-full" size="lg">
              {action.icon && <span className="mr-2">{action.icon}</span>}
              {action.label}
            </Button>
          </CardContent>
        )}

        {tips && tips.length > 0 && (
          <CardFooter className="flex-col items-start gap-2 text-xs text-slate-600 dark:text-slate-400 border-t border-slate-200/50 dark:border-slate-800/50 pt-4">
            {tips.map((tip, index) => (
              <div key={index} className="flex gap-2">
                <span className="font-semibold">{tip.label}:</span>
                <span>{tip.text}</span>
              </div>
            ))}
          </CardFooter>
        )}
      </Card>
    </div>
  );
};
