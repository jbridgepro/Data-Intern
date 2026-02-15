/**
 * File: src/features/ai-assistant/utils/operationHistory.ts
 * 
 * Operation history management for undo/redo functionality.
 * Tracks file operations and enables reverting changes.
 * 
 * Key features:
 * - Operation recording with full change details
 * - Undo/redo stack management
 * - Backup creation for destructive operations
 * - History persistence to localStorage
 * - Operation filtering and search
 */

import type { 
  OperationHistorySettings, 
  OperationRecord, 
  OperationType,
  OperationStatus,
  FileChange,
  UndoResult,
} from '../types';
import { DEFAULT_OPERATION_HISTORY_SETTINGS } from '../types';
import { exists, mkdir, writeTextFile, readTextFile, remove, rename } from '@tauri-apps/plugin-fs';
import { join, dirname, basename } from '@tauri-apps/api/path';

/**
 * Storage key for persisting history.
 */
const STORAGE_KEY = 'file-pro-operation-history';

/**
 * Backup directory name.
 */
const BACKUP_DIR = '.file-pro-backups';

/**
 * Listener callback type for history changes.
 */
type HistoryChangeListener = (history: OperationRecord[], undoStack: number, redoStack: number) => void;

/**
 * OperationHistoryManager handles tracking and undoing file operations.
 */
export class OperationHistoryManager {
  private settings: OperationHistorySettings;
  private history: OperationRecord[] = [];
  private currentIndex: number = -1; // Points to the current position in history
  private listeners: Set<HistoryChangeListener> = new Set();
  private isInitialized: boolean = false;

  constructor(settings?: Partial<OperationHistorySettings>) {
    this.settings = { ...DEFAULT_OPERATION_HISTORY_SETTINGS, ...settings };
  }

  /**
   * Initializes the history manager and loads persisted history.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    if (this.settings.persistHistory) {
      await this.loadFromStorage();
    }

    this.isInitialized = true;
    console.log(`[OperationHistory] Initialized with ${this.history.length} operations`);
  }

  /**
   * Updates the settings.
   * @param newSettings - Partial settings to update
   */
  updateSettings(newSettings: Partial<OperationHistorySettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    
    // Trim history if max size reduced
    this.trimHistory();
  }

  /**
   * Gets the current settings.
   */
  getSettings(): OperationHistorySettings {
    return { ...this.settings };
  }

  /**
   * Generates a unique operation ID.
   */
  private generateId(): string {
    return `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Records a new operation to history.
   * @param operation - Partial operation record (id and timestamp will be auto-generated)
   * @returns The complete operation record
   */
  recordOperation(operation: Omit<OperationRecord, 'id' | 'timestamp'>): OperationRecord {
    if (!this.settings.enabled) {
      // Return a dummy record if disabled
      return {
        ...operation,
        id: this.generateId(),
        timestamp: Date.now(),
      };
    }

    const record: OperationRecord = {
      ...operation,
      id: this.generateId(),
      timestamp: Date.now(),
    };

    // If we're not at the end of history (after some undos), truncate the redo stack
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    // Add to history
    this.history.push(record);
    this.currentIndex = this.history.length - 1;

    // Trim if exceeds max size
    this.trimHistory();

    // Persist
    this.saveToStorage();

    // Notify listeners
    this.notifyListeners();

    console.log(`[OperationHistory] Recorded: ${record.type} - ${record.description}`);
    return record;
  }

  /**
   * Updates an existing operation record.
   * @param id - Operation ID
   * @param updates - Partial updates to apply
   */
  updateOperation(id: string, updates: Partial<OperationRecord>): void {
    const index = this.history.findIndex(op => op.id === id);
    if (index !== -1) {
      this.history[index] = { ...this.history[index], ...updates };
      this.saveToStorage();
      this.notifyListeners();
    }
  }

  /**
   * Trims history to max size, removing oldest entries.
   */
  private trimHistory(): void {
    if (this.history.length > this.settings.maxHistorySize) {
      const toRemove = this.history.length - this.settings.maxHistorySize;
      this.history = this.history.slice(toRemove);
      this.currentIndex = Math.max(0, this.currentIndex - toRemove);
    }
  }

  /**
   * Checks if undo is available.
   */
  canUndo(): boolean {
    if (!this.settings.enabled) return false;
    
    // Find the most recent undoable operation at or before current index
    for (let i = this.currentIndex; i >= 0; i--) {
      const op = this.history[i];
      if (op.status === 'completed' && op.canUndo) {
        return true;
      }
    }
    return false;
  }

  /**
   * Checks if redo is available.
   */
  canRedo(): boolean {
    if (!this.settings.enabled) return false;
    
    // Find the most recent undone operation after current index
    for (let i = this.currentIndex + 1; i < this.history.length; i++) {
      const op = this.history[i];
      if (op.status === 'undone') {
        return true;
      }
    }
    return false;
  }

  /**
   * Gets the next operation that would be undone.
   */
  getNextUndoOperation(): OperationRecord | null {
    if (!this.canUndo()) return null;
    
    for (let i = this.currentIndex; i >= 0; i--) {
      const op = this.history[i];
      if (op.status === 'completed' && op.canUndo) {
        return op;
      }
    }
    return null;
  }

  /**
   * Gets the next operation that would be redone.
   */
  getNextRedoOperation(): OperationRecord | null {
    if (!this.canRedo()) return null;
    
    for (let i = this.currentIndex + 1; i < this.history.length; i++) {
      const op = this.history[i];
      if (op.status === 'undone') {
        return op;
      }
    }
    return null;
  }

  /**
   * Undoes the most recent undoable operation.
   * @returns Undo result
   */
  async undo(): Promise<UndoResult> {
    const operation = this.getNextUndoOperation();
    
    if (!operation) {
      return {
        success: false,
        operation: null as any,
        restoredFiles: [],
        failedFiles: [],
        error: 'No operation to undo',
      };
    }

    console.log(`[OperationHistory] Undoing: ${operation.type} - ${operation.description}`);

    const restoredFiles: string[] = [];
    const failedFiles: Array<{ path: string; error: string }> = [];

    try {
      // Reverse each file change
      for (const change of operation.changes) {
        try {
          await this.reverseChange(change, operation);
          restoredFiles.push(change.sourcePath);
        } catch (error: any) {
          failedFiles.push({
            path: change.sourcePath,
            error: error.message || 'Unknown error',
          });
        }
      }

      // Mark operation as undone
      operation.status = 'undone';
      
      // Move current index back
      const opIndex = this.history.indexOf(operation);
      if (opIndex !== -1 && opIndex <= this.currentIndex) {
        this.currentIndex = opIndex - 1;
      }

      this.saveToStorage();
      this.notifyListeners();

      return {
        success: failedFiles.length === 0,
        operation,
        restoredFiles,
        failedFiles,
      };
    } catch (error: any) {
      console.error('[OperationHistory] Undo failed:', error);
      return {
        success: false,
        operation,
        restoredFiles,
        failedFiles,
        error: error.message || 'Undo failed',
      };
    }
  }

  /**
   * Redoes the most recent undone operation.
   * @returns Redo result (similar to UndoResult)
   */
  async redo(): Promise<UndoResult> {
    const operation = this.getNextRedoOperation();
    
    if (!operation) {
      return {
        success: false,
        operation: null as any,
        restoredFiles: [],
        failedFiles: [],
        error: 'No operation to redo',
      };
    }

    console.log(`[OperationHistory] Redoing: ${operation.type} - ${operation.description}`);

    const restoredFiles: string[] = [];
    const failedFiles: Array<{ path: string; error: string }> = [];

    try {
      // Re-apply each file change
      for (const change of operation.changes) {
        try {
          await this.applyChange(change);
          restoredFiles.push(change.targetPath || change.sourcePath);
        } catch (error: any) {
          failedFiles.push({
            path: change.targetPath || change.sourcePath,
            error: error.message || 'Unknown error',
          });
        }
      }

      // Mark operation as completed again
      operation.status = 'completed';
      
      // Move current index forward
      const opIndex = this.history.indexOf(operation);
      if (opIndex !== -1) {
        this.currentIndex = opIndex;
      }

      this.saveToStorage();
      this.notifyListeners();

      return {
        success: failedFiles.length === 0,
        operation,
        restoredFiles,
        failedFiles,
      };
    } catch (error: any) {
      console.error('[OperationHistory] Redo failed:', error);
      return {
        success: false,
        operation,
        restoredFiles,
        failedFiles,
        error: error.message || 'Redo failed',
      };
    }
  }

  /**
   * Reverses a single file change.
   */
  private async reverseChange(change: FileChange, operation: OperationRecord): Promise<void> {
    switch (change.type) {
      case 'create':
        // Undo create = delete the created file/directory
        if (await exists(change.sourcePath)) {
          await remove(change.sourcePath, { recursive: change.isDirectory });
        }
        break;

      case 'delete':
        // Undo delete = restore from backup or recreate
        if (operation.hasBackup && operation.backupPath) {
          const backupFile = await join(operation.backupPath, await basename(change.sourcePath));
          if (await exists(backupFile)) {
            // Ensure parent directory exists
            const parentDir = await dirname(change.sourcePath);
            if (!(await exists(parentDir))) {
              await mkdir(parentDir, { recursive: true });
            }
            // Copy from backup
            const content = await readTextFile(backupFile);
            await writeTextFile(change.sourcePath, content);
          }
        } else if (change.originalContent !== undefined) {
          // Recreate from stored content
          const parentDir = await dirname(change.sourcePath);
          if (!(await exists(parentDir))) {
            await mkdir(parentDir, { recursive: true });
          }
          await writeTextFile(change.sourcePath, change.originalContent);
        } else {
          throw new Error('Cannot restore deleted file: no backup or content available');
        }
        break;

      case 'move':
        // Undo move = move back to original location
        if (change.targetPath && await exists(change.targetPath)) {
          // Ensure original parent directory exists
          const originalParent = await dirname(change.sourcePath);
          if (!(await exists(originalParent))) {
            await mkdir(originalParent, { recursive: true });
          }
          await rename(change.targetPath, change.sourcePath);
        }
        break;

      case 'copy':
        // Undo copy = delete the copy
        if (change.targetPath && await exists(change.targetPath)) {
          await remove(change.targetPath, { recursive: change.isDirectory });
        }
        break;

      case 'rename':
        // Undo rename = rename back
        if (change.targetPath && await exists(change.targetPath)) {
          await rename(change.targetPath, change.sourcePath);
        }
        break;

      case 'modify':
        // Undo modify = restore original content
        if (change.originalContent !== undefined) {
          await writeTextFile(change.sourcePath, change.originalContent);
        } else {
          throw new Error('Cannot restore modified file: no original content stored');
        }
        break;
    }
  }

  /**
   * Re-applies a single file change (for redo).
   */
  private async applyChange(change: FileChange): Promise<void> {
    switch (change.type) {
      case 'create':
        // Recreate the file
        if (change.newContent !== undefined) {
          const parentDir = await dirname(change.sourcePath);
          if (!(await exists(parentDir))) {
            await mkdir(parentDir, { recursive: true });
          }
          await writeTextFile(change.sourcePath, change.newContent);
        } else if (change.isDirectory) {
          await mkdir(change.sourcePath, { recursive: true });
        }
        break;

      case 'delete':
        // Delete again
        if (await exists(change.sourcePath)) {
          await remove(change.sourcePath, { recursive: change.isDirectory });
        }
        break;

      case 'move':
        // Move again
        if (change.targetPath && await exists(change.sourcePath)) {
          const targetParent = await dirname(change.targetPath);
          if (!(await exists(targetParent))) {
            await mkdir(targetParent, { recursive: true });
          }
          await rename(change.sourcePath, change.targetPath);
        }
        break;

      case 'copy':
        // Copy again
        if (change.targetPath && await exists(change.sourcePath)) {
          const content = await readTextFile(change.sourcePath);
          const targetParent = await dirname(change.targetPath);
          if (!(await exists(targetParent))) {
            await mkdir(targetParent, { recursive: true });
          }
          await writeTextFile(change.targetPath, content);
        }
        break;

      case 'rename':
        // Rename again
        if (change.targetPath && await exists(change.sourcePath)) {
          await rename(change.sourcePath, change.targetPath);
        }
        break;

      case 'modify':
        // Apply the modification again
        if (change.newContent !== undefined) {
          await writeTextFile(change.sourcePath, change.newContent);
        }
        break;
    }
  }

  /**
   * Creates a backup of files before a destructive operation.
   * @param filePaths - Paths to backup
   * @returns Backup directory path
   */
  async createBackup(filePaths: string[]): Promise<string | null> {
    if (!this.settings.autoBackup || filePaths.length === 0) {
      return null;
    }

    try {
      // Create backup directory with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupDir = await join(BACKUP_DIR, `backup-${timestamp}`);
      
      await mkdir(backupDir, { recursive: true });

      // Copy each file to backup
      for (const filePath of filePaths) {
        try {
          if (await exists(filePath)) {
            const content = await readTextFile(filePath);
            const backupFile = await join(backupDir, await basename(filePath));
            await writeTextFile(backupFile, content);
          }
        } catch (error) {
          console.warn(`[OperationHistory] Could not backup ${filePath}:`, error);
        }
      }

      console.log(`[OperationHistory] Created backup at: ${backupDir}`);
      return backupDir;
    } catch (error) {
      console.error('[OperationHistory] Backup creation failed:', error);
      return null;
    }
  }

  /**
   * Gets the full operation history.
   */
  getHistory(): OperationRecord[] {
    return [...this.history];
  }

  /**
   * Gets recent operations (most recent first).
   * @param count - Number of operations to return
   */
  getRecentOperations(count: number = 10): OperationRecord[] {
    return this.history.slice(-count).reverse();
  }

  /**
   * Gets operations by type.
   */
  getOperationsByType(type: OperationType): OperationRecord[] {
    return this.history.filter(op => op.type === type);
  }

  /**
   * Gets operations by status.
   */
  getOperationsByStatus(status: OperationStatus): OperationRecord[] {
    return this.history.filter(op => op.status === status);
  }

  /**
   * Gets an operation by ID.
   */
  getOperation(id: string): OperationRecord | undefined {
    return this.history.find(op => op.id === id);
  }

  /**
   * Gets undo/redo stack sizes.
   */
  getStackInfo(): { undoCount: number; redoCount: number; total: number } {
    let undoCount = 0;
    let redoCount = 0;

    for (let i = 0; i <= this.currentIndex; i++) {
      if (this.history[i]?.status === 'completed' && this.history[i]?.canUndo) {
        undoCount++;
      }
    }

    for (let i = this.currentIndex + 1; i < this.history.length; i++) {
      if (this.history[i]?.status === 'undone') {
        redoCount++;
      }
    }

    return {
      undoCount,
      redoCount,
      total: this.history.length,
    };
  }

  /**
   * Clears all history.
   */
  clearHistory(): void {
    this.history = [];
    this.currentIndex = -1;
    this.saveToStorage();
    this.notifyListeners();
    console.log('[OperationHistory] History cleared');
  }

  /**
   * Registers a listener for history changes.
   */
  addListener(listener: HistoryChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notifies all listeners of changes.
   */
  private notifyListeners(): void {
    const stackInfo = this.getStackInfo();
    for (const listener of this.listeners) {
      try {
        listener(this.history, stackInfo.undoCount, stackInfo.redoCount);
      } catch (error) {
        console.error('[OperationHistory] Listener error:', error);
      }
    }
  }

  /**
   * Saves history to localStorage.
   */
  private saveToStorage(): void {
    if (!this.settings.persistHistory) return;

    try {
      const data = {
        history: this.history,
        currentIndex: this.currentIndex,
        savedAt: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('[OperationHistory] Could not save to storage:', error);
    }
  }

  /**
   * Loads history from localStorage.
   */
  private async loadFromStorage(): Promise<void> {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.history = data.history || [];
        this.currentIndex = data.currentIndex ?? this.history.length - 1;
        
        // Validate operations still make sense (files still exist, etc.)
        // For now, just load as-is
        console.log(`[OperationHistory] Loaded ${this.history.length} operations from storage`);
      }
    } catch (error) {
      console.warn('[OperationHistory] Could not load from storage:', error);
      this.history = [];
      this.currentIndex = -1;
    }
  }

  /**
   * Exports history for debugging or backup.
   */
  exportHistory(): string {
    return JSON.stringify({
      history: this.history,
      currentIndex: this.currentIndex,
      exportedAt: new Date().toISOString(),
    }, null, 2);
  }

  /**
   * Imports history from a backup.
   */
  importHistory(data: string): boolean {
    try {
      const parsed = JSON.parse(data);
      if (parsed.history && Array.isArray(parsed.history)) {
        this.history = parsed.history;
        this.currentIndex = parsed.currentIndex ?? this.history.length - 1;
        this.trimHistory();
        this.saveToStorage();
        this.notifyListeners();
        return true;
      }
      return false;
    } catch (error) {
      console.error('[OperationHistory] Import failed:', error);
      return false;
    }
  }
}

/**
 * Singleton instance with default settings.
 */
export const operationHistory = new OperationHistoryManager();

/**
 * Factory function to create a history manager with custom settings.
 */
export function createOperationHistoryManager(settings?: Partial<OperationHistorySettings>): OperationHistoryManager {
  return new OperationHistoryManager(settings);
}

/**
 * Helper function to create a file change record.
 */
export function createFileChange(
  type: FileChange['type'],
  sourcePath: string,
  options?: Partial<Omit<FileChange, 'type' | 'sourcePath'>>
): FileChange {
  return {
    type,
    sourcePath,
    success: true,
    ...options,
  };
}

/**
 * Helper function to determine if an operation type is undoable.
 */
export function isOperationUndoable(type: OperationType): boolean {
  // Most operations are undoable, except terminal commands
  const nonUndoable: OperationType[] = [];
  return !nonUndoable.includes(type);
}

/**
 * Maps tool names to operation types.
 */
export function getOperationTypeFromTool(toolName: string): OperationType | null {
  const mapping: Record<string, OperationType> = {
    'write_file_content': 'create_file',
    'create_directory': 'create_directory',
    'delete_files': 'delete_file',
    'batch_delete': 'bulk_delete',
    'move_file': 'move_file',
    'copy_file': 'copy_file',
    'rename_files': 'rename_file',
    'file_copy_tab': 'bulk_copy',
    'folder_creation_tab': 'bulk_create',
    'file_creation_tab': 'bulk_create',
    'find_replace_tab': 'find_replace',
    'organize_files': 'organize',
    'execute_operation': 'organize',
  };
  
  return mapping[toolName] || null;
}
