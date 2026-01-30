
import React, { useState, useRef } from "react";
import { Camera, Download, Copy, CheckCircle, Image as ImageIcon } from "lucide-react";
import html2canvas from "html2canvas";

export const ScreenshotTool: React.FC = () => {
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [copied, setCopied] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const captureScreen = async () => {
    setIsCapturing(true);
    try {
      // Capture the entire document body (excluding this tool's UI)
      const element = document.body;
      const canvas = await html2canvas(element, {
        backgroundColor: null,
        scale: window.devicePixelRatio || 1,
        logging: false,
        useCORS: true,
        ignoreElements: (el) => el.id === "screenshot-tool-container",
      });

      const dataUrl = canvas.toDataURL("image/png");
      setScreenshotUrl(dataUrl);
    } catch (error) {
      console.error("Screenshot failed:", error);
    } finally {
      setIsCapturing(false);
    }
  };

  const downloadScreenshot = () => {
    if (!screenshotUrl) return;
    const link = document.createElement("a");
    link.download = `screenshot-${Date.now()}.png`;
    link.href = screenshotUrl;
    link.click();
  };

  const copyToClipboard = async () => {
    if (!screenshotUrl) return;
    try {
      const response = await fetch(screenshotUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Copy failed:", error);
    }
  };

  return (
    <div id="screenshot-tool-container" className="flex h-full flex-col p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600 dark:bg-cyan-900/20 dark:text-cyan-400">
            <Camera className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Screenshot
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Capture the current application view
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {screenshotUrl && (
            <>
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                {copied ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                onClick={downloadScreenshot}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <Download className="h-4 w-4" />
                Download
              </button>
            </>
          )}
          <button
            onClick={captureScreen}
            disabled={isCapturing}
            className="flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-50"
          >
            <Camera className="h-4 w-4" />
            {isCapturing ? "Capturing..." : "Capture Screen"}
          </button>
        </div>
      </div>

      <div
        ref={previewRef}
        className="flex-1 rounded-xl border border-slate-200 bg-slate-50 shadow-sm dark:border-slate-800 dark:bg-slate-900/50 flex items-center justify-center overflow-hidden"
      >
        {screenshotUrl ? (
          <img
            src={screenshotUrl}
            alt="Screenshot"
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <div className="flex flex-col items-center gap-4 text-slate-400">
            <ImageIcon className="h-16 w-16" />
            <p className="text-sm">No screenshot yet. Click "Capture Screen" to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
};
