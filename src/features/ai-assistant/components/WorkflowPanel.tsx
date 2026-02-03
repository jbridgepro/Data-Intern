/**
 * File: src/features/ai-assistant/components/WorkflowPanel.tsx
 *
 * Frontend: Workflow Templates Panel for managing and executing workflows.
 * Displays workflow library, execution status, and template management.
 */

import { useState, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  Square,
  Plus,
  Trash2,
  Edit,
  Copy,
  Star,
  StarOff,
  FolderTree,
  Calendar,
  Archive,
  FileEdit,
  FolderPlus,
  Wrench,
  X,
  ChevronRight,
  ChevronDown,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Search,
  Filter,
  Download,
  Upload,
  MoreVertical,
  Zap,
  Settings,
  Eye,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { workflowManager, BUILTIN_TEMPLATES } from "../utils/workflowManager";
import type {
  Workflow,
  WorkflowCategory,
  WorkflowExecution,
  WorkflowTemplate,
  WorkflowParameter,
} from "../types";

/**
 * Props for the WorkflowPanel component.
 */
interface WorkflowPanelProps {
  onClose?: () => void;
  onExecuteWorkflow?: (
    workflowId: string,
    parameters: Record<string, any>,
  ) => Promise<void>;
  compact?: boolean;
}

/**
 * Workflow Panel Component
 * Main interface for managing and executing workflow templates.
 */
export const WorkflowPanel = ({
  onClose,
  onExecuteWorkflow,
  compact = false,
}: WorkflowPanelProps) => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(
    null,
  );
  const [currentExecution, setCurrentExecution] =
    useState<WorkflowExecution | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<
    WorkflowCategory | "all"
  >("all");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [parameterValues, setParameterValues] = useState<Record<string, any>>(
    {},
  );
  const [isExecuting, setIsExecuting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(
    null,
  );

  // Load workflows and subscribe to changes
  useEffect(() => {
    const loadWorkflows = async () => {
      await workflowManager.initialize();
      setWorkflows(workflowManager.getAllWorkflows());
    };

    loadWorkflows();

    const unsubscribeWorkflows = workflowManager.addWorkflowListener(
      (newWorkflows) => {
        setWorkflows([...newWorkflows]);
      },
    );

    const unsubscribeExecution = workflowManager.addExecutionListener(
      (execution) => {
        setCurrentExecution(execution);
        if (
          execution.status === "completed" ||
          execution.status === "failed" ||
          execution.status === "cancelled"
        ) {
          setIsExecuting(false);
        }
      },
    );

    return () => {
      unsubscribeWorkflows();
      unsubscribeExecution();
    };
  }, []);

  // Reset parameters when workflow changes
  useEffect(() => {
    if (selectedWorkflow) {
      const defaults: Record<string, any> = {};
      selectedWorkflow.parameters.forEach((param) => {
        defaults[param.name] = param.defaultValue;
      });
      setParameterValues(defaults);
    }
  }, [selectedWorkflow]);

  // Filter workflows
  const filteredWorkflows = workflows.filter((workflow) => {
    if (showFavoritesOnly && !workflow.isFavorite) return false;
    if (categoryFilter !== "all" && workflow.category !== categoryFilter)
      return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        workflow.name.toLowerCase().includes(query) ||
        workflow.description.toLowerCase().includes(query) ||
        workflow.tags.some((t) => t.toLowerCase().includes(query))
      );
    }
    return true;
  });

  // Get category icon
  const getCategoryIcon = (category: WorkflowCategory) => {
    switch (category) {
      case "organization":
        return <FolderTree className="h-4 w-4" />;
      case "cleanup":
        return <Trash2 className="h-4 w-4" />;
      case "backup":
        return <Archive className="h-4 w-4" />;
      case "migration":
        return <FileEdit className="h-4 w-4" />;
      case "analysis":
        return <Eye className="h-4 w-4" />;
      case "development":
        return <FolderPlus className="h-4 w-4" />;
      case "custom":
        return <Wrench className="h-4 w-4" />;
      default:
        return <Zap className="h-4 w-4" />;
    }
  };

  // Handle workflow execution
  const handleExecute = useCallback(async () => {
    if (!selectedWorkflow || isExecuting) return;

    setIsExecuting(true);

    try {
      if (onExecuteWorkflow) {
        await onExecuteWorkflow(selectedWorkflow.id, parameterValues);
      } else {
        // Default execution (would need a tool executor)
        console.log(
          "Executing workflow:",
          selectedWorkflow.name,
          parameterValues,
        );
      }
    } catch (error) {
      console.error("Workflow execution failed:", error);
    } finally {
      setIsExecuting(false);
    }
  }, [selectedWorkflow, parameterValues, isExecuting, onExecuteWorkflow]);

  // Handle creating from template
  const handleCreateFromTemplate = useCallback((template: WorkflowTemplate) => {
    const newWorkflow = workflowManager.createFromTemplate(template.id);
    if (newWorkflow) {
      setSelectedWorkflow(newWorkflow);
      setShowTemplates(false);
    }
  }, []);

  // Handle toggle favorite
  const handleToggleFavorite = useCallback((id: string) => {
    workflowManager.toggleFavorite(id);
  }, []);

  // Handle duplicate
  const handleDuplicate = useCallback((id: string) => {
    const newWorkflow = workflowManager.duplicateWorkflow(id);
    if (newWorkflow) {
      setSelectedWorkflow(newWorkflow);
    }
  }, []);

  // Handle delete
  const handleDelete = useCallback(
    (id: string) => {
      workflowManager.deleteWorkflow(id);
      if (selectedWorkflow?.id === id) {
        setSelectedWorkflow(null);
      }
      setShowDeleteConfirm(null);
    },
    [selectedWorkflow],
  );

  // Handle export
  const handleExport = useCallback(() => {
    const data = workflowManager.exportWorkflows();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `workflows-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  // Render parameter input
  const renderParameterInput = (param: WorkflowParameter) => {
    const value = parameterValues[param.name] ?? param.defaultValue;

    switch (param.type) {
      case "boolean":
        return (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={param.name}
              checked={Boolean(value)}
              onChange={(e) =>
                setParameterValues((prev) => ({
                  ...prev,
                  [param.name]: e.target.checked,
                }))
              }
              className="rounded"
              title={param.label}
              aria-label={param.label}
            />
            <Label htmlFor={param.name}>{param.label}</Label>
          </div>
        );

      case "select":
        return (
          <Select
            value={String(value)}
            onValueChange={(v) =>
              setParameterValues((prev) => ({ ...prev, [param.name]: v }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {param.options?.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "number":
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) =>
              setParameterValues((prev) => ({
                ...prev,
                [param.name]: Number(e.target.value),
              }))
            }
            placeholder={param.placeholder}
          />
        );

      default:
        return (
          <Input
            value={value || ""}
            onChange={(e) =>
              setParameterValues((prev) => ({
                ...prev,
                [param.name]: e.target.value,
              }))
            }
            placeholder={
              param.placeholder || `Enter ${param.label.toLowerCase()}`
            }
          />
        );
    }
  };

  // Compact view
  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Workflows</span>
          </div>
          <Badge variant="outline">{workflows.length}</Badge>
        </div>

        {workflows.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            No workflows yet. Create one to get started.
          </p>
        ) : (
          <div className="space-y-1">
            {workflows.slice(0, 5).map((wf) => (
              <div
                key={wf.id}
                className="flex items-center gap-2 p-2 rounded-md bg-slate-50 dark:bg-slate-800/50 text-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50"
                onClick={() => setSelectedWorkflow(wf)}
              >
                {getCategoryIcon(wf.category || "custom")}
                <span className="flex-1 truncate">{wf.name}</span>
                {wf.isFavorite && (
                  <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Full panel view
  return (
    <div className="w-96 border-l border-slate-200/50 dark:border-slate-800/50 flex flex-col h-full bg-slate-50 dark:bg-slate-900/50">
      <Card className="rounded-none border-0 border-b h-full flex flex-col">
        <CardHeader className="shrink-0 flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Workflows
            </CardTitle>
            <CardDescription>
              {workflows.length} workflows • {BUILTIN_TEMPLATES.length}{" "}
              templates
            </CardDescription>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </CardHeader>

        <CardContent className="flex-1 min-h-0 overflow-hidden flex flex-col p-4">
          {/* Current Execution Status */}
          {currentExecution && currentExecution.status === "running" && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <span className="font-medium text-sm">
                  Running: {currentExecution.workflowName}
                </span>
              </div>
              <Progress
                value={
                  (currentExecution.currentStep / currentExecution.totalSteps) *
                  100
                }
                className="h-2"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>
                  Step {currentExecution.currentStep + 1} of{" "}
                  {currentExecution.totalSteps}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-2 text-red-600"
                  onClick={() => workflowManager.cancelExecution()}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Search and Filters */}
          <div className="space-y-3 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search workflows..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex gap-2">
              <Select
                value={categoryFilter}
                onValueChange={(v) => setCategoryFilter(v as any)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="organization">Organization</SelectItem>
                  <SelectItem value="cleanup">Cleanup</SelectItem>
                  <SelectItem value="backup">Backup</SelectItem>
                  <SelectItem value="migration">Migration</SelectItem>
                  <SelectItem value="development">Development</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={showFavoritesOnly ? "default" : "outline"}
                      size="icon"
                      onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                    >
                      <Star
                        className={cn(
                          "h-4 w-4",
                          showFavoritesOnly && "fill-current",
                        )}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Favorites only</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 mb-4">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setShowTemplates(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              New from Template
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={handleExport}>
                    <Download className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export Workflows</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <Separator className="mb-4" />

          {/* Workflow List or Selected Workflow Details */}
          <ScrollArea className="flex-1">
            {selectedWorkflow ? (
              // Workflow Detail View
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedWorkflow(null)}
                  >
                    <ChevronRight className="h-4 w-4 rotate-180" />
                    Back
                  </Button>
                </div>

                <div className="p-4 bg-white dark:bg-slate-800/50 rounded-lg border">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {getCategoryIcon(selectedWorkflow.category || "custom")}
                      <h3 className="font-semibold">{selectedWorkflow.name}</h3>
                    </div>
                    <div className="flex items-center gap-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() =>
                                handleToggleFavorite(selectedWorkflow.id)
                              }
                            >
                              {selectedWorkflow.isFavorite ? (
                                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                              ) : (
                                <StarOff className="h-4 w-4" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {selectedWorkflow.isFavorite
                              ? "Remove from favorites"
                              : "Add to favorites"}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() =>
                                handleDuplicate(selectedWorkflow.id)
                              }
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Duplicate</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600"
                              onClick={() =>
                                setShowDeleteConfirm(selectedWorkflow.id)
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground mb-3">
                    {selectedWorkflow.description}
                  </p>

                  <div className="flex flex-wrap gap-1 mb-3">
                    {selectedWorkflow.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs text-center mb-4">
                    <div className="p-2 bg-slate-50 dark:bg-slate-700/50 rounded">
                      <div className="font-semibold">
                        {selectedWorkflow.steps.length}
                      </div>
                      <div className="text-muted-foreground">Steps</div>
                    </div>
                    <div className="p-2 bg-slate-50 dark:bg-slate-700/50 rounded">
                      <div className="font-semibold">
                        {selectedWorkflow.runCount}
                      </div>
                      <div className="text-muted-foreground">Runs</div>
                    </div>
                    <div className="p-2 bg-slate-50 dark:bg-slate-700/50 rounded">
                      <div className="font-semibold">
                        {selectedWorkflow.successRate?.toFixed(0) || "-"}%
                      </div>
                      <div className="text-muted-foreground">Success</div>
                    </div>
                  </div>
                </div>

                {/* Parameters */}
                {selectedWorkflow.parameters.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">Parameters</h4>
                    {selectedWorkflow.parameters.map((param) => (
                      <div key={param.name} className="space-y-1">
                        <Label className="text-sm">
                          {param.label}
                          {param.required && (
                            <span className="text-red-500 ml-1">*</span>
                          )}
                        </Label>
                        {renderParameterInput(param)}
                        {param.description && (
                          <p className="text-xs text-muted-foreground">
                            {param.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Steps Preview */}
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Steps</h4>
                  {selectedWorkflow.steps.map((step, idx) => (
                    <div
                      key={step.id}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded border text-sm",
                        step.enabled
                          ? "bg-white dark:bg-slate-800/50"
                          : "bg-slate-100 dark:bg-slate-800/30 opacity-60",
                      )}
                    >
                      <span className="w-5 h-5 flex items-center justify-center bg-slate-200 dark:bg-slate-700 rounded text-xs">
                        {idx + 1}
                      </span>
                      <span className="flex-1">{step.name}</span>
                      {!step.enabled && (
                        <Badge variant="outline" className="text-xs">
                          Disabled
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>

                {/* Execute Button */}
                <Button
                  className="w-full"
                  onClick={handleExecute}
                  disabled={isExecuting || !selectedWorkflow.isEnabled}
                >
                  {isExecuting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Executing...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Run Workflow
                    </>
                  )}
                </Button>
              </div>
            ) : showTemplates ? (
              // Template Selection View
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowTemplates(false)}
                  >
                    <ChevronRight className="h-4 w-4 rotate-180" />
                    Back
                  </Button>
                  <span className="font-medium">Choose a Template</span>
                </div>

                {BUILTIN_TEMPLATES.map((template) => (
                  <div
                    key={template.id}
                    className="p-4 bg-white dark:bg-slate-800/50 rounded-lg border hover:border-blue-300 dark:hover:border-blue-700 cursor-pointer transition-colors"
                    onClick={() => handleCreateFromTemplate(template)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {getCategoryIcon(template.category)}
                      <h3 className="font-medium">{template.name}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {template.description}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              // Workflow List View
              <div className="space-y-2">
                {filteredWorkflows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Zap className="h-12 w-12 mb-4 opacity-50" />
                    <p className="text-sm">No workflows found</p>
                    <p className="text-xs">
                      Create one from a template to get started
                    </p>
                  </div>
                ) : (
                  filteredWorkflows.map((workflow) => (
                    <div
                      key={workflow.id}
                      className="p-3 bg-white dark:bg-slate-800/50 rounded-lg border hover:border-blue-300 dark:hover:border-blue-700 cursor-pointer transition-colors"
                      onClick={() => setSelectedWorkflow(workflow)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {getCategoryIcon(workflow.category || "custom")}
                        <span className="font-medium flex-1 truncate">
                          {workflow.name}
                        </span>
                        {workflow.isFavorite && (
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="text-xs text-muted-foreground truncate mb-2">
                        {workflow.description}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{workflow.steps.length} steps</span>
                        <span>•</span>
                        <span>{workflow.runCount} runs</span>
                        {workflow.lastRunAt && (
                          <>
                            <span>•</span>
                            <span>
                              Last run:{" "}
                              {new Date(
                                workflow.lastRunAt,
                              ).toLocaleDateString()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 m-4 max-w-sm shadow-xl">
            <h3 className="text-lg font-semibold mb-2">Delete Workflow?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              This will permanently delete this workflow. This action cannot be
              undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleDelete(showDeleteConfirm)}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Compact workflow selector for embedding in other components.
 */
export const WorkflowSelector = ({
  onSelect,
}: {
  onSelect: (workflow: Workflow) => void;
}) => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const loadWorkflows = async () => {
      await workflowManager.initialize();
      setWorkflows(workflowManager.getAllWorkflows());
    };
    loadWorkflows();
  }, []);

  return (
    <Select
      onValueChange={(id) => {
        const workflow = workflows.find((w) => w.id === id);
        if (workflow) onSelect(workflow);
      }}
    >
      <SelectTrigger>
        <SelectValue placeholder="Select a workflow..." />
      </SelectTrigger>
      <SelectContent>
        {workflows.map((workflow) => (
          <SelectItem key={workflow.id} value={workflow.id}>
            {workflow.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
