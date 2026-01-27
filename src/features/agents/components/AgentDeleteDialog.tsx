/**
 * File: src/features/agents/components/AgentDeleteDialog.tsx
 * 
 * Frontend: Confirmation dialog for deleting agents
 * - Replaces window.confirm with a proper UI component
 * - Better UX with clear messaging
 */

import { AlertCircle, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";

interface AgentDeleteDialogProps {
  isOpen: boolean;
  agentName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const AgentDeleteDialog = ({
  isOpen,
  agentName,
  onConfirm,
  onCancel,
}: AgentDeleteDialogProps) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
        >
          <Card className="w-full max-w-md shadow-xl">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/20">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <CardTitle className="text-lg">Delete Agent</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete <span className="font-semibold text-foreground">"{agentName}"</span>?
                This action cannot be undone.
              </p>
              
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={onConfirm}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
