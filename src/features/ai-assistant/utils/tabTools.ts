/**
 * File: src/features/ai-assistant/utils/tabTools.ts
 * 
 * Tool interfaces for integrating with other File Manager Pro tabs.
 * Allows the AI to use File Copy, Folder Creation, Empty Files, and Find & Replace as tools.
 */

import { readDir, stat } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import { createFolders, generatePreview, type FolderConfig, type PreviewNode } from '../../folder-creation/utils/folderUtils';
import { generatePreview as generateFilePreview, type FileConfig } from '../../empty-files/utils/fileGenerator';
import { writeTextFile, exists, mkdir } from '@tauri-apps/plugin-fs';
import { searchFiles, type SearchOptions, type FileResult } from '../../find-replace/utils/searchLogic';
import { replaceInFile } from '../../find-replace/utils/replaceLogic';
import { copyFile as tauriCopyFile, rename } from '@tauri-apps/plugin-fs';

/**
 * Tool execution result with progress support.
 */
export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  progress?: {
    current: number;
    total: number;
    status: string;
    percentage: number;
  };
}

/**
 * Progress callback for streaming updates.
 */
export type ProgressCallback = (progress: ToolResult['progress']) => void;

/**
 * File Copy Tool Interface
 */
export interface FileCopyToolParams {
  sourcePath: string;
  destinationPath: string;
  fileTypes?: string[]; // e.g., ['*.py', '*.js']
  excludePatterns?: string[]; // e.g., ['*test*', '*temp*']
  operation: 'copy' | 'move';
  includeSubdirectories?: boolean;
  overwrite?: boolean;
}

export async function executeFileCopyTool(
  params: FileCopyToolParams,
  onProgress?: ProgressCallback
): Promise<ToolResult> {
  try {
    // Collect files based on filters
    const files: Array<{ path: string; name: string; size: number }> = [];
    
    const collectFiles = async (dir: string, basePath: string) => {
      try {
        const entries = await readDir(dir);
        
        for (const entry of entries) {
          const entryPath = await join(dir, entry.name);
          
          if (entry.isDirectory && params.includeSubdirectories) {
            await collectFiles(entryPath, basePath);
          } else if (entry.isFile) {
            // Check file type filter
            const extension = entry.name.split('.').pop()?.toLowerCase() || '';
            const matchesType = !params.fileTypes || params.fileTypes.some(pattern => {
              const ext = pattern.replace('*.', '').toLowerCase();
              return extension === ext || pattern === '*';
            });
            
            // Check exclude patterns
            const isExcluded = params.excludePatterns?.some(pattern => {
              const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');
              return regex.test(entry.name);
            });
            
            if (matchesType && !isExcluded) {
              const metadata = await stat(entryPath);
              files.push({
                path: entryPath,
                name: entry.name,
                size: metadata.size,
              });
            }
          }
        }
      } catch (error) {
        console.warn(`Error reading directory ${dir}:`, error);
      }
    };
    
    await collectFiles(params.sourcePath, params.sourcePath);
    
    if (files.length === 0) {
      return {
        success: false,
        error: 'No files found matching the criteria',
      };
    }
    
    // Execute copy/move operation
    let completed = 0;
    const errors: string[] = [];
    
    for (const file of files) {
      try {
        const targetPath = await join(params.destinationPath, file.name);
        
        // Check if file exists
        const fileExists = await exists(targetPath);
        if (fileExists && !params.overwrite) {
          completed++;
          onProgress?.({
            current: completed,
            total: files.length,
            status: `Skipped ${file.name} (already exists)`,
            percentage: (completed / files.length) * 100,
          });
          continue;
        }
        
        onProgress?.({
          current: completed,
          total: files.length,
          status: `${params.operation === 'copy' ? 'Copying' : 'Moving'} ${file.name}...`,
          percentage: (completed / files.length) * 100,
        });
        
        if (params.operation === 'copy') {
          await tauriCopyFile(file.path, targetPath);
        } else {
          await rename(file.path, targetPath);
        }
        
        completed++;
        onProgress?.({
          current: completed,
          total: files.length,
          status: `${params.operation === 'copy' ? 'Copied' : 'Moved'} ${file.name}`,
          percentage: (completed / files.length) * 100,
        });
      } catch (error: any) {
        errors.push(`${file.name}: ${error.message}`);
        console.error(`Failed to ${params.operation} ${file.name}:`, error);
      }
    }
    
    return {
      success: errors.length === 0,
      data: {
        filesProcessed: completed,
        totalFiles: files.length,
        errors: errors.length > 0 ? errors : undefined,
      },
      error: errors.length > 0 ? `${errors.length} errors occurred` : undefined,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to execute file copy operation',
    };
  }
}

/**
 * Folder Creation Tool Interface
 */
export interface FolderCreationToolParams {
  rootPath: string;
  folderNames: string[]; // Array of folder names to create
  subfolders?: string[]; // Subfolders to create in each main folder
  datePrefix?: boolean;
  dateFormat?: string;
  numbering?: boolean;
  numberFormat?: string; // e.g., "01", "001"
}

export async function executeFolderCreationTool(
  params: FolderCreationToolParams,
  onProgress?: ProgressCallback
): Promise<ToolResult> {
  try {
    if (!params.rootPath) {
      return {
        success: false,
        error: 'Root path is required',
      };
    }
    
    const config: FolderConfig = {
      rootPath: params.rootPath,
      count: params.folderNames.length,
      prefix: '',
      subfolders: params.subfolders?.join(',') || '',
      namingPattern: params.numbering ? 'Number - Name' : 'Name Only',
      datePosition: params.datePrefix ? 'Prefix' : 'None',
      dateFormat: params.dateFormat || 'YYYY-MM-DD',
      subfolderPrefix: '',
      subfolderSuffix: '',
    };
    
    // Generate preview nodes with custom names
    const nodes: PreviewNode[] = [];
    
    // Normalize subfolders - handle both array of strings and array of arrays
    let normalizedSubfolders: string[] = [];
    if (params.subfolders && params.subfolders.length > 0) {
      // Check if it's a nested array (array of arrays)
      if (Array.isArray(params.subfolders[0])) {
        // If nested, flatten or use first set (all folders get same subfolders)
        normalizedSubfolders = (params.subfolders[0] as any[]).filter((s: any) => s && String(s).trim().length > 0).map((s: any) => String(s).trim());
      } else {
        // Flat array - filter out empty strings
        normalizedSubfolders = params.subfolders
          .filter((s: any) => s && String(s).trim().length > 0)
          .map((s: any) => String(s).trim());
      }
    }
    
    params.folderNames.forEach((name, index) => {
      const number = params.numbering 
        ? String(index + 1).padStart(params.numberFormat?.length || 2, '0')
        : '';
      const folderName = params.numbering 
        ? `${number} - ${name}`
        : name;
      
      const mainNode: PreviewNode = {
        id: `folder-${index}`,
        name: folderName,
        type: 'folder',
        children: normalizedSubfolders.map((sub, subIndex) => ({
          id: `folder-${index}-sub-${subIndex}`,
          name: sub,
          type: 'folder',
          children: [],
        })),
      };
      
      nodes.push(mainNode);
    });
    
    // Create folders
    let created = 0;
    const total = nodes.length;
    
    await createFolders(config, nodes, (current, total, statusText) => {
      created = current;
      onProgress?.({
        current,
        total,
        status: statusText,
        percentage: (current / total) * 100,
      });
    });
    
    // Count total folders including subfolders
    const totalSubfolders = nodes.reduce((sum, node) => sum + (node.children?.length || 0), 0);
    const totalFoldersCreated = created + totalSubfolders;
    
    return {
      success: true,
      data: {
        foldersCreated: created,
        totalFolders: total,
        subfoldersCreated: totalSubfolders,
        totalFoldersIncludingSubfolders: totalFoldersCreated,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to create folders',
    };
  }
}

/**
 * File Creation Tool Interface
 */
export interface FileCreationToolParams {
  rootPath: string;
  baseName: string;
  extensions: string[];
  count: number;
  useNumbering?: boolean;
  startNumber?: number;
  digitCount?: number;
  useDate?: boolean;
  dateFormat?: string;
  datePosition?: 'prefix' | 'suffix';
  overwrite?: boolean;
}

export async function executeFileCreationTool(
  params: FileCreationToolParams,
  onProgress?: ProgressCallback
): Promise<ToolResult> {
  try {
    if (!params.rootPath) {
      return {
        success: false,
        error: 'Root path is required',
      };
    }
    
    const config: FileConfig = {
      rootPath: params.rootPath,
      baseName: params.baseName,
      extensions: params.extensions,
      useNumbering: params.useNumbering ?? true,
      count: params.count,
      startNumber: params.startNumber || 1,
      digitCount: params.digitCount || 2,
      numberPosition: 'suffix',
      separator: '_',
      useDate: params.useDate ?? false,
      dateFormat: (params.dateFormat as any) || 'YYYY-MM-DD',
      datePosition: params.datePosition || 'prefix',
      overwrite: params.overwrite ?? false,
      // Additional required fields for FileConfig
      customPrefix: '',
      customSuffix: '',
      useRandomString: false,
      randomStringLength: 8,
      randomStringPosition: 'suffix',
      useUUID: false,
      uuidPosition: 'suffix',
      creationMode: 'pattern',
      fileList: '',
    };
    
    // Generate file list
    const previewFiles = await generateFilePreview(config);
    
    if (previewFiles.length === 0) {
      return {
        success: false,
        error: 'No files were generated. Check your configuration (baseName, extensions, count).',
      };
    }
    
    let created = 0;
    const errors: string[] = [];
    const createdFiles: string[] = [];
    
    // Ensure root directory exists
    try {
      const rootExists = await exists(config.rootPath);
      if (!rootExists) {
        await mkdir(config.rootPath, { recursive: true });
      }
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to access/create root directory: ${error.message}`,
      };
    }
    
    for (let i = 0; i < previewFiles.length; i++) {
      const file = previewFiles[i];
      try {
        const fullPath = await join(config.rootPath, file.name);
        
        const fileExists = await exists(fullPath);
        if (fileExists && !config.overwrite) {
          onProgress?.({
            current: i + 1,
            total: previewFiles.length,
            status: `Skipped ${file.name} (already exists)`,
            percentage: ((i + 1) / previewFiles.length) * 100,
          });
          continue;
        }
        
        // Create the file with empty content
        await writeTextFile(fullPath, '');
        created++;
        createdFiles.push(file.name);
        
        console.log(`Successfully created file: ${fullPath}`);
        
        onProgress?.({
          current: i + 1,
          total: previewFiles.length,
          status: `Created ${file.name}`,
          percentage: ((i + 1) / previewFiles.length) * 100,
        });
      } catch (error: any) {
        const errorMsg = error?.message || 'Unknown error';
        errors.push(`${file.name}: ${errorMsg}`);
        console.error(`Failed to create ${file.name} at ${await join(config.rootPath, file.name)}:`, error);
      }
    }
    
    return {
      success: created > 0,
      data: {
        filesCreated: created,
        totalFiles: previewFiles.length,
        createdFileNames: createdFiles,
        errors: errors.length > 0 ? errors : undefined,
      },
      error: errors.length > 0 && created === 0 
        ? `Failed to create files: ${errors.join('; ')}` 
        : errors.length > 0 
          ? `Created ${created} files, but ${errors.length} failed: ${errors.join('; ')}`
          : undefined,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to create files',
    };
  }
}

/**
 * Find & Replace Tool Interface
 */
export interface FindReplaceToolParams {
  rootPath: string;
  searchQuery: string;
  replaceQuery?: string;
  filePattern?: string; // e.g., "*.sql", "*.js"
  useRegex?: boolean;
  matchCase?: boolean;
  wholeWord?: boolean;
  includeSubdirectories?: boolean;
}

export async function executeFindReplaceTool(
  params: FindReplaceToolParams,
  onProgress?: ProgressCallback
): Promise<ToolResult> {
  try {
    if (!params.rootPath) {
      return {
        success: false,
        error: 'Root path is required',
      };
    }
    
    const options: SearchOptions = {
      matchCase: params.matchCase ?? false,
      useRegex: params.useRegex ?? false,
      wholeWord: params.wholeWord ?? false,
      includePattern: params.filePattern || '*',
      excludePattern: '',
    };
    
    // Search for matches
    let scanned = 0;
    let found = 0;
    
    const results = await searchFiles(
      params.rootPath,
      params.searchQuery,
      options,
      (scannedCount, foundCount) => {
        scanned = scannedCount;
        found = foundCount;
        onProgress?.({
          current: scannedCount,
          total: scannedCount, // We don't know total in advance
          status: `Found ${foundCount} matches in ${scannedCount} files`,
          percentage: 0, // Indeterminate
        });
      },
      () => false
    );
    
    if (results.length === 0) {
      return {
        success: true,
        data: {
          matchesFound: 0,
          filesScanned: scanned,
          message: 'No matches found',
        },
      };
    }
    
    // If replace query is provided, perform replacement
    if (params.replaceQuery !== undefined) {
      let replaced = 0;
      const errors: string[] = [];
      
      for (const result of results) {
        try {
          const replacements = result.matches.map(match => ({
            line: match.line,
            oldText: match.text,
            newText: params.replaceQuery || '',
            matchIndex: match.matchIndex,
          }));
          
          await replaceInFile(result.path, replacements, true);
          replaced += replacements.length;
          
          onProgress?.({
            current: replaced,
            total: results.reduce((sum, r) => sum + r.matches.length, 0),
            status: `Replaced ${replaced} matches`,
            percentage: 0,
          });
        } catch (error: any) {
          errors.push(`${result.path}: ${error.message}`);
        }
      }
      
      return {
        success: errors.length === 0,
        data: {
          matchesFound: found,
          matchesReplaced: replaced,
          filesAffected: results.length,
          errors: errors.length > 0 ? errors : undefined,
        },
        error: errors.length > 0 ? `${errors.length} errors occurred` : undefined,
      };
    }
    
    // Return search results only
    return {
      success: true,
      data: {
        matchesFound: found,
        filesAffected: results.length,
        results: results.map(r => ({
          path: r.path,
          matchCount: r.matches.length,
        })),
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to execute find & replace',
    };
  }
}
