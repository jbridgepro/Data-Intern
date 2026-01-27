/**
 * File: src/features/ai-assistant/components/ToolUsageIndicator.tsx
 * 
 * Component for displaying active tool usage in real-time.
 * Shows which tools are currently being executed.
 */

import { Wrench, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ToolExecutionInfo } from './ToolExecutionCard';

interface ToolUsageIndicatorProps {
  toolExecutions: ToolExecutionInfo[];
  className?: string;
}

export const ToolUsageIndicator = ({ toolExecutions, className }: ToolUsageIndicatorProps) => {
  if (!toolExecutions || toolExecutions.length === 0) {
    return null;
  }

  const activeTools = toolExecutions.filter(t => t.status === 'running' || t.status === 'pending');
  const completedTools = toolExecutions.filter(t => t.status === 'success');
  const failedTools = toolExecutions.filter(t => t.status === 'error');

  const getToolDisplayName = (tool: string): string => {
    const names: Record<string, string> = {
      analyze_directory: 'Analyze Directory',
      organize_files: 'Organize Files',
      find_duplicates: 'Find Duplicates',
      rename_files: 'Rename Files',
      execute_operation: 'Execute Operation',
      search_files: 'Search Files',
      list_directory_contents: 'List Contents',
      get_file_info: 'Get File Info',
      read_file_content: 'Read File',
      write_file_content: 'Write File',
      delete_files: 'Delete Files',
      calculate_directory_size: 'Calculate Size',
      file_search_by_content: 'Search Content',
      compare_directories: 'Compare Directories',
      batch_delete: 'Batch Delete',
      create_directory: 'Create Directory',
      move_file: 'Move File',
      copy_file: 'Copy File',
      file_copy_tab: 'File Copy & Move',
      folder_creation_tab: 'Folder Creation',
      file_creation_tab: 'File Creation',
      find_replace_tab: 'Find & Replace',
      list_agents: 'List Agents',
      start_agent: 'Start Agent',
      stop_agent: 'Stop Agent',
      get_agent_status: 'Get Agent Status',
      configure_agent: 'Configure Agent',
      clawdbot_execute: 'ClawdBot Execute',
      clawdhub_list_skills: 'List ClawdHub Skills',
      clawdhub_install_skill: 'Install ClawdHub Skill',
    };
    return names[tool] || tool.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <Card className={cn("border-2 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10", className)}>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <Wrench className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">
            Active Tools
          </span>
          <Badge variant="outline" className="text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
            {toolExecutions.length} {toolExecutions.length === 1 ? 'tool' : 'tools'}
          </Badge>
        </div>

        <div className="space-y-2">
          {/* Active/Pending Tools */}
          {activeTools.length > 0 && (
            <div className="space-y-1.5">
              {activeTools.map((tool, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-2 rounded-lg bg-blue-100/50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                >
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600 dark:text-blue-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-blue-900 dark:text-blue-100 truncate">
                      {getToolDisplayName(tool.tool)}
                    </div>
                    {tool.progress && (
                      <div className="text-[10px] text-blue-700 dark:text-blue-300 mt-0.5">
                        {tool.progress.status || 'Processing...'}
                      </div>
                    )}
                  </div>
                  {tool.progress && (
                    <div className="text-[10px] font-medium text-blue-700 dark:text-blue-300 shrink-0">
                      {tool.progress.percentage}%
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Completed Tools (collapsed) */}
          {completedTools.length > 0 && activeTools.length === 0 && (
            <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-300">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span>{completedTools.length} tool{completedTools.length !== 1 ? 's' : ''} completed</span>
            </div>
          )}

          {/* Failed Tools */}
          {failedTools.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{failedTools.length} tool{failedTools.length !== 1 ? 's' : ''} failed</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
