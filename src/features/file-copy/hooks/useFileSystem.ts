import { useState, useCallback } from 'react';
import { readDir, stat, copyFile as tauriCopyFile, rename } from '@tauri-apps/plugin-fs';
import { open } from '@tauri-apps/plugin-dialog';
import { join } from '@tauri-apps/api/path';
import { usePersistentState } from '../../../hooks/usePersistentState';

export interface FileEntry {
    path: string;
    name: string;
    isDirectory: boolean;
    size?: number;
    extension?: string;
}

export const useFileSystem = () => {
    const [currentPath, setCurrentPath] = usePersistentState<string>('filesystem-current-path', '');
    const [error, setError] = useState<string | null>(null);

    const selectDirectory = useCallback(async () => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
            });

            if (selected && typeof selected === 'string') {
                setCurrentPath(selected);
            }
        } catch (err) {
            console.error('Failed to select directory:', err);
            setError('Failed to select directory');
        }
    }, []);

    const getDirectoryContents = useCallback(async (path: string): Promise<FileEntry[]> => {
        try {
            const entries = await readDir(path);

            const fileEntries: FileEntry[] = await Promise.all(
                entries.map(async (entry) => {
                    const entryPath = await join(path, entry.name);
                    let size = 0;
                    try {
                        if (entry.isFile) {
                            const metadata = await stat(entryPath);
                            size = metadata.size;
                        }
                    } catch (e) {
                        // Ignore stat errors (permissions etc)
                    }

                    return {
                        path: entryPath,
                        name: entry.name,
                        isDirectory: entry.isDirectory,
                        size: size,
                        extension: entry.name.split('.').pop()?.toLowerCase(),
                    };
                })
            );

            // Sort: Folders first, then files
            return fileEntries.sort((a, b) => {
                if (a.isDirectory === b.isDirectory) {
                    return a.name.localeCompare(b.name);
                }
                return a.isDirectory ? -1 : 1;
            });

        } catch (err) {
            console.error(`Failed to read directory ${path}:`, err);
            throw err;
        }
    }, []);

    const copyFile = useCallback(async (srcPath: string, destPath: string) => {
        await tauriCopyFile(srcPath, destPath);
    }, []);

    const moveFile = useCallback(async (srcPath: string, destPath: string) => {
        await rename(srcPath, destPath);
    }, []);

    return {
        currentPath,
        error,
        selectDirectory,
        getDirectoryContents,
        copyFile,
        moveFile,
        setCurrentPath
    };
};
