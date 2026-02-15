/**
 * File: src/features/file-copy/components/ErrorBoundary.tsx
 *
 * Front-end error boundary component for catching and displaying React errors.
 * Provides graceful error handling for the File Copy Tab components.
 */

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center h-full p-12 text-center">
          <div className="flex flex-col items-center gap-4 p-8 border-2 border-dashed border-red-300 dark:border-red-700 rounded-xl bg-red-50/50 dark:bg-red-900/30 max-w-md">
            <AlertCircle className="h-12 w-12 text-red-500 dark:text-red-400 opacity-50" />
            <div className="space-y-2">
              <p className="text-base font-medium text-red-700 dark:text-red-300">
                Something went wrong
              </p>
              <p className="text-sm text-red-600 dark:text-red-400">
                {this.state.error?.message || "An unexpected error occurred"}
              </p>
              <Button
                onClick={this.handleReset}
                variant="outline"
                className="mt-4"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
