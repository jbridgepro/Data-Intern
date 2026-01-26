import React, { createContext, useContext, useState, ReactNode } from "react";

export interface EditorTab {
  id: string;
  name: string;
  path: string;
  isActive: boolean;
}

interface EditorContextType {
  openFiles: EditorTab[];
  activeFileId: string | null;
  openFile: (path: string, name: string) => void;
  closeFile: (id: string) => void;
  activateFile: (id: string) => void;
  updateFile: (id: string, updates: Partial<EditorTab>) => void;
}

const EditorContext = createContext<EditorContextType | undefined>(undefined);

export const useEditor = () => {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error("useEditor must be used within an EditorProvider");
  }
  return context;
};

interface EditorProviderProps {
  children: ReactNode;
}

export const EditorProvider = ({ children }: EditorProviderProps) => {
  const [openFiles, setOpenFiles] = useState<EditorTab[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);

  const openFile = (path: string, name: string) => {
    setOpenFiles((prev) => {
      const existing = prev.find((f) => f.path === path);
      if (existing) {
        setActiveFileId(existing.id);
        return prev.map(f => f.id === existing.id ? { ...f, isActive: true } : { ...f, isActive: false });
      }

      const newFile: EditorTab = {
        id: Date.now().toString(),
        name,
        path,
        isActive: true, // Auto-activate new file
      };
      
      // Deactivate others
      const stored = prev.map(f => ({ ...f, isActive: false }));
      
      setActiveFileId(newFile.id);
      return [...stored, newFile];
    });
  };

  const closeFile = (id: string) => {
    setOpenFiles((prev) => {
      const filtered = prev.filter((f) => f.id !== id);
      
      // If we closed the active file, activate the last one
      if (activeFileId === id && filtered.length > 0) {
        const last = filtered[filtered.length - 1];
        setActiveFileId(last.id);
        
        return filtered.map(f => f.id === last.id ? { ...f, isActive: true } : f);
      } else if (filtered.length === 0) {
         setActiveFileId(null);
      }

      return filtered;
    });
  };

  const activateFile = (id: string) => {
    setActiveFileId(id);
    setOpenFiles(prev => prev.map(f => ({
      ...f,
      isActive: f.id === id
    })));
  };

  const updateFile = (id: string, updates: Partial<EditorTab>) => {
      setOpenFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  return (
    <EditorContext.Provider
      value={{
        openFiles,
        activeFileId,
        openFile,
        closeFile,
        activateFile,
        updateFile
      }}
    >
      {children}
    </EditorContext.Provider>
  );
};
