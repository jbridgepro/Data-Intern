/**
 * File: src/features/ai-assistant/voice/components/ClarificationPanel.tsx
 *
 * Component for displaying AI clarification questions and quick response options.
 */

import { Bot, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ClarificationQuestion } from "../types";

interface ClarificationPanelProps {
  questions: ClarificationQuestion[];
  onAnswer: (questionId: string, answer: any) => void;
  onSkip?: () => void;
}

export const ClarificationPanel = ({
  questions,
  onAnswer,
  onSkip,
}: ClarificationPanelProps) => {
  if (questions.length === 0) return null;

  return (
    <Card className="mb-4 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10">
      <CardContent className="p-4">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/20">
            <Bot className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold mb-1">I need a few details</h3>
            <p className="text-sm text-muted-foreground">
              To help you better, I have some questions:
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {questions.map((question, index) => (
            <div key={question.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {index + 1}. {question.question}
                </span>
                {question.required && (
                  <Badge variant="outline" className="text-xs">
                    Required
                  </Badge>
                )}
              </div>

              {question.type === "choice" && question.options && (
                <div className="flex flex-wrap gap-2">
                  {question.options.map((option, optIndex) => (
                    <Button
                      key={optIndex}
                      variant="outline"
                      size="sm"
                      onClick={() => onAnswer(question.id, option.value)}
                      className="text-left h-auto py-2 px-3"
                    >
                      <div>
                        <div className="font-medium">{option.label}</div>
                        {option.description && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {option.description}
                          </div>
                        )}
                      </div>
                    </Button>
                  ))}
                </div>
              )}

              {question.type === "text" && (
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
                  placeholder="Type your answer..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      onAnswer(
                        question.id,
                        (e.target as HTMLInputElement).value,
                      );
                    }
                  }}
                />
              )}

              {question.type === "path" && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
                    placeholder="Enter path..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        onAnswer(
                          question.id,
                          (e.target as HTMLInputElement).value,
                        );
                      }
                    }}
                  />
                  <Button variant="outline" size="sm">
                    Browse
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>

        {onSkip && (
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <Button variant="ghost" size="sm" onClick={onSkip}>
              Skip (use defaults)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
