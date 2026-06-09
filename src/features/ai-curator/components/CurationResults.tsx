import { useState, useMemo, useEffect } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Star, FolderOpen, Copy, RefreshCw, Filter, ThumbsUp, ThumbsDown, Edit3, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { CurationRun, FolderPlan, CuratedFile, SimilarGroup } from '../types';

interface CurationResultsProps {
  run: CurationRun;
  onApplyResults?: (results: CuratedFile[]) => void;
  isApplying?: boolean;
  applyProgress?: { current: number; total: number } | null;
  onStaffDecision?: (assetId: string, decision: 'accepted' | 'modified' | 'rejected', finalFolder?: string) => void;
  onRerunSelected?: (assetIds: string[]) => void;
  onUpdateTags?: (assetId: string, tags: string[]) => void;
}

const folderColors: Record<string, string> = {
  best_selects: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800',
  usable_secondary: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  needs_editing: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
  reject_candidates: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
  similar_review: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800',
  manual_review: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800',
};

function ScoreBar({ value, label }: { value: number; label: string }) {
  const color = value >= 70 ? 'bg-green-500' : value >= 40 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-28 text-muted-foreground truncate">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${value}%` }} />
      </div>
      <span className="w-8 text-right font-mono text-muted-foreground">{value}</span>
    </div>
  );
}

function FileCard({
  file,
  onStaffDecision,
  onUpdateTags,
}: {
  file: CuratedFile;
  onStaffDecision?: (assetId: string, decision: 'accepted' | 'modified' | 'rejected', finalFolder?: string) => void;
  onUpdateTags?: (assetId: string, tags: string[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl = '';

    const loadThumbnail = async () => {
      if (/\.(jpe?g|png|webp|gif|heic|avif)$/i.test(file.filePath)) {
        try {
          const { readFile } = await import('@tauri-apps/plugin-fs');
          const data = await readFile(file.filePath);
          if (!active) return;
          const ext = file.filePath.split('.').pop()?.toLowerCase() || 'jpeg';
          const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
          const blob = new Blob([data], { type: mimeType });
          objectUrl = URL.createObjectURL(blob);
          if (active) {
            setThumbnailUrl(objectUrl);
          }
        } catch (err) {
          console.error('Failed to load file card preview:', err, file.filePath);
        }
      }
    };

    loadThumbnail();

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [file.filePath]);

  const sizeLabel = file.fileSizeBytes > 1024 * 1024
    ? `${(file.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`
    : `${(file.fileSizeBytes / 1024).toFixed(0)} KB`;

  const decisionColor = file.staffDecision === 'accepted' ? 'border-l-green-500' :
    file.staffDecision === 'rejected' ? 'border-l-red-500' :
    file.staffDecision === 'modified' ? 'border-l-blue-500' : 'border-l-transparent';

  return (
    <Card className={cn('py-3 border-l-4', decisionColor)}>
      <CardContent className="px-4">
        <div className="flex gap-3 items-start">
          {thumbnailUrl ? (
            <div className="relative w-14 h-14 rounded-md overflow-hidden border border-border shrink-0 bg-muted flex items-center justify-center">
              <img
                src={thumbnailUrl}
                alt={file.fileName}
                className="w-full h-full object-cover"
              />
            </div>
          ) : /\.(jpe?g|png|webp|gif|heic|avif)$/i.test(file.filePath) ? (
            <div className="w-14 h-14 rounded-md border border-border shrink-0 bg-muted flex items-center justify-center text-[8px] text-muted-foreground">
              Loading...
            </div>
          ) : null}

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-medium text-sm truncate">{file.fileName}</span>
                  <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 whitespace-nowrap', folderColors[file.suggestedFolder] || '')}>
                    {file.suggestedFolder.replace('_', ' ')}
                  </Badge>
                  {file.staffDecision === 'accepted' && <Badge className="text-[10px] bg-green-500">Accepted</Badge>}
                  {file.staffDecision === 'rejected' && <Badge className="text-[10px] bg-red-500">Rejected</Badge>}
                  {file.staffDecision === 'modified' && <Badge className="text-[10px] bg-blue-500">Modified</Badge>}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  <span>{sizeLabel}</span>
                  <span>{file.mimeType}</span>
                  {file.wasReviewedByAI && <Badge variant="secondary" className="text-[10px]">AI-reviewed</Badge>}
                  {file.wasAutoSorted && <Badge variant="outline" className="text-[10px]">Auto-sorted</Badge>}
                  {file.isBestOfSimilarGroup && <Badge variant="outline" className="text-[10px] text-green-600">Best of group</Badge>}
                  {file.aiEligibility && file.aiEligibility !== 'eligible' && (
                    <Badge variant="outline" className="text-[10px] text-amber-600">{file.aiEligibility.replace(/_/g, ' ')}</Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <div className={cn(
                  'flex items-center justify-center w-10 h-10 rounded-full text-xs font-bold',
                  file.confidenceScore >= 70 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                  file.confidenceScore >= 40 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                )}>
                  {file.confidenceScore}
                </div>
              </div>
            </div>

            {onUpdateTags ? (
              <div className="flex flex-wrap gap-1 items-center mt-2">
                {file.reasonTags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-[10px] text-muted-foreground flex items-center gap-1 pr-1.5 py-0.5">
                    {tag}
                    <button
                      onClick={() => {
                        const newTags = file.reasonTags.filter(t => t !== tag);
                        onUpdateTags(file.assetId, newTags);
                      }}
                      className="hover:text-red-500 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 p-0.5 transition-colors"
                      title={`Remove tag ${tag}`}
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
                <div className="flex items-center gap-1 ml-1">
                  <input
                    type="text"
                    placeholder="+ Add tag..."
                    className="text-[10px] h-5 px-1.5 py-0.5 border rounded bg-background focus:outline-none focus:ring-1 focus:ring-blue-500 w-20"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const target = e.currentTarget;
                        const val = target.value.trim();
                        if (val && !file.reasonTags.includes(val)) {
                          onUpdateTags(file.assetId, [...file.reasonTags, val]);
                          target.value = '';
                        }
                      }
                    }}
                  />
                </div>
              </div>
            ) : (
              file.reasonTags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {file.reasonTags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-[10px] text-muted-foreground">{tag}</Badge>
                  ))}
                </div>
              )
            )}

            {file.explanation && (
              <p className="text-xs text-muted-foreground mt-2">{file.explanation}</p>
            )}

            <div className="flex items-center gap-2 mt-2">
              <button onClick={() => setExpanded(!expanded)} className="text-xs text-blue-500 hover:text-blue-600">
                {expanded ? 'Hide scores' : 'Show scores'}
              </button>

              {onStaffDecision && (
                <div className="flex items-center gap-1 ml-auto">
                  <button
                    onClick={() => onStaffDecision(file.assetId, 'accepted')}
                    className={cn('p-1 rounded hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors',
                      file.staffDecision === 'accepted' ? 'text-green-600' : 'text-muted-foreground')}
                    title="Accept recommendation"
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => onStaffDecision(file.assetId, 'rejected')}
                    className={cn('p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors',
                      file.staffDecision === 'rejected' ? 'text-red-600' : 'text-muted-foreground')}
                    title="Reject recommendation"
                  >
                    <ThumbsDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => onStaffDecision(file.assetId, 'modified')}
                    className={cn('p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors',
                      file.staffDecision === 'modified' ? 'text-blue-600' : 'text-muted-foreground')}
                    title="Mark as modified"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            {expanded && (
              <div className="mt-3 space-y-1.5">
                <ScoreBar value={file.scores.overall} label="Overall" />
                <ScoreBar value={file.scores.technicalQuality} label="Technical Quality" />
                <ScoreBar value={file.scores.composition} label="Composition" />
                <ScoreBar value={file.scores.subjectQuality} label="Subject Quality" />
                <ScoreBar value={file.scores.serviceFit} label="Service Fit" />
                <ScoreBar value={file.scores.deliverableReadiness} label="Deliverable Readiness" />
                <ScoreBar value={file.scores.uniqueness} label="Uniqueness" />
                <ScoreBar value={file.scores.editPotential} label="Edit Potential" />
                <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                  {file.scores.automationConfidence !== undefined && <span>Auto confidence: {file.scores.automationConfidence}%</span>}
                  {file.scores.aiConfidence !== undefined && <span>AI confidence: {file.scores.aiConfidence}%</span>}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FolderSection({
  plan,
  onStaffDecision,
  onUpdateTags,
}: {
  plan: FolderPlan;
  onStaffDecision?: (assetId: string, decision: 'accepted' | 'modified' | 'rejected', finalFolder?: string) => void;
  onUpdateTags?: (assetId: string, tags: string[]) => void;
}) {
  const [open, setOpen] = useState(plan.suggestedLabel === 'best_selects');
  const icon = plan.suggestedLabel === 'best_selects' ? Star :
    plan.suggestedLabel === 'reject_candidates' ? XCircle :
    plan.suggestedLabel === 'needs_editing' ? AlertTriangle : FolderOpen;
  const Icon = icon;

  return (
    <div className="mb-4">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full text-left py-2 px-3 rounded-lg hover:bg-accent transition-colors"
      >
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-sm">{plan.folderName}</span>
        <Badge variant="secondary" className="ml-auto text-xs">{plan.files.length} files</Badge>
        <span className="text-xs text-muted-foreground">{open ? '▼' : '▶'}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2 ml-2">
          <p className="text-xs text-muted-foreground px-3">{plan.description}</p>
          {plan.files.map((file) => (
            <FileCard key={file.assetId} file={file} onStaffDecision={onStaffDecision} onUpdateTags={onUpdateTags} />
          ))}
        </div>
      )}
    </div>
  );
}

function SimilarGroupCard({
  group,
  onStaffDecision,
  onUpdateTags,
}: {
  group: SimilarGroup;
  onStaffDecision?: (assetId: string, decision: 'accepted' | 'modified' | 'rejected', finalFolder?: string) => void;
  onUpdateTags?: (assetId: string, tags: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const bestFile = group.files.find(f => f.assetId === group.bestFileAssetId);

  return (
    <div className="mb-3 p-3 rounded-lg border border-purple-200 dark:border-purple-800">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full text-left"
      >
        <FolderOpen className="h-4 w-4 text-purple-500" />
        <span className="text-sm font-medium">Similar Group</span>
        <Badge variant="secondary" className="text-[10px]">{group.files.length} files</Badge>
        {bestFile && <Badge className="text-[10px] bg-green-500">Best: {bestFile.confidenceScore}</Badge>}
        <span className="text-xs text-muted-foreground ml-auto">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-muted-foreground">{group.reason}</p>
          {group.files.map(file => (
            <FileCard key={file.assetId} file={file} onStaffDecision={onStaffDecision} onUpdateTags={onUpdateTags} />
          ))}
        </div>
      )}
    </div>
  );
}

export function CurationResults({
  run,
  onApplyResults,
  isApplying,
  applyProgress,
  onStaffDecision,
  onRerunSelected,
  onUpdateTags,
}: CurationResultsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFolder, setFilterFolder] = useState<string>('all');
  const [filterDecision, setFilterDecision] = useState<string>('all');
  const [selectedForRerun, setSelectedForRerun] = useState<Set<string>>(new Set());
  const [showSimilarGroups, setShowSimilarGroups] = useState(false);

  const filteredResults = useMemo(() => {
    let files = run.allResults;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      files = files.filter(f => f.fileName.toLowerCase().includes(q));
    }
    if (filterFolder !== 'all') {
      files = files.filter(f => f.suggestedFolder === filterFolder);
    }
    if (filterDecision !== 'all') {
      files = files.filter(f => (f.staffDecision || 'pending') === filterDecision);
    }
    return files;
  }, [run.allResults, searchQuery, filterFolder, filterDecision]);

  const pendingCount = run.allResults.filter(f => !f.staffDecision || f.staffDecision === 'pending').length;
  const acceptedCount = run.allResults.filter(f => f.staffDecision === 'accepted').length;

  const summaryItems = [
    { label: 'Total files', value: run.totalFiles },
    { label: 'AI reviewed', value: run.aiReviewedCount },
    { label: 'Auto sorted', value: run.autoSortedCount },
    { label: 'Best selects', value: run.bestSelectsCount, color: 'text-green-600' },
    { label: 'Usable', value: run.usableCount, color: 'text-blue-600' },
    { label: 'Rejects', value: run.rejectCount, color: 'text-red-600' },
    { label: 'Duplicates', value: run.duplicateCount, color: 'text-purple-600' },
    { label: 'Pending review', value: pendingCount, color: 'text-amber-600' },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Curation Results
            <Badge variant="secondary" className="ml-2 text-xs">{run.mode.replace(/_/g, ' ')}</Badge>
            {run.status === 'cancelled' && <Badge variant="outline" className="text-yellow-600 border-yellow-300">Cancelled</Badge>}
            {run.status === 'failed' && <Badge variant="destructive" className="text-xs">Failed</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6">
          <div className="grid grid-cols-4 gap-3 mb-4">
            {summaryItems.map((item) => (
              <div key={item.label} className="text-center">
                <div className={cn('text-xl font-bold', item.color || '')}>{item.value}</div>
                <div className="text-xs text-muted-foreground">{item.label}</div>
              </div>
            ))}
          </div>

          {run.actualCostCents !== undefined && (
            <div className="text-xs text-muted-foreground mb-3 text-center">
              Estimated AI cost: ${((run.estimatedCostCents || 0) / 100).toFixed(2)} |
              Actual AI cost: ${((run.actualCostCents || 0) / 100).toFixed(2)}
              {run.similarGroups.length > 0 && ` | ${run.similarGroups.length} similar groups identified`}
            </div>
          )}

          {run.errorMessage && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 text-sm mb-3">
              {run.errorMessage}
            </div>
          )}

          {run.status === 'ready_for_review' && (onApplyResults || onRerunSelected) && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              {onApplyResults && (
                <Button onClick={() => onApplyResults(run.allResults)} disabled={isApplying} size="sm">
                  {isApplying ? <>Applying...</> : <><Copy className="h-4 w-4" /> Copy to Organized Folders</>}
                </Button>
              )}
              {isApplying && applyProgress && (
                <div className="flex-1">
                  <Progress value={(applyProgress.current / applyProgress.total) * 100} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">{applyProgress.current} / {applyProgress.total} files</p>
                </div>
              )}
              {onRerunSelected && (
                <Button
                  variant="outline" size="sm"
                  onClick={() => { onRerunSelected(Array.from(selectedForRerun)); setSelectedForRerun(new Set()); }}
                  disabled={selectedForRerun.size === 0 || isApplying}
                >
                  <RefreshCw className="h-4 w-4" /> Rerun AI ({selectedForRerun.size})
                </Button>
              )}
            </div>
          )}

          {run.similarGroups.length > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setShowSimilarGroups(!showSimilarGroups)}
                className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700"
              >
                <FolderOpen className="h-4 w-4" />
                {showSimilarGroups ? 'Hide' : 'Show'} Similar Groups ({run.similarGroups.length})
              </button>
              {showSimilarGroups && (
                <div className="mt-2 space-y-2">
                  {run.similarGroups.map((group) => (
                    <SimilarGroupCard key={group.groupId} group={group} onStaffDecision={onStaffDecision} onUpdateTags={onUpdateTags} />
                  ))}
                </div>
              )}
            </div>
          )}

          <Separator className="my-4" />

          <div className="flex items-center gap-3 mb-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-8 text-sm max-w-xs"
            />
            <Select value={filterFolder} onValueChange={setFilterFolder}>
              <SelectTrigger className="h-8 text-sm w-40">
                <SelectValue placeholder="All folders" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All folders</SelectItem>
                <SelectItem value="best_selects">Best Selects</SelectItem>
                <SelectItem value="usable_secondary">Usable</SelectItem>
                <SelectItem value="needs_editing">Needs Editing</SelectItem>
                <SelectItem value="reject_candidates">Rejects</SelectItem>
                <SelectItem value="similar_review">Similar Review</SelectItem>
                <SelectItem value="manual_review">Manual Review</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterDecision} onValueChange={setFilterDecision}>
              <SelectTrigger className="h-8 text-sm w-40">
                <SelectValue placeholder="All decisions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All decisions</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="modified">Modified</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">
              Showing {filteredResults.length} of {run.allResults.length}
            </span>
          </div>

          <div className="space-y-4">
            {filteredResults.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No results match your filters.</p>
            ) : (
              ['best_selects', 'usable_secondary', 'needs_editing', 'similar_review', 'manual_review', 'reject_candidates'].map((folder) => {
                const plan = run.folderPlan.find(p => p.suggestedLabel === folder);
                if (!plan) return null;
                const filteredFiles = filteredResults.filter(f => f.suggestedFolder === folder);
                if (filteredFiles.length === 0) return null;
                return (
                  <FolderSection
                    key={folder}
                    plan={{ ...plan, files: filteredFiles }}
                    onStaffDecision={onStaffDecision}
                    onUpdateTags={onUpdateTags}
                  />
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
