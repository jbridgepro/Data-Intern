import React, { useState, useRef, useEffect, useCallback } from "react";
import { Command, Child } from "@tauri-apps/plugin-shell";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { readFile } from "@tauri-apps/plugin-fs";
import { convertFileSrc } from "@tauri-apps/api/core";
import {
  FileVideo,
  FileAudio,
  FileImage,
  FileText,
  Upload,
  RefreshCw,
  Trash2,
  CheckCircle,
  Loader2,
  FolderOpen,
  Film,
  Music,
  Image as ImageIcon,
  FileType,
  X,
  Play,
  Pause,
  StopCircle,
  ExternalLink,
  Settings2,
  Sparkles,
  AlertCircle,
  Sliders,
  Monitor,
  Volume2,
  ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";

// ... (Types and Constants remain identical)
interface ConversionJob {
  id: string;
  filePath: string;
  name: string;
  type: "video" | "audio" | "image" | "document";
  status: "pending" | "converting" | "completed" | "error" | "cancelled";
  progress: number;
  outputFormat: string;
  error?: string;
  outputPath?: string;
  duration?: number;
  childProcess?: Child;
}

const SUPPORTED_VIDEO_FORMATS = ["mp4", "mkv", "avi", "mov", "webm", "gif", "wmv", "flv", "3gp", "mpg", "m4v", "ts"];
const SUPPORTED_AUDIO_FORMATS = ["mp3", "wav", "ogg", "m4a", "flac", "aac", "wma", "aiff", "alac", "opus"];
const SUPPORTED_IMAGE_FORMATS = ["jpg", "png", "webp", "gif", "bmp", "tiff", "ico", "heic"];
const SUPPORTED_DOCUMENT_FORMATS = ["pdf", "docx", "doc", "rtf", "txt", "html", "odt"];

const VIDEO_RESOLUTIONS = [
  { id: "original", label: "Original", scale: null },
  { id: "4k", label: "4K (2160p)", scale: "3840:2160" },
  { id: "1080p", label: "1080p", scale: "1920:1080" },
  { id: "720p", label: "720p", scale: "1280:720" },
  { id: "480p", label: "480p", scale: "854:480" },
  { id: "360p", label: "360p", scale: "640:360" },
];

const AUDIO_BITRATES = [
  { id: "320", label: "320 kbps", value: "320k", description: "Best quality" },
  { id: "256", label: "256 kbps", value: "256k", description: "High quality" },
  { id: "192", label: "192 kbps", value: "192k", description: "Good quality" },
  { id: "128", label: "128 kbps", value: "128k", description: "Standard" },
  { id: "96", label: "96 kbps", value: "96k", description: "Smaller file" },
  { id: "64", label: "64 kbps", value: "64k", description: "Voice/Podcast" },
];

const getQualityLabel = (quality: number): string => {
  if (quality >= 90) return "Excellent";
  if (quality >= 70) return "High";
  if (quality >= 50) return "Good";
  if (quality >= 30) return "Medium";
  return "Low";
};

const qualityToCrf = (quality: number): number => Math.round(35 - (quality / 100) * 20);

export const FileConverter: React.FC = () => {
  const [jobs, setJobs] = useState<ConversionJob[]>([]);
  const [converting, setConverting] = useState(false);
  const [targetFormats, setTargetFormats] = useState<{ [key: string]: string }>({
    video: "mp4",
    audio: "mp3",
    image: "png",
    document: "pdf"
  });
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [destinationPath, setDestinationPath] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [loadingPreview, setLoadingPreview] = useState(false);
  
  const [videoQuality, setVideoQuality] = useState<number>(70);
  const [videoResolution, setVideoResolution] = useState<string>("original");
  const [audioBitrate, setAudioBitrate] = useState<string>("192");
  const [imageQuality, setImageQuality] = useState<number>(90);

  const childProcesses = useRef<Map<string, Child>>(new Map());
  const activePreviewJob = useRef<string | null>(null);

  useEffect(() => {
    if (jobs.length > 0 && !selectedJobId) {
      setSelectedJobId(jobs[0].id);
    }
  }, [jobs, selectedJobId]);

  useEffect(() => {
    return () => {
      // Cleanup object URLs on unmount
      Object.values(previewUrls).forEach(url => {
        if (url.startsWith("blob:")) URL.revokeObjectURL(url);
      });
      childProcesses.current.forEach(child => {
        try { child.kill(); } catch {}
      });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateJobFormats = (type: string, format: string) => {
    setTargetFormats(prev => ({ ...prev, [type]: format }));
    setJobs(prev => prev.map(job => 
      (job.type === type && job.status === "pending") 
        ? { ...job, outputFormat: format } 
        : job
    ));
  };

  const generatePreview = useCallback(async (job: ConversionJob) => {
    if (previewUrls[job.id]) return; // Already cached
    if (activePreviewJob.current === job.id) return; // Already generating
    
    activePreviewJob.current = job.id;
    setLoadingPreview(true);

    try {
      if (job.type === "image") {
        // Read file to blob to avoid asset protocol issues
        try {
            const contents = await readFile(job.filePath);
            const blob = new Blob([contents]);
            const url = URL.createObjectURL(blob);
            setPreviewUrls(prev => ({ ...prev, [job.id]: url }));
        } catch (e) {
            console.error("Failed to read image", e);
            // Fallback to convertFileSrc if read fails (unlikely if permissions correct)
            setPreviewUrls(prev => ({ ...prev, [job.id]: convertFileSrc(job.filePath) }));
        }
      } else if (job.type === "document") {
        if (job.filePath.toLowerCase().endsWith(".pdf")) {
            setPreviewUrls(prev => ({ ...prev, [job.id]: convertFileSrc(job.filePath) }));
        } else {
            // Generate temp PDF
            const tempPdfPath = `/tmp/preview_${job.id}.pdf`;
            const args = ["-c", `cupsfilter "${job.filePath}" > "${tempPdfPath}"`];
            // We use 'sh' to execute cupsfilter with redirection
            const command = Command.create("sh", args);
            
            // Execute and wait
            const output = await command.execute();
            if (output.code === 0) {
                 // Success
                 setPreviewUrls(prev => ({ ...prev, [job.id]: convertFileSrc(tempPdfPath) }));
            } else {
                 console.error("Preview generation failed", output.stderr);
            }
        }
      }
    } catch (e) {
      console.error("Preview error", e);
    } finally {
      setLoadingPreview(false);
      activePreviewJob.current = null;
    }
  }, [previewUrls]);

  // Trigger preview generation when selected job changes
  useEffect(() => {
    if (selectedJobId) {
        const job = jobs.find(j => j.id === selectedJobId);
        if (job) {
             // For video/audio we use convertFileSrc directly in the JSX usually, but for consistency we could do it here
             // But existing video/audio logic works with convertFileSrc.
             // We only implemented special handling for Image/Doc.
             if (job.type === "image" || job.type === "document") {
                 generatePreview(job);
             }
        }
    }
  }, [selectedJobId, jobs, generatePreview]);

  // ... (Helper functions: determineFileType, addFilesFromPaths, handleSelectFiles, HandleDrop etc. - Same as before)
  const determineFileType = (ext: string): "video" | "audio" | "image" | "document" => {
    if (SUPPORTED_VIDEO_FORMATS.includes(ext)) return "video";
    if (SUPPORTED_AUDIO_FORMATS.includes(ext)) return "audio";
    if (SUPPORTED_IMAGE_FORMATS.includes(ext)) return "image";
    return "document";
  };

  const addFilesFromPaths = useCallback((paths: string[]) => {
    const newJobs: ConversionJob[] = paths.map(path => {
      const name = path.split(/[/\\]/).pop() || "unknown";
      const ext = name.split(".").pop()?.toLowerCase() || "";
      const type = determineFileType(ext);

      return {
        id: Math.random().toString(36).substring(7),
        filePath: path,
        name: name,
        type,
        status: "pending",
        progress: 0,
        outputFormat: targetFormats[type],
      };
    });

    setJobs(prev => [...prev, ...newJobs]);
  }, [targetFormats]);

  const handleSelectFiles = async (type: "video" | "audio" | "image" | "document") => {
    try {
      let extensions: string[] = [];
      let name = "Files";
      
      switch (type) {
        case "video": extensions = SUPPORTED_VIDEO_FORMATS; name = "Videos"; break;
        case "audio": extensions = SUPPORTED_AUDIO_FORMATS; name = "Audio"; break;
        case "image": extensions = SUPPORTED_IMAGE_FORMATS; name = "Images"; break;
        case "document": extensions = ["pdf", "docx", "doc", "rtf", "txt", "html", "odt"]; name = "Documents"; break;
      }

      const selected = await openDialog({
        multiple: true,
        filters: [{ name, extensions }]
      });

      if (!selected) return;

      const newFiles = Array.isArray(selected) ? selected : [selected];
      addFilesFromPaths(newFiles);
    } catch (err) {
      console.error("Failed to select files", err);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (!files.length) return;

    const paths: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i] as File & { path?: string };
      if (file.path) paths.push(file.path);
    }
    
    if (paths.length > 0) addFilesFromPaths(paths);
  }, [addFilesFromPaths]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleSelectDestination = async () => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "Select Output Folder"
      });
      if (selected && typeof selected === "string") {
        setDestinationPath(selected);
      }
    } catch (err) {
      console.error("Failed to select destination", err);
    }
  };

  const openOutputFolder = async () => {
    const path = destinationPath || (selectedJob?.filePath ? selectedJob.filePath.substring(0, selectedJob.filePath.lastIndexOf(/[/\\]/.exec(selectedJob.filePath)?.[0] ?? "/")) : null);
    if (path) {
      try {
        await revealItemInDir(path);
      } catch (err) {
        console.error("Failed to open folder", err);
      }
    }
  };

  const removeJob = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    // Cleanup preview URL if exists
    if (previewUrls[id] && previewUrls[id].startsWith("blob:")) {
        URL.revokeObjectURL(previewUrls[id]);
        setPreviewUrls(prev => { const n = {...prev}; delete n[id]; return n; });
    }
    
    const child = childProcesses.current.get(id);
    if (child) {
      try { child.kill(); } catch {}
      childProcesses.current.delete(id);
    }
    setJobs(prev => {
      const filtered = prev.filter(job => job.id !== id);
      if (selectedJobId === id) setSelectedJobId(filtered.length > 0 ? filtered[0].id : null);
      return filtered;
    });
  };

  const clearAll = () => {
    // Cleanup all
    Object.values(previewUrls).forEach(url => {
        if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    });
    setPreviewUrls({});
    
    childProcesses.current.forEach(child => { try { child.kill(); } catch {} });
    childProcesses.current.clear();
    setJobs([]);
    setSelectedJobId(null);
  };

  const cancelJob = (jobId: string) => {
    const child = childProcesses.current.get(jobId);
    if (child) {
      try { child.kill(); } catch {}
      childProcesses.current.delete(jobId);
    }
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: "cancelled", error: "Cancelled by user" } : j));
  };

  const getDuration = async (filePath: string): Promise<number> => {
    try {
      const command = Command.create("ffprobe", [
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        filePath
      ]);
      const output = await command.execute();
      const duration = parseFloat(output.stdout.trim());
      return isNaN(duration) ? 0 : duration;
    } catch {
      return 0;
    }
  };

  const runConversion = async (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    let duration = 0;
    if (job.type === "video" || job.type === "audio") {
      duration = await getDuration(job.filePath);
    }
    
    setJobs(prev => prev.map(j => (j.id === jobId ? { ...j, status: "converting", progress: 0, error: undefined, duration } : j)));

    try {
      const fileDir = job.filePath.substring(0, job.filePath.lastIndexOf(/[/\\]/.exec(job.filePath)?.[0] ?? "/"));
      const fileNameWithoutExt = job.name.substring(0, job.name.lastIndexOf("."));
      const targetFormat = targetFormats[job.type]; 
      
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, outputFormat: targetFormat } : j));

      const outputNameReal = `${fileNameWithoutExt}_converted.${targetFormat}`;
      const sep = job.filePath.includes("\\") ? "\\" : "/";
      const outputDir = destinationPath || fileDir;
      const outputPath = `${outputDir}${sep}${outputNameReal}`;

      let command: Command<string>;

      if (job.type === "document") {
        if (targetFormat === "pdf") {
          const args = ["-c", `cupsfilter "${job.filePath}" > "${outputPath}"`];
          command = Command.create("sh", args);
        } else {
          const args = ["-convert", targetFormat, "-output", outputPath, job.filePath];
          command = Command.create("textutil", args);
        }
      } else {
        const args = ["-i", job.filePath];
        
        if (job.type === "video") {
          if (targetFormat === "wmv") {
            args.push("-c:v", "wmv2", "-c:a", "wmav2", "-q:v", String(Math.max(2, Math.round(15 - (videoQuality/100)*14))));
          } else if (targetFormat === "mp4") {
            args.push("-c:v", "libx264", "-crf", String(qualityToCrf(videoQuality)), "-preset", "medium", "-movflags", "+faststart");
            args.push("-c:a", "aac", "-b:a", "128k");
          } else {
             args.push("-c:v", "libx264", "-crf", String(qualityToCrf(videoQuality)));
          }
          
          if (targetFormat !== "gif") {
             const resolution = VIDEO_RESOLUTIONS.find(r => r.id === videoResolution);
             if (resolution?.scale) args.push("-vf", `scale=${resolution.scale}:force_original_aspect_ratio=decrease`);
          }
        } else if (job.type === "audio") {
           const bitrate = AUDIO_BITRATES.find(b => b.id === audioBitrate)?.value || "192k";
           args.push("-b:a", bitrate);
        } else if (job.type === "image") {
           if (targetFormat === "jpg" || targetFormat === "jpeg") {
             const q = Math.round(31 - (imageQuality / 100) * 30);
             args.push("-q:v", String(Math.max(1, q)));
           }
        }

        args.push(outputPath, "-y", "-progress", "pipe:1");
        command = Command.create("ffmpeg", args);
      }

      command.on("close", (data: { code: number | null; signal: number | null }) => {
        childProcesses.current.delete(jobId);
        if (data.code === 0) {
          setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: "completed", progress: 100, outputPath } : j));
        } else {
           setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: "error", error: `Conversion failed (Code ${data.code})` } : j));
        }
      });
      
      command.stdout.on("data", (line: string) => {
          if (duration > 0 && (job.type === "video" || job.type === "audio")) {
              const timeMatch = line.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
              if (timeMatch) {
                  const s = parseInt(timeMatch[1])*3600 + parseInt(timeMatch[2])*60 + parseInt(timeMatch[3]);
                  const p = Math.min(Math.round((s / duration) * 100), 99);
                  setJobs(prev => prev.map(j => j.id === jobId ? { ...j, progress: p } : j));
              }
          }
      });

      const child = await command.spawn();
      childProcesses.current.set(jobId, child);

    } catch (e) {
      childProcesses.current.delete(jobId);
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: "error", error: String(e) } : j));
    }
  };

  const convertAll = async () => {
    setConverting(true);
    const pendingJobs = jobs.filter(j => j.status === "pending" || j.status === "error");
    for (const job of pendingJobs) {
      if (jobs.find(j => j.id === job.id)?.status === "cancelled") continue;
      await runConversion(job.id);
    }
    setConverting(false);
  };

  const selectedJob = jobs.find(j => j.id === selectedJobId);
  const pendingCount = jobs.filter(j => j.status === "pending" || j.status === "error").length;
  const completedCount = jobs.filter(j => j.status === "completed").length;
  
  const currentFormat = selectedJob ? targetFormats[selectedJob.type] : "mp4";
  const previewUrl = selectedJob ? previewUrls[selectedJob.id] : null;

  return (
    <div 
      className="flex h-full flex-col bg-slate-50 dark:bg-black/20"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* ... (Drag Overlay, Top Bar, Settings Panel - identical to previous, just ensure imports match) */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-blue-500/20 backdrop-blur-sm border-4 border-dashed border-blue-500 rounded-xl m-2">
          <div className="text-center">
            <Upload className="h-16 w-16 mx-auto text-blue-500 mb-4 animate-bounce" />
            <p className="text-xl font-bold text-blue-600 dark:text-blue-400">Drop files here</p>
          </div>
        </div>
      )}

       <div className="flex items-center gap-2 p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm z-10 overflow-x-auto">
        <div className="flex gap-2">
            <button onClick={() => handleSelectFiles("video")} className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 transition-colors whitespace-nowrap">
            <Film className="h-3.5 w-3.5" /> Video
            </button>
            <button onClick={() => handleSelectFiles("audio")} className="flex items-center gap-1.5 rounded-lg bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-600 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400 dark:hover:bg-purple-900/50 transition-colors whitespace-nowrap">
            <Music className="h-3.5 w-3.5" /> Audio
            </button>
            <button onClick={() => handleSelectFiles("image")} className="flex items-center gap-1.5 rounded-lg bg-pink-50 px-3 py-2 text-xs font-semibold text-pink-600 hover:bg-pink-100 dark:bg-pink-900/30 dark:text-pink-400 dark:hover:bg-pink-900/50 transition-colors whitespace-nowrap">
            <ImageIcon className="h-3.5 w-3.5" /> Image
            </button>
            <button onClick={() => handleSelectFiles("document")} className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-600 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50 transition-colors whitespace-nowrap">
            <FileText className="h-3.5 w-3.5" /> Doc
            </button>
        </div>
        
        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1 flex-shrink-0" />
        
        <div className="ml-auto flex items-center gap-2">
           <button onClick={() => setShowSettings(!showSettings)} className={cn("p-2 rounded-lg transition-colors flex items-center gap-2", showSettings ? "bg-blue-100 text-blue-600" : "text-slate-400 hover:bg-slate-100")}>
             <Sliders className="h-5 w-5" />
           </button>
           {(destinationPath || selectedJob?.outputPath) && (
             <button onClick={openOutputFolder} className="p-2 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100"><ExternalLink className="h-5 w-5" /></button>
           )}
           {jobs.length > 0 && (
             <button onClick={clearAll} className="p-2 text-slate-400 hover:text-red-500 rounded-md hover:bg-slate-100"><Trash2 className="h-5 w-5" /></button>
           )}
        </div>
      </div>

     {showSettings && (
        <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 animate-in slide-in-from-top-2 duration-200">
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
             {/* Target Formats for each type */}
             <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Video Output</label>
                <select value={targetFormats.video} onChange={e => updateJobFormats("video", e.target.value)} className="w-full text-sm p-2 rounded border bg-white dark:bg-slate-800">
                   {SUPPORTED_VIDEO_FORMATS.map(f => <option key={f} value={f}>{f.toUpperCase()}</option>)}
                </select>
             </div>
             <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Audio Output</label>
                <select value={targetFormats.audio} onChange={e => updateJobFormats("audio", e.target.value)} className="w-full text-sm p-2 rounded border bg-white dark:bg-slate-800">
                   {SUPPORTED_AUDIO_FORMATS.map(f => <option key={f} value={f}>{f.toUpperCase()}</option>)}
                </select>
             </div>
             <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Image Output</label>
                <select value={targetFormats.image} onChange={e => updateJobFormats("image", e.target.value)} className="w-full text-sm p-2 rounded border bg-white dark:bg-slate-800">
                   {SUPPORTED_IMAGE_FORMATS.map(f => <option key={f} value={f}>{f.toUpperCase()}</option>)}
                </select>
             </div>
             <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Document Output</label>
                <select value={targetFormats.document} onChange={e => updateJobFormats("document", e.target.value)} className="w-full text-sm p-2 rounded border bg-white dark:bg-slate-800">
                   {SUPPORTED_DOCUMENT_FORMATS.map(f => <option key={f} value={f}>{f.toUpperCase()}</option>)}
                </select>
             </div>
             
             {/* Quality/Destination Row */}
             <div className="col-span-1 md:col-span-2 lg:col-span-4 flex flex-wrap gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                   <span className="text-xs font-bold text-slate-500 uppercase">Quality</span>
                   <div className="flex-1 flex items-center gap-2">
                      <input type="range" min="0" max="100" value={videoQuality} onChange={e => { setVideoQuality(Number(e.target.value)); setImageQuality(Number(e.target.value)); }} className="flex-1 h-1.5 bg-slate-200 rounded-full" />
                      <span className="text-xs font-bold">{videoQuality}%</span>
                   </div>
                </div>
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                   <span className="text-xs font-bold text-slate-500 uppercase">Destination</span>
                   <div className="flex-1 flex gap-1">
                      <div className="flex-1 px-2 py-1.5 bg-slate-50 border rounded text-xs truncate text-slate-500">{destinationPath || "Start specific"}</div>
                      <button onClick={handleSelectDestination} className="p-1.5 bg-slate-100 rounded hover:bg-slate-200"><FolderOpen className="h-4 w-4" /></button>
                   </div>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Main Content (File List + Preview) */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: List */}
        <div className="w-1/2 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 overflow-y-auto p-2">
             {jobs.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                    <Upload className="h-12 w-12 mb-2" />
                    <p>Drag files here</p>
                 </div>
             ) : (
                 <div className="space-y-1">
                    {jobs.map(job => (
                        <div key={job.id} onClick={() => setSelectedJobId(job.id)} className={cn("flex items-center gap-3 p-2 rounded border cursor-pointer", selectedJobId === job.id ? "bg-blue-50 border-blue-200" : "hover:bg-slate-50 border-transparent")}>
                            <div className="h-8 w-8 flex items-center justify-center bg-slate-100 rounded text-slate-500">
                                {job.type === "video" && <Film className="h-4 w-4" />}
                                {job.type === "audio" && <Music className="h-4 w-4" />}
                                {job.type === "image" && <ImageIcon className="h-4 w-4" />}
                                {job.type === "document" && <FileText className="h-4 w-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="truncate text-sm font-medium">{job.name}</p>
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <span className="uppercase">{job.outputFormat}</span>
                                    {job.status === "converting" && <span className="text-blue-500">{job.progress}%</span>}
                                    {job.status === "completed" && <span className="text-emerald-500">Done</span>}
                                    {job.status === "error" && <span className="text-red-500">Error</span>}
                                </div>
                            </div>
                            {(job.status === "pending" || job.status === "converting") && (
                                <button onClick={e => { e.stopPropagation(); cancelJob(job.id); }} className="p-1 text-slate-400 hover:text-red-500"><X className="h-4 w-4" /></button>
                            )}
                        </div>
                    ))}
                 </div>
             )}
        </div>
        
        {/* Right: Preview */}
        <div className="w-1/2 bg-slate-100 dark:bg-black/40 flex items-center justify-center p-4">
             {selectedJob ? (
                 <div className="text-center space-y-4 max-w-full w-full flex flex-col items-center">
                     {/* Preview Box */}
                     <div className="relative rounded-lg overflow-hidden shadow-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-black max-h-[400px] w-full max-w-lg flex items-center justify-center min-h-[250px] aspect-video">
                         {loadingPreview && (
                             <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-black/80 z-20">
                                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                                <span className="ml-2 text-sm font-medium">Loading Preview...</span>
                             </div>
                         )}

                         {selectedJob.type === "video" && (
                            <video controls src={convertFileSrc(selectedJob.filePath)} className="h-full w-full object-contain" />
                         )}
                         {selectedJob.type === "audio" && (
                            <div className="p-8"><Music className="h-16 w-16 text-purple-500" /></div>
                         )}
                         {selectedJob.type === "image" && (
                            <div className="w-full h-full flex items-center justify-center bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGAQYcAP3uCTZhw1gGGYhAGBZIA/nYDCgBDAm9BGDWAAjyQc6GkKDgQA6e0q6JRlyBwAAAAASUVORK5CYII=')] bg-repeat">
                               {previewUrl ? (
                                   <img src={previewUrl} className="max-h-full max-w-full object-contain shadow-sm" onError={(e) => console.error("Img error", e)} />
                               ) : (
                                   <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                               )}
                            </div>
                         )}
                         {selectedJob.type === "document" && (
                            previewUrl ? (
                               <iframe src={previewUrl} className="w-full h-full border-none bg-white" />
                            ) : (
                               <div className="p-8 flex flex-col items-center gap-2">
                                  <FileText className="h-20 w-20 text-amber-500 opacity-80" />
                                  <p className="text-xs text-slate-400">{loadingPreview ? "Generating Preview..." : "Preview not available"}</p>
                               </div>
                            )
                         )}
                         
                         {selectedJob.status === "completed" && <div className="absolute top-2 right-2 bg-emerald-500 text-white p-1 rounded-full z-10"><CheckCircle className="h-4 w-4" /></div>}
                     </div>
                     
                     <div className="max-w-md w-full">
                        <h3 className="font-medium truncate text-center">{selectedJob.name}</h3>
                        <p className="text-xs text-slate-500 text-center">Target: {selectedJob.outputFormat.toUpperCase()}</p>
                        {selectedJob.error && <p className="text-xs text-red-500 text-center mt-1">{selectedJob.error}</p>}
                     </div>

                     {selectedJob.status === "completed" && selectedJob.outputPath && (
                        <button onClick={() => selectedJob.outputPath && revealItemInDir(selectedJob.outputPath)} className="text-xs text-blue-600 hover:underline">Show in Folder</button>
                     )}
                 </div>
             ) : (
                 <div className="text-slate-400 text-center">
                    <p>Select a file to preview</p>
                 </div>
             )}
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center">
          <div className="text-sm text-slate-500">
             {pendingCount} pending, {completedCount} completed
          </div>
          <button onClick={convertAll} disabled={converting || pendingCount===0} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold shadow hover:bg-blue-700 disabled:opacity-50 disabled:shadow-none transition-all flex items-center gap-2">
             {converting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
             {converting ? "Converting..." : "Convert All"}
          </button>
      </div>
    </div>
  );
};
