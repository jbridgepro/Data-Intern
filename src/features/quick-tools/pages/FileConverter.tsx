/**
 * File: src/features/quick-tools/pages/FileConverter.tsx
 *
 * Front-end: File Converter tool for Quick Tools.
 * Converts video, audio, image, document, and spreadsheet files between formats.
 * Uses FFmpeg for media, cupsfilter/textutil for documents,
 * LibreOffice (soffice) for spreadsheet conversions, and Python3 fast-paths
 * for lightweight CSV transformations (CSV ↔ TSV, CSV → JSON).
 *
 * Key features:
 * - Rich file preview with metadata overlays (dimensions, size, duration, codec)
 * - Image format controls: aspect ratio, max dimension, quality/compression
 * - Context-aware settings panel shows controls only for the selected file type
 * - Per-file output format selection with smart defaults
 * - Spreadsheet support: CSV, XLSX, XLS, TSV with delimiter & header options
 * - Individual and batch conversion support
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Command, Child } from "@tauri-apps/plugin-shell";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { readFile } from "@tauri-apps/plugin-fs";
import { convertFileSrc } from "@tauri-apps/api/core";
import {
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
  X,
  Play,
  AlertCircle,
  ArrowRight,
  Sparkles,
  MonitorPlay,
  Volume2,
  Palette,
  FileType2,
  SquareArrowOutUpRight,
  CircleStop,
  Ban,
  Plus,
  FileSpreadsheet,
  Table2,
  Ratio,
  HardDrive,
  Clock,
  Maximize2,
  Info,
  Edit3,
  TrendingDown,
  Equal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Types                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

/** Supported file type categories */
type FileCategory = "video" | "audio" | "image" | "document" | "spreadsheet";

/** Metadata extracted from a file via ffprobe or stat */
interface FileMetadata {
  fileSize: number;
  width?: number;
  height?: number;
  duration?: number;
  codec?: string;
  bitRate?: number;
  sampleRate?: number;
  channels?: number;
}

/** Represents a single file queued for conversion */
interface ConversionJob {
  id: string;
  filePath: string;
  name: string;
  sourceExtension: string;
  type: FileCategory;
  status: "pending" | "converting" | "completed" | "error" | "cancelled";
  progress: number;
  outputFormat: string;
  error?: string;
  outputPath?: string;
  duration?: number;
  childProcess?: Child;
  /* Output filename customization */
  customOutputName?: string;
  /* Video settings */
  videoQuality?: number;
  videoResolution?: string;
  /* Audio settings */
  audioBitrate?: string;
  /* Image settings */
  imageQuality?: number;
  imageAspectRatio?: string;
  imageMaxDim?: string;
  /* Spreadsheet settings */
  csvDelimiter?: string;
  includeHeaders?: boolean;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Format & Quality Constants                                               */
/* ────────────────────────────────────────────────────────────────────────── */

const SUPPORTED_VIDEO_FORMATS = ["mp4", "mkv", "avi", "mov", "webm", "gif", "wmv", "flv", "3gp", "mpg", "m4v", "ts"];
const SUPPORTED_AUDIO_FORMATS = ["mp3", "wav", "ogg", "m4a", "flac", "aac", "wma", "aiff", "alac", "opus"];
const SUPPORTED_IMAGE_FORMATS = ["jpg", "png", "webp", "gif", "bmp", "tiff", "ico", "heic"];
const SUPPORTED_DOCUMENT_FORMATS = ["pdf", "docx", "doc", "rtf", "txt", "html", "odt"];
const SUPPORTED_SPREADSHEET_FORMATS = ["csv", "xlsx", "xls", "tsv", "json"];
const SPREADSHEET_OUTPUT_FORMATS = ["csv", "xlsx", "xls", "tsv", "json", "pdf", "html"];

const RECOMMENDED_FORMATS: Record<string, string[]> = {
  video: ["mp4", "webm", "mkv", "gif"],
  audio: ["mp3", "wav", "flac", "aac", "ogg"],
  image: ["png", "jpg", "webp"],
  document: ["pdf", "docx", "txt", "html"],
  spreadsheet: ["csv", "xlsx", "json", "pdf"],
};

const CSV_DELIMITERS = [
  { id: "comma", label: "Comma (,)", value: ",", description: "Standard CSV" },
  { id: "semicolon", label: "Semicolon (;)", value: ";", description: "European CSV" },
  { id: "tab", label: "Tab", value: "\t", description: "TSV-style" },
  { id: "pipe", label: "Pipe (|)", value: "|", description: "Pipe-delimited" },
];

const VIDEO_RESOLUTIONS = [
  { id: "original", label: "Original", scale: null, description: "Keep source resolution" },
  { id: "4k", label: "4K (2160p)", scale: "3840:2160", description: "Ultra HD" },
  { id: "1080p", label: "1080p", scale: "1920:1080", description: "Full HD" },
  { id: "720p", label: "720p", scale: "1280:720", description: "HD" },
  { id: "480p", label: "480p", scale: "854:480", description: "SD" },
  { id: "360p", label: "360p", scale: "640:360", description: "Low" },
];

const AUDIO_BITRATES = [
  { id: "320", label: "320 kbps", value: "320k", description: "Best quality" },
  { id: "256", label: "256 kbps", value: "256k", description: "High quality" },
  { id: "192", label: "192 kbps", value: "192k", description: "Good quality" },
  { id: "128", label: "128 kbps", value: "128k", description: "Standard" },
  { id: "96", label: "96 kbps", value: "96k", description: "Smaller file" },
  { id: "64", label: "64 kbps", value: "64k", description: "Voice / Podcast" },
];

/** Aspect ratio presets for image cropping */
const IMAGE_ASPECT_RATIOS = [
  { id: "original", label: "Original", ratio: 0, description: "No crop" },
  { id: "1:1", label: "1 : 1", ratio: 1, description: "Square" },
  { id: "4:3", label: "4 : 3", ratio: 4 / 3, description: "Standard" },
  { id: "3:2", label: "3 : 2", ratio: 3 / 2, description: "Classic Photo" },
  { id: "16:9", label: "16 : 9", ratio: 16 / 9, description: "Widescreen" },
  { id: "9:16", label: "9 : 16", ratio: 9 / 16, description: "Portrait" },
  { id: "3:4", label: "3 : 4", ratio: 3 / 4, description: "Portrait Std" },
  { id: "2:3", label: "2 : 3", ratio: 2 / 3, description: "Portrait Classic" },
];

/** Max-dimension presets for image resizing (longest side) */
const IMAGE_MAX_DIM_PRESETS = [
  { id: "original", label: "Original Size", maxDim: 0, description: "No resize" },
  { id: "3840", label: "3840 px", maxDim: 3840, description: "4K" },
  { id: "1920", label: "1920 px", maxDim: 1920, description: "Full HD" },
  { id: "1280", label: "1280 px", maxDim: 1280, description: "HD" },
  { id: "1024", label: "1024 px", maxDim: 1024, description: "Web large" },
  { id: "800", label: "800 px", maxDim: 800, description: "Web medium" },
  { id: "512", label: "512 px", maxDim: 512, description: "Thumbnail" },
  { id: "256", label: "256 px", maxDim: 256, description: "Icon" },
  { id: "128", label: "128 px", maxDim: 128, description: "Tiny" },
];

/* ────────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

/** Human-readable quality label from 0-100 slider value */
const GetQualityLabel = (quality: number): string => {
  if (quality >= 90) return "Excellent";
  if (quality >= 70) return "High";
  if (quality >= 50) return "Good";
  if (quality >= 30) return "Medium";
  return "Low";
};

/** Map 0-100 quality to FFmpeg CRF value (lower CRF = higher quality) */
const QualityToCrf = (quality: number): number => Math.round(35 - (quality / 100) * 20);

/** Format bytes to human-readable string */
const FormatFileSize = (bytes: number): string => {
  if (bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(1))} ${units[i]}`;
};

/** Format seconds to human-readable duration string */
const FormatDuration = (seconds: number): string => {
  if (seconds <= 0) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (mins < 60) return `${mins}:${String(secs).padStart(2, "0")}`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}:${String(mins % 60).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

/** Compute a readable aspect ratio string from width and height */
const ComputeAspectRatioLabel = (w: number, h: number): string => {
  if (!w || !h) return "—";
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const d = gcd(w, h);
  const rw = w / d;
  const rh = h / d;
  // Simplify common ratios
  if (rw <= 32 && rh <= 32) return `${rw}:${rh}`;
  // Fallback to decimal
  return `${(w / h).toFixed(2)}:1`;
};

/** Whether the image output format supports a quality slider */
const ImageFormatSupportsQuality = (format: string): boolean => {
  return ["jpg", "jpeg", "webp", "heic"].includes(format);
};

const DetermineFileType = (extension: string): FileCategory => {
  if (SUPPORTED_VIDEO_FORMATS.includes(extension)) return "video";
  if (SUPPORTED_AUDIO_FORMATS.includes(extension)) return "audio";
  if (SUPPORTED_IMAGE_FORMATS.includes(extension)) return "image";
  if (SUPPORTED_SPREADSHEET_FORMATS.includes(extension)) return "spreadsheet";
  return "document";
};

const GetFormatsForType = (type: FileCategory): string[] => {
  switch (type) {
    case "video": return SUPPORTED_VIDEO_FORMATS;
    case "audio": return SUPPORTED_AUDIO_FORMATS;
    case "image": return SUPPORTED_IMAGE_FORMATS;
    case "document": return SUPPORTED_DOCUMENT_FORMATS;
    case "spreadsheet": return SPREADSHEET_OUTPUT_FORMATS;
  }
};

const GetDefaultOutputFormat = (type: FileCategory, sourceExtension: string): string => {
  const recommended = RECOMMENDED_FORMATS[type];
  const different = recommended.find(f => f !== sourceExtension);
  if (different) return different;
  const allFormats = GetFormatsForType(type);
  return allFormats.find(f => f !== sourceExtension) || allFormats[0];
};

const FileTypeIcon: React.FC<{ type: FileCategory; className?: string }> = ({ type, className }) => {
  switch (type) {
    case "video": return <Film className={className} />;
    case "audio": return <Music className={className} />;
    case "image": return <ImageIcon className={className} />;
    case "document": return <FileText className={className} />;
    case "spreadsheet": return <FileSpreadsheet className={className} />;
  }
};

const TYPE_COLORS: Record<string, { bg: string; text: string; border: string; badgeBg: string; badgeText: string }> = {
  video: { bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-600 dark:text-blue-400", border: "border-blue-200 dark:border-blue-800", badgeBg: "bg-blue-100 dark:bg-blue-900/50", badgeText: "text-blue-700 dark:text-blue-300" },
  audio: { bg: "bg-purple-50 dark:bg-purple-950/30", text: "text-purple-600 dark:text-purple-400", border: "border-purple-200 dark:border-purple-800", badgeBg: "bg-purple-100 dark:bg-purple-900/50", badgeText: "text-purple-700 dark:text-purple-300" },
  image: { bg: "bg-pink-50 dark:bg-pink-950/30", text: "text-pink-600 dark:text-pink-400", border: "border-pink-200 dark:border-pink-800", badgeBg: "bg-pink-100 dark:bg-pink-900/50", badgeText: "text-pink-700 dark:text-pink-300" },
  document: { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-600 dark:text-amber-400", border: "border-amber-200 dark:border-amber-800", badgeBg: "bg-amber-100 dark:bg-amber-900/50", badgeText: "text-amber-700 dark:text-amber-300" },
  spreadsheet: { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-800", badgeBg: "bg-emerald-100 dark:bg-emerald-900/50", badgeText: "text-emerald-700 dark:text-emerald-300" },
};

const CanUsePythonFastPath = (sourceExt: string, targetFormat: string): boolean => {
  return ["csv", "tsv"].includes(sourceExt) && ["csv", "tsv", "json"].includes(targetFormat);
};

/* ────────────────────────────────────────────────────────────────────────── */
/*  Metadata Info Pill — small overlay badge for the preview area             */
/* ────────────────────────────────────────────────────────────────────────── */

const MetaPill: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] font-medium backdrop-blur-sm">
    {icon}
    {label}
  </span>
);

/* ────────────────────────────────────────────────────────────────────────── */
/*  FileConverter Component                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

export const FileConverter: React.FC = () => {
  /* ── State ────────────────────────────────────────────────────────────── */
  const [jobs, setJobs] = useState<ConversionJob[]>([]);
  const [converting, setConverting] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [destinationPath, setDestinationPath] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [fileMetadata, setFileMetadata] = useState<Record<string, FileMetadata>>({});

  const [defaultVideoQuality] = useState<number>(70);
  const [defaultVideoResolution] = useState<string>("original");
  const [defaultAudioBitrate] = useState<string>("192");
  const [defaultImageQuality] = useState<number>(90);

  const childProcesses = useRef<Map<string, Child>>(new Map());
  const activePreviewJob = useRef<string | null>(null);

  /* ── Derived ─────────────────────────────────────────────────────────── */
  const selectedJob = useMemo(() => jobs.find(j => j.id === selectedJobId) ?? null, [jobs, selectedJobId]);
  const selectedMeta = useMemo(() => selectedJob ? fileMetadata[selectedJob.id] : null, [selectedJob, fileMetadata]);
  const pendingCount = useMemo(() => jobs.filter(j => j.status === "pending" || j.status === "error").length, [jobs]);
  const completedCount = useMemo(() => jobs.filter(j => j.status === "completed").length, [jobs]);
  const convertingCount = useMemo(() => jobs.filter(j => j.status === "converting").length, [jobs]);

  /* ── Effects ─────────────────────────────────────────────────────────── */

  useEffect(() => {
    if (jobs.length > 0 && !selectedJobId) setSelectedJobId(jobs[0].id);
  }, [jobs, selectedJobId]);

  useEffect(() => {
    return () => {
      Object.values(previewUrls).forEach(url => { if (url.startsWith("blob:")) URL.revokeObjectURL(url); });
      childProcesses.current.forEach(child => { try { child.kill(); } catch { /* ignore */ } });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Metadata Fetching ───────────────────────────────────────────────── */

  /** Fetch file metadata using ffprobe (media/images) or stat (docs/sheets) */
  const fetchMetadata = useCallback(async (jobId: string, filePath: string, type: FileCategory) => {
    try {
      if (type === "video" || type === "audio" || type === "image") {
        const command = Command.create("ffprobe", [
          "-v", "error",
          "-show_entries", "format=size,duration,bit_rate:stream=width,height,codec_name,sample_rate,channels",
          "-of", "json", filePath,
        ]);
        const output = await command.execute();
        if (output.code === 0) {
          const data = JSON.parse(output.stdout);
          const fmt = data.format || {};
          const stream = data.streams?.[0] || {};
          setFileMetadata(prev => ({ ...prev, [jobId]: {
            fileSize: parseInt(fmt.size) || 0,
            width: stream.width || undefined,
            height: stream.height || undefined,
            duration: parseFloat(fmt.duration) || undefined,
            codec: stream.codec_name || undefined,
            bitRate: parseInt(fmt.bit_rate) || undefined,
            sampleRate: parseInt(stream.sample_rate) || undefined,
            channels: stream.channels || undefined,
          }}));
        }
      } else {
        const command = Command.create("sh", ["-c", `stat -f "%z" "${filePath}"`]);
        const output = await command.execute();
        if (output.code === 0) {
          setFileMetadata(prev => ({ ...prev, [jobId]: { fileSize: parseInt(output.stdout.trim()) || 0 } }));
        }
      }
    } catch { /* metadata is optional — silently fail */ }
  }, []);

  /* ── Preview Generation ──────────────────────────────────────────────── */

  /** Maps common audio/video extensions to their MIME types for blob URLs */
  const GetMediaMimeType = useCallback((ext: string, category: "audio" | "video"): string => {
    const audioMimes: Record<string, string> = {
      mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", m4a: "audio/mp4",
      flac: "audio/flac", aac: "audio/aac", wma: "audio/x-ms-wma",
      aiff: "audio/aiff", alac: "audio/mp4", opus: "audio/opus",
    };
    const videoMimes: Record<string, string> = {
      mp4: "video/mp4", mkv: "video/x-matroska", avi: "video/x-msvideo",
      mov: "video/quicktime", webm: "video/webm", gif: "image/gif",
      wmv: "video/x-ms-wmv", flv: "video/x-flv", "3gp": "video/3gpp",
      mpg: "video/mpeg", m4v: "video/mp4", ts: "video/mp2t",
    };
    if (category === "audio") return audioMimes[ext] || "audio/mpeg";
    return videoMimes[ext] || "video/mp4";
  }, []);

  const generatePreview = useCallback(async (job: ConversionJob) => {
    if (previewUrls[job.id]) return;
    if (activePreviewJob.current === job.id) return;
    activePreviewJob.current = job.id;
    setLoadingPreview(true);
    try {
      if (job.type === "audio" || job.type === "video") {
        /* Read the file as binary and create a blob URL with the correct MIME
           type. This avoids Tauri asset protocol limitations with HTTP range
           requests that HTML5 <audio>/<video> elements require for playback. */
        try {
          const contents = await readFile(job.filePath);
          const mimeType = GetMediaMimeType(job.sourceExtension, job.type);
          const blob = new Blob([contents], { type: mimeType });
          setPreviewUrls(prev => ({ ...prev, [job.id]: URL.createObjectURL(blob) }));
        } catch {
          // Fallback to convertFileSrc if blob read fails
          setPreviewUrls(prev => ({ ...prev, [job.id]: convertFileSrc(job.filePath) }));
        }
      } else if (job.type === "image") {
        try {
          const contents = await readFile(job.filePath);
          const blob = new Blob([contents]);
          setPreviewUrls(prev => ({ ...prev, [job.id]: URL.createObjectURL(blob) }));
        } catch {
          setPreviewUrls(prev => ({ ...prev, [job.id]: convertFileSrc(job.filePath) }));
        }
      } else if (job.type === "document") {
        if (job.filePath.toLowerCase().endsWith(".pdf")) {
          setPreviewUrls(prev => ({ ...prev, [job.id]: convertFileSrc(job.filePath) }));
        } else {
          const tempPdfPath = `/tmp/preview_${job.id}.pdf`;
          const cmd = Command.create("sh", ["-c", `cupsfilter "${job.filePath}" > "${tempPdfPath}"`]);
          const out = await cmd.execute();
          if (out.code === 0) setPreviewUrls(prev => ({ ...prev, [job.id]: convertFileSrc(tempPdfPath) }));
        }
      } else if (job.type === "spreadsheet" && ["csv", "tsv"].includes(job.sourceExtension)) {
        try {
          const contents = await readFile(job.filePath);
          const text = new TextDecoder("utf-8").decode(contents);
          setPreviewUrls(prev => ({ ...prev, [job.id]: `data:text/plain;base64,${btoa(unescape(encodeURIComponent(text)))}` }));
        } catch { /* optional */ }
      }
    } catch (err) { console.error("Preview error:", err); }
    finally { setLoadingPreview(false); activePreviewJob.current = null; }
  }, [previewUrls, GetMediaMimeType]);

  useEffect(() => {
    if (!selectedJobId) return;
    const job = jobs.find(j => j.id === selectedJobId);
    // Trigger preview generation for all previewable file types
    if (job && (job.type === "audio" || job.type === "video" || job.type === "image" || job.type === "document" || job.type === "spreadsheet")) generatePreview(job);
  }, [selectedJobId, jobs, generatePreview]);

  /* ── File Management ─────────────────────────────────────────────────── */

  const addFilesFromPaths = useCallback((paths: string[]) => {
    const newJobs: ConversionJob[] = paths.map(path => {
      const name = path.split(/[/\\]/).pop() || "unknown";
      const sourceExtension = name.split(".").pop()?.toLowerCase() || "";
      const type = DetermineFileType(sourceExtension);
      const id = Math.random().toString(36).substring(7);
      return {
        id, filePath: path, name, sourceExtension, type,
        status: "pending" as const, progress: 0,
        outputFormat: GetDefaultOutputFormat(type, sourceExtension),
        videoQuality: defaultVideoQuality, videoResolution: defaultVideoResolution,
        audioBitrate: defaultAudioBitrate, imageQuality: defaultImageQuality,
        imageAspectRatio: "original", imageMaxDim: "original",
        csvDelimiter: "comma", includeHeaders: true,
      };
    });
    // Fetch metadata for each new job
    newJobs.forEach(j => fetchMetadata(j.id, j.filePath, j.type));
    setJobs(prev => [...prev, ...newJobs]);
  }, [defaultVideoQuality, defaultVideoResolution, defaultAudioBitrate, defaultImageQuality, fetchMetadata]);

  const handleSelectFiles = async (type?: FileCategory) => {
    try {
      let extensions: string[] = [];
      let name = "All Supported Files";
      if (type) {
        switch (type) {
          case "video": extensions = SUPPORTED_VIDEO_FORMATS; name = "Videos"; break;
          case "audio": extensions = SUPPORTED_AUDIO_FORMATS; name = "Audio"; break;
          case "image": extensions = SUPPORTED_IMAGE_FORMATS; name = "Images"; break;
          case "document": extensions = SUPPORTED_DOCUMENT_FORMATS; name = "Documents"; break;
          case "spreadsheet": extensions = SUPPORTED_SPREADSHEET_FORMATS; name = "Spreadsheets"; break;
        }
      } else {
        extensions = [...SUPPORTED_VIDEO_FORMATS, ...SUPPORTED_AUDIO_FORMATS, ...SUPPORTED_IMAGE_FORMATS, ...SUPPORTED_DOCUMENT_FORMATS, ...SUPPORTED_SPREADSHEET_FORMATS];
      }
      const selected = await openDialog({ multiple: true, filters: [{ name, extensions }] });
      if (!selected) return;
      addFilesFromPaths(Array.isArray(selected) ? selected : [selected]);
    } catch (err) { console.error("Failed to select files:", err); }
  };

  /* ── Drag & Drop ─────────────────────────────────────────────────────── */

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const files = e.dataTransfer.files; if (!files.length) return;
    const paths: string[] = [];
    for (let i = 0; i < files.length; i++) { const f = files[i] as File & { path?: string }; if (f.path) paths.push(f.path); }
    if (paths.length > 0) addFilesFromPaths(paths);
  }, [addFilesFromPaths]);
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false); }, []);

  /* ── Destination ─────────────────────────────────────────────────────── */

  const handleSelectDestination = async () => {
    try {
      const selected = await openDialog({ directory: true, multiple: false, title: "Select Output Folder" });
      if (selected && typeof selected === "string") setDestinationPath(selected);
    } catch (err) { console.error("Failed to select destination:", err); }
  };

  const openOutputFolder = async (filePath?: string) => {
    const p = filePath || destinationPath;
    if (p) { try { await revealItemInDir(p); } catch (err) { console.error("Failed to open folder:", err); } }
  };

  /* ── Job Management ──────────────────────────────────────────────────── */

  const updateJobFormat = (jobId: string, format: string) => {
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, outputFormat: format } : j));
  };
  const updateJobSetting = (jobId: string, key: keyof ConversionJob, value: number | string | boolean) => {
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, [key]: value } : j));
  };

  const removeJob = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (previewUrls[id]?.startsWith("blob:")) { URL.revokeObjectURL(previewUrls[id]); setPreviewUrls(prev => { const n = { ...prev }; delete n[id]; return n; }); }
    const child = childProcesses.current.get(id);
    if (child) { try { child.kill(); } catch { /* ignore */ } childProcesses.current.delete(id); }
    setJobs(prev => { const filtered = prev.filter(j => j.id !== id); if (selectedJobId === id) setSelectedJobId(filtered[0]?.id ?? null); return filtered; });
  };

  const clearAll = () => {
    Object.values(previewUrls).forEach(url => { if (url.startsWith("blob:")) URL.revokeObjectURL(url); });
    setPreviewUrls({}); setFileMetadata({});
    childProcesses.current.forEach(child => { try { child.kill(); } catch { /* ignore */ } });
    childProcesses.current.clear(); setJobs([]); setSelectedJobId(null);
  };

  const cancelJob = (jobId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const child = childProcesses.current.get(jobId);
    if (child) { try { child.kill(); } catch { /* ignore */ } childProcesses.current.delete(jobId); }
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: "cancelled", error: "Cancelled by user" } : j));
  };

  /* ── Conversion Logic ────────────────────────────────────────────────── */

  const getDuration = async (filePath: string): Promise<number> => {
    try {
      const cmd = Command.create("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", filePath]);
      const out = await cmd.execute();
      const d = parseFloat(out.stdout.trim());
      return isNaN(d) ? 0 : d;
    } catch { return 0; }
  };

  const buildPythonSpreadsheetScript = (inputPath: string, outputPath: string, sourceExt: string, targetFormat: string, delimiter: string, includeHeaders: boolean): string => {
    const srcDelim = sourceExt === "tsv" ? "\\t" : delimiter === "\t" ? "\\t" : delimiter;
    const tgtDelim = targetFormat === "tsv" ? "\\t" : delimiter === "\t" ? "\\t" : delimiter;
    if (targetFormat === "json") {
      return [`import csv, json, sys`, `with open("${inputPath}", "r", newline="", encoding="utf-8-sig") as f:`, `    reader = csv.DictReader(f, delimiter="${srcDelim}")`, `    rows = list(reader)`, `with open("${outputPath}", "w", encoding="utf-8") as out:`, `    json.dump(rows, out, indent=2, ensure_ascii=False)`].join("\n");
    }
    return [`import csv, sys`, `with open("${inputPath}", "r", newline="", encoding="utf-8-sig") as f:`, `    reader = csv.reader(f, delimiter="${srcDelim}")`, `    rows = list(reader)`, `${!includeHeaders ? "rows = rows[1:] if len(rows) > 1 else rows" : ""}`, `with open("${outputPath}", "w", newline="", encoding="utf-8") as out:`, `    writer = csv.writer(out, delimiter="${tgtDelim}")`, `    writer.writerows(rows)`].join("\n");
  };

  const runConversion = async (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    let duration = 0;
    if (job.type === "video" || job.type === "audio") duration = await getDuration(job.filePath);

    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: "converting", progress: 0, error: undefined, duration } : j));

    try {
      const fileDir = job.filePath.substring(0, job.filePath.lastIndexOf(/[/\\]/.exec(job.filePath)?.[0] ?? "/"));
      const fileNameWithoutExt = job.name.substring(0, job.name.lastIndexOf("."));
      const targetFormat = job.outputFormat;
      const sep = job.filePath.includes("\\") ? "\\" : "/";
      const outputDir = destinationPath || fileDir;
      // Use custom output name if provided, otherwise use default naming
      const outputFileName = job.customOutputName 
        ? job.customOutputName 
        : `${fileNameWithoutExt}_converted`;
      const outputPath = `${outputDir}${sep}${outputFileName}.${targetFormat}`;

      const jobVideoQuality = job.videoQuality ?? defaultVideoQuality;
      const jobVideoResolution = job.videoResolution ?? defaultVideoResolution;
      const jobAudioBitrate = job.audioBitrate ?? defaultAudioBitrate;
      const jobImageQuality = job.imageQuality ?? defaultImageQuality;
      const jobCsvDelimiter = CSV_DELIMITERS.find(d => d.id === (job.csvDelimiter ?? "comma"))?.value ?? ",";
      const jobIncludeHeaders = job.includeHeaders ?? true;

      let command: Command<string>;

      if (job.type === "spreadsheet") {
        if (CanUsePythonFastPath(job.sourceExtension, targetFormat)) {
          command = Command.create("python3", ["-c", buildPythonSpreadsheetScript(job.filePath, outputPath, job.sourceExtension, targetFormat, jobCsvDelimiter, jobIncludeHeaders)]);
        } else {
          const tempDir = `/tmp/filepro_convert_${job.id}`;
          let loFormat = targetFormat;
          if (targetFormat === "tsv") loFormat = "csv";
          const script = [`mkdir -p "${tempDir}"`, `SOFFICE=$(command -v soffice 2>/dev/null || echo "/Applications/LibreOffice.app/Contents/MacOS/soffice")`, `if [ ! -x "$SOFFICE" ]; then echo "LibreOffice not found." >&2; exit 127; fi`, `"$SOFFICE" --headless --convert-to ${loFormat} --outdir "${tempDir}" "${job.filePath}"`, `OUTFILE=$(ls "${tempDir}"/*.${loFormat} 2>/dev/null | head -1)`, `if [ -z "$OUTFILE" ]; then echo "No output" >&2; exit 1; fi`, `mv "$OUTFILE" "${outputPath}"`, `rm -rf "${tempDir}"`].join(" && ");
          command = Command.create("sh", ["-c", script]);
        }
      } else if (job.type === "document") {
        if (targetFormat === "pdf") command = Command.create("sh", ["-c", `cupsfilter "${job.filePath}" > "${outputPath}"`]);
        else command = Command.create("textutil", ["-convert", targetFormat, "-output", outputPath, job.filePath]);
      } else {
        const args = ["-i", job.filePath];

        if (job.type === "video") {
          if (targetFormat === "wmv") args.push("-c:v", "wmv2", "-c:a", "wmav2", "-q:v", String(Math.max(2, Math.round(15 - (jobVideoQuality / 100) * 14))));
          else if (targetFormat === "mp4") { args.push("-c:v", "libx264", "-crf", String(QualityToCrf(jobVideoQuality)), "-preset", "medium", "-movflags", "+faststart"); args.push("-c:a", "aac", "-b:a", "128k"); }
          else if (targetFormat !== "gif") args.push("-c:v", "libx264", "-crf", String(QualityToCrf(jobVideoQuality)));
          if (targetFormat !== "gif") { const res = VIDEO_RESOLUTIONS.find(r => r.id === jobVideoResolution); if (res?.scale) args.push("-vf", `scale=${res.scale}:force_original_aspect_ratio=decrease`); }
        } else if (job.type === "audio") {
          const br = AUDIO_BITRATES.find(b => b.id === jobAudioBitrate)?.value || "192k";
          args.push("-b:a", br);
        } else if (job.type === "image") {
          /* ── Image filter chain: crop (aspect ratio) → resize (max dim) ── */
          const filters: string[] = [];
          const aspectRatioId = job.imageAspectRatio ?? "original";
          const arObj = IMAGE_ASPECT_RATIOS.find(r => r.id === aspectRatioId);
          if (arObj && arObj.ratio > 0) {
            const ar = arObj.ratio;
            // Center crop to target aspect ratio using FFmpeg expressions
            filters.push(`crop='min(iw\\,ih*${ar.toFixed(6)})':'min(ih\\,iw/${ar.toFixed(6)})'`);
          }
          const maxDimId = job.imageMaxDim ?? "original";
          const dimObj = IMAGE_MAX_DIM_PRESETS.find(d => d.id === maxDimId);
          if (dimObj && dimObj.maxDim > 0) {
            filters.push(`scale=${dimObj.maxDim}:${dimObj.maxDim}:force_original_aspect_ratio=decrease`);
          }
          if (filters.length > 0) args.push("-vf", filters.join(","));

          /* ── Quality settings per output format ── */
          if (targetFormat === "jpg" || targetFormat === "jpeg") {
            const q = Math.round(31 - (jobImageQuality / 100) * 30);
            args.push("-q:v", String(Math.max(1, q)));
          } else if (targetFormat === "webp") {
            args.push("-quality", String(jobImageQuality));
          } else if (targetFormat === "heic") {
            const crf = Math.round(51 - (jobImageQuality / 100) * 41);
            args.push("-crf", String(crf));
          }
          // PNG, BMP, TIFF, GIF, ICO are lossless — no quality flag needed
        }

        args.push(outputPath, "-y", "-progress", "pipe:1");
        command = Command.create("ffmpeg", args);
      }

      command.on("close", (data: { code: number | null; signal: number | null }) => {
        childProcesses.current.delete(jobId);
        if (data.code === 0) setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: "completed", progress: 100, outputPath } : j));
        else if (data.code === 127) setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: "error", error: "LibreOffice is required. Install from libreoffice.org" } : j));
        else setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: "error", error: `Conversion failed (Code ${data.code})` } : j));
      });

      command.stdout.on("data", (line: string) => {
        if (duration > 0 && (job.type === "video" || job.type === "audio")) {
          const m = line.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
          if (m) { const s = parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseInt(m[3]); setJobs(prev => prev.map(j => j.id === jobId ? { ...j, progress: Math.min(Math.round((s / duration) * 100), 99) } : j)); }
        }
      });

      const child = await command.spawn();
      childProcesses.current.set(jobId, child);
    } catch (err) {
      childProcesses.current.delete(jobId);
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: "error", error: String(err) } : j));
    }
  };

  const convertAll = async () => { setConverting(true); for (const job of jobs.filter(j => j.status === "pending" || j.status === "error")) { if (jobs.find(j => j.id === job.id)?.status === "cancelled") continue; await runConversion(job.id); } setConverting(false); };
  const convertSingle = async (jobId: string) => { setConverting(true); await runConversion(jobId); setConverting(false); };

  /* ── Preview helpers ─────────────────────────────────────────────────── */
  const previewUrl = selectedJob ? previewUrls[selectedJob.id] : null;

  const spreadsheetPreviewRows = useMemo((): string[][] | null => {
    if (!selectedJob || selectedJob.type !== "spreadsheet" || !previewUrl?.startsWith("data:text/plain;base64,")) return null;
    try {
      const text = decodeURIComponent(escape(atob(previewUrl.replace("data:text/plain;base64,", ""))));
      const delimiter = selectedJob.sourceExtension === "tsv" ? "\t" : ",";
      return text.split("\n").filter(l => l.trim()).slice(0, 15).map(line => {
        const parts: string[] = []; let current = ""; let inQuotes = false;
        for (const ch of line) { if (ch === '"') inQuotes = !inQuotes; else if (ch === delimiter && !inQuotes) { parts.push(current.trim()); current = ""; } else current += ch; }
        parts.push(current.trim()); return parts;
      });
    } catch { return null; }
  }, [selectedJob, previewUrl]);

  /* ── Estimated Output File Size ────────────────────────────────────────── */
  /** Computes an approximate output file size based on source metadata and
   *  the user's current quality/resolution/bitrate/dimension settings.
   *  Returns { bytes, label, ratio } or null when no estimate is possible. */
  const estimatedOutputSize = useMemo((): { bytes: number; label: string; ratio: number } | null => {
    if (!selectedJob || selectedJob.status !== "pending") return null;
    const meta = fileMetadata[selectedJob.id];
    if (!meta || meta.fileSize <= 0) return null;

    const srcBytes = meta.fileSize;
    let estimatedBytes = srcBytes;

    if (selectedJob.type === "video") {
      // Video: estimate from CRF quality + resolution scaling
      const quality = selectedJob.videoQuality ?? defaultVideoQuality;
      // CRF-based multiplier: 100% quality ≈ 1.0x, 10% quality ≈ 0.05x (roughly logarithmic)
      const qualityMultiplier = 0.05 + (quality / 100) * 0.95;
      // Resolution scaling: compare pixel count ratio
      let resolutionMultiplier = 1;
      const resId = selectedJob.videoResolution ?? defaultVideoResolution;
      const resObj = VIDEO_RESOLUTIONS.find(r => r.id === resId);
      if (resObj?.scale && meta.width && meta.height) {
        const [tw, th] = resObj.scale.split(":").map(Number);
        const srcPixels = meta.width * meta.height;
        const tgtPixels = tw * th;
        if (tgtPixels < srcPixels) resolutionMultiplier = tgtPixels / srcPixels;
      }
      // Format overhead factor (some containers are more efficient)
      const fmt = selectedJob.outputFormat;
      const formatMultiplier = fmt === "webm" ? 0.85 : fmt === "gif" ? 2.5 : fmt === "avi" ? 1.1 : 1.0;
      estimatedBytes = srcBytes * qualityMultiplier * resolutionMultiplier * formatMultiplier;
    } else if (selectedJob.type === "audio") {
      // Audio: estimate from target bitrate vs source bitrate
      const brId = selectedJob.audioBitrate ?? defaultAudioBitrate;
      const brObj = AUDIO_BITRATES.find(b => b.id === brId);
      const targetBps = brObj ? parseInt(brObj.id) * 1000 : 192000;
      if (meta.bitRate && meta.bitRate > 0) {
        estimatedBytes = srcBytes * (targetBps / meta.bitRate);
      } else if (meta.duration && meta.duration > 0) {
        // Calculate from duration × target bitrate
        estimatedBytes = (targetBps / 8) * meta.duration;
      }
    } else if (selectedJob.type === "image") {
      // Image: estimate from quality, dimensions, and format
      const quality = selectedJob.imageQuality ?? defaultImageQuality;
      let pixelRatio = 1;
      let srcW = meta.width || 1;
      let srcH = meta.height || 1;
      const srcPixels = srcW * srcH;

      // Apply aspect ratio crop effect on pixel count
      const arObj = IMAGE_ASPECT_RATIOS.find(r => r.id === (selectedJob.imageAspectRatio ?? "original"));
      if (arObj && arObj.ratio > 0) {
        const targetW = Math.min(srcW, Math.round(srcH * arObj.ratio));
        const targetH = Math.min(srcH, Math.round(srcW / arObj.ratio));
        srcW = targetW; srcH = targetH;
      }
      // Apply max dimension resize
      const dimObj = IMAGE_MAX_DIM_PRESETS.find(d => d.id === (selectedJob.imageMaxDim ?? "original"));
      if (dimObj && dimObj.maxDim > 0 && (srcW > dimObj.maxDim || srcH > dimObj.maxDim)) {
        const scale = dimObj.maxDim / Math.max(srcW, srcH);
        srcW = Math.round(srcW * scale); srcH = Math.round(srcH * scale);
      }
      const tgtPixels = srcW * srcH;
      if (srcPixels > 0) pixelRatio = tgtPixels / srcPixels;

      // Format-based multiplier (relative to source)
      const fmt = selectedJob.outputFormat;
      const isLossy = ImageFormatSupportsQuality(fmt);
      if (isLossy) {
        // Lossy: quality affects size roughly linearly
        const qualityFactor = 0.05 + (quality / 100) * 0.95;
        estimatedBytes = srcBytes * pixelRatio * qualityFactor;
      } else {
        // Lossless: PNG/BMP/TIFF size scales with pixel count
        const formatFactor = fmt === "bmp" ? 2.5 : fmt === "tiff" ? 1.8 : fmt === "png" ? 0.8 : 1.0;
        estimatedBytes = srcBytes * pixelRatio * formatFactor;
      }
    } else {
      // Document / Spreadsheet — no reliable estimation possible
      return null;
    }

    // Clamp to at least 1 KB
    estimatedBytes = Math.max(estimatedBytes, 1024);
    const ratio = estimatedBytes / srcBytes;

    return { bytes: estimatedBytes, label: FormatFileSize(estimatedBytes), ratio };
  }, [selectedJob, fileMetadata, defaultVideoQuality, defaultVideoResolution, defaultAudioBitrate, defaultImageQuality]);

  /** Whether the selected job is converting to the same format (quality/size adjust only) */
  const isSameFormatConversion = selectedJob ? selectedJob.outputFormat === selectedJob.sourceExtension : false;

  /* ════════════════════════════════════════════════════════════════════════ */
  /*  RENDER                                                                 */
  /* ════════════════════════════════════════════════════════════════════════ */

  const fileTypeButtons: { type: FileCategory; icon: React.FC<{ className?: string }>; label: string }[] = [
    { type: "video", icon: Film, label: "Video" },
    { type: "audio", icon: Music, label: "Audio" },
    { type: "image", icon: ImageIcon, label: "Image" },
    { type: "document", icon: FileText, label: "Doc" },
    { type: "spreadsheet", icon: FileSpreadsheet, label: "Sheet" },
  ];

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full flex-col bg-background" onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}>

        {/* ── Drag Overlay ───────────────────────────────────────────── */}
        {isDragging && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-primary/10 backdrop-blur-sm border-4 border-dashed border-primary rounded-xl m-2 pointer-events-none">
            <div className="text-center">
              <Upload className="h-16 w-16 mx-auto text-primary mb-4 animate-bounce" />
              <p className="text-xl font-bold text-primary">Drop files here to convert</p>
              <p className="text-sm text-muted-foreground mt-1">Video, Audio, Image, Document, or Spreadsheet</p>
            </div>
          </div>
        )}

        {/* ── Header Bar ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 py-3 border-b bg-card/50">
          <div className="flex items-center gap-1.5">
            <Tooltip><TooltipTrigger asChild><Button variant="outline" size="sm" onClick={() => handleSelectFiles()} className="gap-1.5"><Plus className="h-3.5 w-3.5" />Add Files</Button></TooltipTrigger><TooltipContent>Add any supported file</TooltipContent></Tooltip>
            <div className="hidden sm:flex items-center gap-1 ml-1">
              {fileTypeButtons.map(({ type, icon: TypeIcon, label }) => (
                <Tooltip key={type}><TooltipTrigger asChild>
                  <button onClick={() => handleSelectFiles(type)} className={cn("flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors", TYPE_COLORS[type].bg, TYPE_COLORS[type].text, "hover:opacity-80")}>
                    <TypeIcon className="h-3 w-3" /><span className="hidden md:inline">{label}</span>
                  </button>
                </TooltipTrigger><TooltipContent>Add {label} files</TooltipContent></Tooltip>
              ))}
            </div>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-1.5">
            <Tooltip><TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={handleSelectDestination} className="gap-1.5 text-xs text-muted-foreground">
                <FolderOpen className="h-3.5 w-3.5" /><span className="max-w-[120px] truncate hidden sm:inline">{destinationPath ? destinationPath.split(/[/\\]/).pop() : "Source folder"}</span>
              </Button>
            </TooltipTrigger><TooltipContent>{destinationPath || "Output to same folder as source"}</TooltipContent></Tooltip>
            {jobs.length > 0 && (<Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={clearAll} className="h-8 w-8 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Clear all files</TooltipContent></Tooltip>)}
          </div>
        </div>

        {/* ── Main Content ───────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── Left: File Queue ──────────────────────────────────────── */}
          <div className="w-[340px] min-w-[280px] border-r flex flex-col bg-card/30">
            {jobs.length > 0 && (
              <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{jobs.length} file{jobs.length !== 1 ? "s" : ""}{convertingCount > 0 && <span className="text-primary ml-1">({convertingCount} converting)</span>}</span>
                {completedCount > 0 && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-0">{completedCount} done</Badge>}
              </div>
            )}
            <div className="flex-1 overflow-y-auto">
              {jobs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center">
                  <div className="p-4 rounded-2xl bg-muted/50 mb-4"><Sparkles className="h-10 w-10 text-muted-foreground/40" /></div>
                  <h3 className="font-semibold text-sm mb-1">No files added</h3>
                  <p className="text-xs text-muted-foreground mb-5 max-w-[220px]">Drag & drop files here, or choose a file type to get started</p>
                  <div className="grid grid-cols-3 gap-2 w-full max-w-[260px]">
                    {([{ type: "video" as FileCategory, icon: Film, label: "Video" }, { type: "audio" as FileCategory, icon: Music, label: "Audio" }, { type: "image" as FileCategory, icon: ImageIcon, label: "Image" }, { type: "document" as FileCategory, icon: FileText, label: "Document" }, { type: "spreadsheet" as FileCategory, icon: FileSpreadsheet, label: "Spreadsheet" }]).map(({ type, icon: TypeIcon, label }) => (
                      <button key={type} onClick={() => handleSelectFiles(type)} className={cn("flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all hover:shadow-sm", TYPE_COLORS[type].bg, TYPE_COLORS[type].border, "hover:scale-[1.02] active:scale-[0.98]")}>
                        <TypeIcon className={cn("h-5 w-5", TYPE_COLORS[type].text)} /><span className={cn("text-[11px] font-medium leading-tight", TYPE_COLORS[type].text)}>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-1.5 space-y-0.5">
                  {jobs.map(job => {
                    const isSelected = selectedJobId === job.id;
                    const colors = TYPE_COLORS[job.type];
                    const meta = fileMetadata[job.id];
                    return (
                      <div key={job.id} onClick={() => setSelectedJobId(job.id)} className={cn("group relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-all", isSelected ? "bg-accent shadow-sm" : "hover:bg-accent/50")}>
                        <div className={cn("h-8 w-8 rounded-md flex items-center justify-center shrink-0", colors.badgeBg)}><FileTypeIcon type={job.type} className={cn("h-4 w-4", colors.text)} /></div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-medium leading-tight">{job.name}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[10px] font-mono uppercase text-muted-foreground">{job.sourceExtension}</span>
                            <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/50" />
                            <span className={cn("text-[10px] font-mono uppercase font-semibold", colors.text)}>{job.outputFormat}</span>
                            {meta?.fileSize ? <span className="text-[10px] text-muted-foreground/60 ml-1">{FormatFileSize(meta.fileSize)}</span> : null}
                            {job.status === "completed" && <CheckCircle className="h-3 w-3 text-emerald-500 ml-1" />}
                            {job.status === "error" && <AlertCircle className="h-3 w-3 text-destructive ml-1" />}
                            {job.status === "cancelled" && <Ban className="h-3 w-3 text-muted-foreground ml-1" />}
                          </div>
                          {job.status === "converting" && <div className="mt-1.5"><Progress value={job.progress} className="h-1" /></div>}
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          {job.status === "converting" && <span className="text-[10px] font-bold text-primary mr-1">{job.progress}%</span>}
                          {(job.status === "pending" || job.status === "converting") && (
                            <Tooltip><TooltipTrigger asChild><button onClick={e => cancelJob(job.id, e)} aria-label="Remove file" className="p-1 rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"><X className="h-3.5 w-3.5" /></button></TooltipTrigger><TooltipContent side="left">Remove</TooltipContent></Tooltip>
                          )}
                          {(job.status === "completed" || job.status === "error" || job.status === "cancelled") && (
                            <Tooltip><TooltipTrigger asChild><button onClick={e => removeJob(job.id, e)} aria-label="Remove file" className="p-1 rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"><X className="h-3.5 w-3.5" /></button></TooltipTrigger><TooltipContent side="left">Remove</TooltipContent></Tooltip>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {jobs.length > 0 && (
              <div className="p-2 border-t">
                <button onClick={() => handleSelectFiles()} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-md border border-dashed text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"><Plus className="h-3.5 w-3.5" />Add more files</button>
              </div>
            )}
          </div>

          {/* ── Right: Detail & Settings ──────────────────────────────── */}
          <div className="flex-1 flex flex-col overflow-hidden bg-muted/20">
            {selectedJob ? (
              <>
                {/* ── Preview Area with Metadata Overlay ────────────── */}
                <div className="flex-1 flex items-center justify-center p-6 overflow-hidden">
                  <div className="relative rounded-xl overflow-hidden shadow-lg border bg-card max-h-full w-full max-w-2xl flex flex-col items-center justify-center min-h-[200px]">

                    {/* Main preview content */}
                    <div className="flex-1 w-full flex items-center justify-center min-h-[180px] relative">
                      {loadingPreview && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-20">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" /><span className="ml-2 text-sm font-medium">Loading...</span>
                        </div>
                      )}

                      {/* Video — uses blob URL for reliable playback */}
                      {selectedJob.type === "video" && (
                        previewUrl
                          ? <video controls src={previewUrl} className="h-full w-full object-contain max-h-[360px]" />
                          : <div className="p-8 flex flex-col items-center gap-3"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /><p className="text-xs text-muted-foreground">Loading video...</p></div>
                      )}

                      {/* Audio — uses blob URL for reliable playback */}
                      {selectedJob.type === "audio" && (
                        <div className="flex flex-col items-center gap-4 p-8 w-full">
                          <div className={cn("p-5 rounded-2xl", TYPE_COLORS.audio.bg)}>
                            <Music className={cn("h-10 w-10", TYPE_COLORS.audio.text)} />
                          </div>
                          {previewUrl
                            ? <audio controls src={previewUrl} className="w-full max-w-md" />
                            : <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /><p className="text-xs text-muted-foreground">Loading audio...</p></div>
                          }
                        </div>
                      )}

                      {/* Image */}
                      {selectedJob.type === "image" && (
                        <div className="w-full h-full flex items-center justify-center min-h-[180px] max-h-[360px] bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGAQYcAP3uCTZhw1gGGYhAGBZIA/nYDCgBDAm9BGDWAAjyQc6GkKDgQA6e0q6JRlyBwAAAAASUVORK5CYII=')] bg-repeat">
                          {previewUrl ? <img src={previewUrl} className="max-h-[360px] max-w-full object-contain" alt={selectedJob.name} /> : <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />}
                        </div>
                      )}

                      {/* Document */}
                      {selectedJob.type === "document" && (
                        previewUrl
                          ? <iframe src={previewUrl} className="w-full h-[320px] border-none bg-white" title="Document preview" />
                          : <div className="p-8 flex flex-col items-center gap-3"><div className={cn("p-5 rounded-2xl", TYPE_COLORS.document.bg)}><FileText className={cn("h-12 w-12", TYPE_COLORS.document.text)} /></div><p className="text-xs text-muted-foreground">{loadingPreview ? "Generating..." : "Preview not available"}</p></div>
                      )}

                      {/* Spreadsheet */}
                      {selectedJob.type === "spreadsheet" && (
                        spreadsheetPreviewRows && spreadsheetPreviewRows.length > 0 ? (
                          <div className="w-full h-full overflow-auto p-3 max-h-[320px]">
                            <table className="w-full text-xs border-collapse">
                              <thead><tr>{spreadsheetPreviewRows[0].map((cell, i) => <th key={i} className="px-2.5 py-1.5 text-left font-semibold border-b-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 whitespace-nowrap">{cell || <span className="text-muted-foreground italic">empty</span>}</th>)}</tr></thead>
                              <tbody>{spreadsheetPreviewRows.slice(1).map((row, ri) => <tr key={ri} className="hover:bg-muted/50">{row.map((cell, ci) => <td key={ci} className="px-2.5 py-1 border-b border-border/50 whitespace-nowrap max-w-[200px] truncate">{cell || <span className="text-muted-foreground">—</span>}</td>)}</tr>)}</tbody>
                            </table>
                            {spreadsheetPreviewRows.length >= 15 && <p className="text-[10px] text-muted-foreground text-center mt-2 italic">Showing first 15 rows...</p>}
                          </div>
                        ) : (
                          <div className="p-8 flex flex-col items-center gap-3"><div className={cn("p-5 rounded-2xl", TYPE_COLORS.spreadsheet.bg)}><Table2 className={cn("h-12 w-12", TYPE_COLORS.spreadsheet.text)} /></div><p className="text-xs text-muted-foreground">{["xlsx", "xls"].includes(selectedJob.sourceExtension) ? "Excel preview — convert to CSV to inspect" : loadingPreview ? "Loading..." : "Preview not available"}</p></div>
                        )
                      )}

                      {/* Completed badge */}
                      {selectedJob.status === "completed" && (
                        <div className="absolute top-3 right-3 bg-emerald-500 text-white px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 z-10 shadow-lg"><CheckCircle className="h-3.5 w-3.5" /> Converted</div>
                      )}
                    </div>

                    {/* ── Metadata Info Strip ──────────────────────────── */}
                    {selectedMeta && (
                      <div className="w-full px-3 py-2 border-t bg-muted/40 flex items-center gap-2 flex-wrap">
                        {/* Dimensions (image/video) */}
                        {selectedMeta.width && selectedMeta.height && (
                          <MetaPill icon={<Maximize2 className="h-2.5 w-2.5" />} label={`${selectedMeta.width} × ${selectedMeta.height}`} />
                        )}
                        {/* Aspect ratio (image/video) */}
                        {selectedMeta.width && selectedMeta.height && (
                          <MetaPill icon={<Ratio className="h-2.5 w-2.5" />} label={ComputeAspectRatioLabel(selectedMeta.width, selectedMeta.height)} />
                        )}
                        {/* Duration (video/audio) */}
                        {selectedMeta.duration && selectedMeta.duration > 0 && (
                          <MetaPill icon={<Clock className="h-2.5 w-2.5" />} label={FormatDuration(selectedMeta.duration)} />
                        )}
                        {/* Codec */}
                        {selectedMeta.codec && (
                          <MetaPill icon={<Info className="h-2.5 w-2.5" />} label={selectedMeta.codec.toUpperCase()} />
                        )}
                        {/* Audio channels + sample rate */}
                        {selectedMeta.channels && (
                          <MetaPill icon={<Volume2 className="h-2.5 w-2.5" />} label={`${selectedMeta.channels === 1 ? "Mono" : selectedMeta.channels === 2 ? "Stereo" : `${selectedMeta.channels}ch`}${selectedMeta.sampleRate ? ` · ${Math.round(selectedMeta.sampleRate / 1000)}kHz` : ""}`} />
                        )}
                        {/* Bitrate */}
                        {selectedMeta.bitRate && selectedMeta.bitRate > 0 && (
                          <MetaPill icon={<HardDrive className="h-2.5 w-2.5" />} label={selectedMeta.bitRate > 1_000_000 ? `${(selectedMeta.bitRate / 1_000_000).toFixed(1)} Mbps` : `${Math.round(selectedMeta.bitRate / 1000)} kbps`} />
                        )}
                        {/* File size */}
                        {selectedMeta.fileSize > 0 && (
                          <MetaPill icon={<HardDrive className="h-2.5 w-2.5" />} label={FormatFileSize(selectedMeta.fileSize)} />
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Conversion Settings Panel ──────────────────────── */}
                <div className="border-t bg-card p-4 overflow-y-auto max-h-[340px]">
                  <div className="max-w-2xl mx-auto space-y-4">
                    {/* File name + format selector */}
                    <div className="flex items-center gap-3">
                      <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", TYPE_COLORS[selectedJob.type].badgeBg)}>
                        <FileTypeIcon type={selectedJob.type} className={cn("h-4.5 w-4.5", TYPE_COLORS[selectedJob.type].text)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{selectedJob.name}</p>
                        <p className="text-[11px] text-muted-foreground">Source: <span className="font-mono uppercase">{selectedJob.sourceExtension}</span>{selectedMeta?.fileSize ? ` · ${FormatFileSize(selectedMeta.fileSize)}` : ""}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="font-mono uppercase text-[11px] px-2">{selectedJob.sourceExtension}</Badge>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <Select value={selectedJob.outputFormat} onValueChange={v => updateJobFormat(selectedJob.id, v)} disabled={selectedJob.status === "converting"}>
                          <SelectTrigger size="sm" className="w-[100px] font-mono uppercase text-xs font-semibold"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {/* Same format option — re-encode to adjust quality/size */}
                            {["video", "audio", "image"].includes(selectedJob.type) && (
                              <>
                                <SelectGroup>
                                  <SelectLabel>Same Format</SelectLabel>
                                  <SelectItem value={selectedJob.sourceExtension} className="font-mono uppercase text-xs">
                                    {selectedJob.sourceExtension}<span className="normal-case text-muted-foreground ml-1">— Adjust quality</span>
                                  </SelectItem>
                                </SelectGroup>
                                <SelectSeparator />
                              </>
                            )}
                            <SelectGroup><SelectLabel>Recommended</SelectLabel>{RECOMMENDED_FORMATS[selectedJob.type].filter(f => f !== selectedJob.sourceExtension).map(f => <SelectItem key={f} value={f} className="font-mono uppercase text-xs">{f}</SelectItem>)}</SelectGroup>
                            <SelectSeparator />
                            <SelectGroup><SelectLabel>All Formats</SelectLabel>{GetFormatsForType(selectedJob.type).filter(f => f !== selectedJob.sourceExtension && !RECOMMENDED_FORMATS[selectedJob.type].includes(f)).map(f => <SelectItem key={f} value={f} className="font-mono uppercase text-xs">{f}</SelectItem>)}</SelectGroup>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* ── Output Filename Editor ──────────────────────── */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Edit3 className="h-3.5 w-3.5 text-muted-foreground" />
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Output Filename</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="text"
                          placeholder={`${selectedJob.name.substring(0, selectedJob.name.lastIndexOf("."))}_converted`}
                          value={selectedJob.customOutputName ?? ""}
                          onChange={(e) => updateJobSetting(selectedJob.id, "customOutputName", e.target.value)}
                          disabled={selectedJob.status === "converting"}
                          className="flex-1 font-mono text-xs"
                        />
                        <span className="text-xs font-mono text-muted-foreground uppercase shrink-0">.{selectedJob.outputFormat}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground pl-0.5">Leave empty to use default naming ({selectedJob.name.substring(0, selectedJob.name.lastIndexOf("."))}_converted)</p>
                    </div>

                    {/* ── Same-Format Info Banner ──────────────────────── */}
                    {isSameFormatConversion && selectedJob.status === "pending" && ["video", "audio", "image"].includes(selectedJob.type) && (
                      <div className="flex items-start gap-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-3 py-2.5">
                        <Equal className="h-4 w-4 text-blue-500 dark:text-blue-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-blue-700 dark:text-blue-300">Same-format re-encode</p>
                          <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5">
                            {selectedJob.type === "video" && "The video will be re-encoded with the quality and resolution settings below. Useful for reducing file size."}
                            {selectedJob.type === "audio" && "The audio will be re-encoded at the selected bitrate. Lower bitrate = smaller file."}
                            {selectedJob.type === "image" && "The image will be re-processed with the quality, aspect ratio, and size settings below."}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* ── Estimated Output File Size ──────────────────── */}
                    {estimatedOutputSize && selectedJob.status === "pending" && (
                      <div className="flex items-center gap-3 rounded-lg bg-muted/60 border px-3 py-2.5">
                        <TrendingDown className={cn("h-4 w-4 shrink-0", estimatedOutputSize.ratio < 1 ? "text-emerald-500" : estimatedOutputSize.ratio > 1.1 ? "text-amber-500" : "text-muted-foreground")} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium">Estimated output</span>
                            <span className={cn("text-sm font-bold", estimatedOutputSize.ratio < 1 ? "text-emerald-600 dark:text-emerald-400" : estimatedOutputSize.ratio > 1.1 ? "text-amber-600 dark:text-amber-400" : "text-foreground")}>{estimatedOutputSize.label}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-muted-foreground">
                              Source: {selectedMeta ? FormatFileSize(selectedMeta.fileSize) : "—"}
                            </span>
                            <span className="text-[10px] text-muted-foreground">·</span>
                            <span className={cn("text-[10px] font-semibold", estimatedOutputSize.ratio < 1 ? "text-emerald-600 dark:text-emerald-400" : estimatedOutputSize.ratio > 1.1 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
                              {estimatedOutputSize.ratio < 1
                                ? `~${Math.round((1 - estimatedOutputSize.ratio) * 100)}% smaller`
                                : estimatedOutputSize.ratio > 1.1
                                  ? `~${Math.round((estimatedOutputSize.ratio - 1) * 100)}% larger`
                                  : "~same size"}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── Type-Specific Settings ──────────────────────── */}
                    {selectedJob.status === "pending" && (
                      <div className="space-y-3 pt-1">

                        {/* ── Video Settings ────────────────────────── */}
                        {selectedJob.type === "video" && selectedJob.outputFormat !== "gif" && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between"><label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><MonitorPlay className="h-3.5 w-3.5" /> Quality</label><span className="text-xs font-semibold">{selectedJob.videoQuality ?? defaultVideoQuality}% — {GetQualityLabel(selectedJob.videoQuality ?? defaultVideoQuality)}</span></div>
                              <Slider min={10} max={100} value={[selectedJob.videoQuality ?? defaultVideoQuality]} onValueChange={([v]) => updateJobSetting(selectedJob.id, "videoQuality", v)} />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><MonitorPlay className="h-3.5 w-3.5" /> Resolution</label>
                              <Select value={selectedJob.videoResolution ?? defaultVideoResolution} onValueChange={v => updateJobSetting(selectedJob.id, "videoResolution", v)}>
                                <SelectTrigger size="sm" className="w-full text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>{VIDEO_RESOLUTIONS.map(r => <SelectItem key={r.id} value={r.id} className="text-xs">{r.label}<span className="text-muted-foreground ml-1">— {r.description}</span></SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                          </div>
                        )}

                        {/* ── Audio Settings ────────────────────────── */}
                        {selectedJob.type === "audio" && (
                          <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><Volume2 className="h-3.5 w-3.5" /> Bitrate</label>
                            <Select value={selectedJob.audioBitrate ?? defaultAudioBitrate} onValueChange={v => updateJobSetting(selectedJob.id, "audioBitrate", v)}>
                              <SelectTrigger size="sm" className="w-full text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>{AUDIO_BITRATES.map(b => <SelectItem key={b.id} value={b.id} className="text-xs">{b.label}<span className="text-muted-foreground ml-1">— {b.description}</span></SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                        )}

                        {/* ── Image Settings (expanded) ─────────────── */}
                        {selectedJob.type === "image" && (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {/* Aspect Ratio */}
                              <div className="space-y-2">
                                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><Ratio className="h-3.5 w-3.5" /> Aspect Ratio</label>
                                <Select value={selectedJob.imageAspectRatio ?? "original"} onValueChange={v => updateJobSetting(selectedJob.id, "imageAspectRatio", v)}>
                                  <SelectTrigger size="sm" className="w-full text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>{IMAGE_ASPECT_RATIOS.map(r => <SelectItem key={r.id} value={r.id} className="text-xs">{r.label}<span className="text-muted-foreground ml-1">— {r.description}</span></SelectItem>)}</SelectContent>
                                </Select>
                              </div>
                              {/* Max Dimension (resize) */}
                              <div className="space-y-2">
                                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><Maximize2 className="h-3.5 w-3.5" /> Max Size</label>
                                <Select value={selectedJob.imageMaxDim ?? "original"} onValueChange={v => updateJobSetting(selectedJob.id, "imageMaxDim", v)}>
                                  <SelectTrigger size="sm" className="w-full text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>{IMAGE_MAX_DIM_PRESETS.map(d => <SelectItem key={d.id} value={d.id} className="text-xs">{d.label}<span className="text-muted-foreground ml-1">— {d.description}</span></SelectItem>)}</SelectContent>
                                </Select>
                              </div>
                            </div>

                            {/* Quality / Compression slider — shown for lossy formats */}
                            {ImageFormatSupportsQuality(selectedJob.outputFormat) && (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><Palette className="h-3.5 w-3.5" /> Compression Quality</label>
                                  <span className="text-xs font-semibold">{selectedJob.imageQuality ?? defaultImageQuality}% — {GetQualityLabel(selectedJob.imageQuality ?? defaultImageQuality)}</span>
                                </div>
                                <Slider min={10} max={100} value={[selectedJob.imageQuality ?? defaultImageQuality]} onValueChange={([v]) => updateJobSetting(selectedJob.id, "imageQuality", v)} />
                                <p className="text-[10px] text-muted-foreground">Lower quality = smaller file size, more compression artifacts</p>
                              </div>
                            )}

                            {/* Note for lossless formats */}
                            {!ImageFormatSupportsQuality(selectedJob.outputFormat) && (
                              <p className="text-[11px] text-muted-foreground italic bg-muted/50 rounded-md px-2.5 py-1.5">
                                <span className="font-mono uppercase">{selectedJob.outputFormat}</span> is a lossless format — no quality/compression slider needed. Output preserves full image data.
                              </p>
                            )}

                            {/* Live dimensions estimate */}
                            {selectedMeta?.width && selectedMeta?.height && (
                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                <span>Source: {selectedMeta.width} × {selectedMeta.height}</span>
                                {(selectedJob.imageAspectRatio !== "original" || selectedJob.imageMaxDim !== "original") && (
                                  <>
                                    <ArrowRight className="h-3 w-3" />
                                    <span className="font-medium text-foreground">
                                      {(() => {
                                        let w = selectedMeta.width;
                                        let h = selectedMeta.height;
                                        // Apply aspect ratio crop
                                        const arObj = IMAGE_ASPECT_RATIOS.find(r => r.id === (selectedJob.imageAspectRatio ?? "original"));
                                        if (arObj && arObj.ratio > 0) {
                                          const targetW = Math.min(w, Math.round(h * arObj.ratio));
                                          const targetH = Math.min(h, Math.round(w / arObj.ratio));
                                          w = targetW; h = targetH;
                                        }
                                        // Apply max dimension
                                        const dimObj = IMAGE_MAX_DIM_PRESETS.find(d => d.id === (selectedJob.imageMaxDim ?? "original"));
                                        if (dimObj && dimObj.maxDim > 0 && (w > dimObj.maxDim || h > dimObj.maxDim)) {
                                          const scale = dimObj.maxDim / Math.max(w, h);
                                          w = Math.round(w * scale); h = Math.round(h * scale);
                                        }
                                        return `~${w} × ${h}`;
                                      })()}
                                    </span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* ── Spreadsheet Settings ──────────────────── */}
                        {selectedJob.type === "spreadsheet" && (
                          <div className="space-y-3">
                            {(selectedJob.outputFormat === "csv" || selectedJob.outputFormat === "tsv") && (
                              <div className="space-y-2">
                                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><Table2 className="h-3.5 w-3.5" /> Delimiter</label>
                                <Select value={selectedJob.csvDelimiter ?? "comma"} onValueChange={v => updateJobSetting(selectedJob.id, "csvDelimiter", v)}>
                                  <SelectTrigger size="sm" className="w-full text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>{CSV_DELIMITERS.map(d => <SelectItem key={d.id} value={d.id} className="text-xs">{d.label}<span className="text-muted-foreground ml-1">— {d.description}</span></SelectItem>)}</SelectContent>
                                </Select>
                              </div>
                            )}
                            {["csv", "tsv"].includes(selectedJob.sourceExtension) && ["csv", "tsv"].includes(selectedJob.outputFormat) && (
                              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={selectedJob.includeHeaders ?? true} onChange={e => updateJobSetting(selectedJob.id, "includeHeaders", e.target.checked)} className="rounded border-border" /><span className="text-xs font-medium text-muted-foreground">Include header row</span></label>
                            )}
                            {!CanUsePythonFastPath(selectedJob.sourceExtension, selectedJob.outputFormat) && <p className="text-[11px] text-muted-foreground bg-muted/50 rounded-md px-2.5 py-1.5"><span className="font-medium">Requires LibreOffice</span> — <a href="https://www.libreoffice.org/download/" target="_blank" rel="noopener noreferrer" className="underline text-primary">Download</a></p>}
                            {CanUsePythonFastPath(selectedJob.sourceExtension, selectedJob.outputFormat) && <p className="text-[11px] text-muted-foreground italic">Lightweight Python3 conversion — no extra software needed.</p>}
                          </div>
                        )}

                        {/* ── Document: no extra settings ───────────── */}
                        {selectedJob.type === "document" && (
                          <p className="text-xs text-muted-foreground italic">No additional settings for document conversion.</p>
                        )}
                      </div>
                    )}

                    {/* Error */}
                    {selectedJob.error && (
                      <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3"><AlertCircle className="h-4 w-4 shrink-0" /><span>{selectedJob.error}</span></div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1">
                      {(selectedJob.status === "pending" || selectedJob.status === "error") && (
                        <Button size="sm" onClick={() => convertSingle(selectedJob.id)} disabled={converting} className="gap-1.5">{converting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}Convert This File</Button>
                      )}
                      {selectedJob.status === "converting" && <Button variant="destructive" size="sm" onClick={() => cancelJob(selectedJob.id)} className="gap-1.5"><CircleStop className="h-3.5 w-3.5" />Cancel</Button>}
                      {selectedJob.status === "completed" && selectedJob.outputPath && <Button variant="outline" size="sm" onClick={() => openOutputFolder(selectedJob.outputPath)} className="gap-1.5"><SquareArrowOutUpRight className="h-3.5 w-3.5" />Show in Folder</Button>}
                      {(selectedJob.status === "error" || selectedJob.status === "cancelled") && <Button variant="outline" size="sm" onClick={() => setJobs(prev => prev.map(j => j.id === selectedJob.id ? { ...j, status: "pending", progress: 0, error: undefined } : j))} className="gap-1.5"><RefreshCw className="h-3.5 w-3.5" />Retry</Button>}
                      <Button variant="ghost" size="sm" onClick={() => removeJob(selectedJob.id)} className="text-muted-foreground hover:text-destructive gap-1.5 ml-auto"><Trash2 className="h-3.5 w-3.5" />Remove</Button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <div className="p-4 rounded-2xl bg-muted/50 inline-block mb-3"><FileType2 className="h-8 w-8 text-muted-foreground/40" /></div>
                  <p className="text-sm font-medium">Select a file to configure</p>
                  <p className="text-xs mt-1">Choose a file from the list to set conversion options</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Bottom Bar ─────────────────────────────────────────────── */}
        {jobs.length > 0 && (
          <div className="px-4 py-3 border-t bg-card flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {pendingCount > 0 && <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" />{pendingCount} pending</span>}
              {convertingCount > 0 && <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin text-primary" />{convertingCount} converting</span>}
              {completedCount > 0 && <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />{completedCount} completed</span>}
            </div>
            <Button onClick={convertAll} disabled={converting || pendingCount === 0} className="gap-2 shadow-sm">
              {converting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {converting ? "Converting..." : `Convert All (${pendingCount})`}
            </Button>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};
