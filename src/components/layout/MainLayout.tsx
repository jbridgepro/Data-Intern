/**
 * File: src/components/layout/MainLayout.tsx
 *
 * Frontend: Main Layout component
 * Provides the root layout structure for the application with support for title bar and status bar
 */

import { ReactNode } from "react";

interface MainLayoutProps {
  children: ReactNode;
}

export const MainLayout = ({ children }: MainLayoutProps) => {
  return (
    <div className="flex flex-col h-screen w-full bg-white dark:bg-slate-950 transition-colors duration-300 overflow-hidden">
      {children}
    </div>
  );
};
