import { useState, useCallback, useEffect } from 'react';
import {
  runCuration, cancelCuration, loadSettings, saveSettings,
  getSavedRuns, applyCurationResults, getRunById, updateRun, rerunCurationOnSelected,
  type CurationProgress,
} from '../utils/aiCurator';
import { addAuditLog, getAuditLogsForRun } from '../utils/auditLogger';
import { getAllNotifications, getUnreadNotificationCount, markNotificationRead } from '../utils/notificationUtil';
import type {
  CurationRun, CuratorSettings, CurationMode, ServiceType,
  CuratedFile, AuditLogEntry, CurationNotification,
} from '../types';

export function useAICurator() {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<CurationProgress | null>(null);
  const [currentRun, setCurrentRun] = useState<CurationRun | null>(null);
  const [pastRuns, setPastRuns] = useState<CurationRun[]>(() => getSavedRuns());
  const [settings, setSettings] = useState<CuratorSettings>(() => loadSettings());
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [notifications, setNotifications] = useState<CurationNotification[]>(() => getAllNotifications());
  const [unreadNotifCount, setUnreadNotifCount] = useState(() => getUnreadNotificationCount());

  useEffect(() => { saveSettings(settings); }, [settings]);

  useEffect(() => {
    setPastRuns(getSavedRuns());
    if (currentRun) {
      setAuditLogs(getAuditLogsForRun(currentRun.id));
    }
  }, [currentRun]);

  useEffect(() => {
    const handler = () => {
      setNotifications(getAllNotifications());
      setUnreadNotifCount(getUnreadNotificationCount());
    };
    window.addEventListener('ai-curator-notification', handler);
    return () => window.removeEventListener('ai-curator-notification', handler);
  }, []);

  const startCuration = useCallback(
    async (dirPath: string, mode: CurationMode, serviceType: ServiceType) => {
      if (isRunning) return;
      setIsRunning(true);
      setProgress({ processed: 0, total: 0, stage: 'Starting...', percent: 0 });

      try {
        const run = await runCuration(dirPath, mode, serviceType, (p) => setProgress(p));
        setCurrentRun(run);
        return run;
      } catch (err: any) {
        console.error('[AI Curator] Curation failed:', err);
      } finally {
        setIsRunning(false);
        setProgress(null);
      }
    },
    [isRunning]
  );

  const cancel = useCallback(() => {
    cancelCuration();
    setIsRunning(false);
  }, []);

  const loadRun = useCallback((runId: string) => {
    const run = getRunById(runId) || null;
    if (run) setCurrentRun(run);
    return run;
  }, []);

  const clearCurrent = useCallback(() => {
    setCurrentRun(null);
    setAuditLogs([]);
  }, []);

  const applyResults = useCallback(
    async (results: CuratedFile[], targetBasePath: string) => {
      return await applyCurationResults(results, targetBasePath,
        (current, total, fileName) => {
          setProgress({
            processed: current, total,
            stage: `Moving ${fileName}...`, currentFile: fileName,
            percent: Math.round((current / total) * 100),
          });
        }
      );
    },
    []
  );

  const rerunSelected = useCallback(
    async (fileAssetIds: string[]) => {
      if (!currentRun || isRunning) return;
      setIsRunning(true);
      try {
        const updated = await rerunCurationOnSelected(currentRun, fileAssetIds, (p) => setProgress(p));
        setCurrentRun(updated);
        return updated;
      } finally {
        setIsRunning(false);
        setProgress(null);
      }
    },
    [currentRun, isRunning]
  );

  const recordStaffDecision = useCallback(
    (assetId: string, decision: 'accepted' | 'modified' | 'rejected', finalFolder?: string) => {
      if (!currentRun) return;
      const updated = { ...currentRun };
      const file = updated.allResults.find(r => r.assetId === assetId);
      if (!file) return;
      file.staffDecision = decision;
      if (finalFolder) file.finalFolder = finalFolder;
      updateRun(updated);
      setCurrentRun(updated);
      addAuditLog(currentRun.id, 'staff_modified_recommendation',
        `Staff ${decision} recommendation for ${file.fileName}${finalFolder ? ` → ${finalFolder}` : ''}`);
    },
    [currentRun]
  );

  const updateFileTags = useCallback(
    (assetId: string, tags: string[]) => {
      if (!currentRun) return;
      const updated = { ...currentRun };
      const file = updated.allResults.find(r => r.assetId === assetId);
      if (!file) return;
      file.reasonTags = tags;
      updateRun(updated);
      setCurrentRun(updated);
      addAuditLog(currentRun.id, 'staff_modified_recommendation',
        `Staff updated tags for ${file.fileName} to [${tags.join(', ')}]`);
    },
    [currentRun]
  );

  const markNotificationReadById = useCallback((notifId: string) => {
    markNotificationRead(notifId);
    setNotifications(getAllNotifications());
    setUnreadNotifCount(getUnreadNotificationCount());
  }, []);

  return {
    isRunning, progress, currentRun, pastRuns, settings, setSettings,
    auditLogs, notifications, unreadNotifCount,
    startCuration, cancel, loadRun, clearCurrent, applyResults,
    rerunSelected, recordStaffDecision, updateFileTags, markNotificationReadById,
  };
}
