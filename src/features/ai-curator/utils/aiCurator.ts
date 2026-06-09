import { openRouterService, type OpenRouterMessage } from '../../ai-assistant/utils/openRouterService';
import { computeSimpleHash, deriveBasicQualityFlags, deriveAiEligibility } from './qualityAnalyzer';
import { determineSuggestedFolder, deriveReasonTags, generateExplanation, getDefaultFolder, computeAutoScores } from './folderSuggestions';
import { addAuditLog } from './auditLogger';
import { addNotification } from './notificationUtil';
import { SERVICE_PROMPTS, DEFAULT_CURATOR_SETTINGS, CURATION_STAGE_LABELS } from '../types';
import type {
  CurationRun, CuratedFile, CuratorSettings, CurationMode, ServiceType,
  MediaScore, FolderPlan, SimilarGroup, CostEstimate, CurationStage, AiEligibility,
} from '../types';

let abortController: AbortController | null = null;

export function cancelCuration(): void {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
}

function getDefaultSettings(): CuratorSettings {
  try {
    const saved = localStorage.getItem('ai-curator-settings');
    if (saved) return { ...DEFAULT_CURATOR_SETTINGS, ...JSON.parse(saved) };
  } catch {}
  return { ...DEFAULT_CURATOR_SETTINGS };
}

export function loadSettings(): CuratorSettings {
  return getDefaultSettings();
}

export function saveSettings(settings: CuratorSettings): void {
  localStorage.setItem('ai-curator-settings', JSON.stringify(settings));
}

export function estimateCost(
  files: FileEntry[],
  mode: CurationMode,
  settings: CuratorSettings
): CostEstimate {
  const totalFiles = files.length;
  let autoSortableCount = 0;
  let eligibleForAiCount = 0;

  for (const file of files) {
    const flags = deriveBasicQualityFlags(0, 0, file.size, file.mimeType, undefined, undefined, file.name);
    const eligibility = deriveAiEligibility(flags, mode, 0, 0);
    if (eligibility !== 'eligible' || mode === 'fast_sort') {
      autoSortableCount++;
    } else {
      eligibleForAiCount++;
    }
  }

  let projectedAiReviewCount = 0;
  if (mode === 'fast_sort') {
    projectedAiReviewCount = 0;
  } else if (mode === 'smart_sort') {
    projectedAiReviewCount = Math.min(eligibleForAiCount, Math.ceil(eligibleForAiCount * 0.4));
  } else {
    projectedAiReviewCount = eligibleForAiCount;
  }

  const costPerCallCents = mode === 'deep_ai_review' ? 2 : 1;
  const estimatedCostCents = projectedAiReviewCount * costPerCallCents;

  return {
    totalFiles,
    estimatedAiCalls: projectedAiReviewCount,
    estimatedCostCents,
    autoSortableCount,
    eligibleForAiCount,
    projectedAiReviewCount,
    currency: 'USD',
  };
}

function estimateAiCallCostCents(mode: CurationMode): number {
  if (mode === 'deep_ai_review') return 2;
  if (mode === 'smart_sort') return 1;
  return 0;
}

export interface CurationProgress {
  processed: number;
  total: number;
  currentFile?: string;
  currentFilePath?: string;
  stage: string;
  percent: number;
}

interface AiCurationResult {
  scores: MediaScore;
  explanation: string;
  reasonTags: string[];
  suggestedFolder: string;
}

interface FileEntry {
  name: string;
  path: string;
  size: number;
  mimeType: string;
  width: number;
  height: number;
}

function parseImageDimensions(buffer: Uint8Array): { width: number; height: number } | null {
  // Check PNG
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    const width = (buffer[16] << 24) | (buffer[17] << 16) | (buffer[18] << 8) | buffer[19];
    const height = (buffer[20] << 24) | (buffer[21] << 16) | (buffer[22] << 8) | buffer[23];
    return { width, height };
  }

  // Check GIF
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    const width = buffer[6] | (buffer[7] << 8);
    const height = buffer[8] | (buffer[9] << 8);
    return { width, height };
  }

  // Check JPEG
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length - 4) {
      // Find the start of a marker (starts with 0xFF, possibly padded with more 0xFFs)
      if (buffer[offset] !== 0xff) {
        offset++;
        continue;
      }
      // Skip all 0xFF bytes to find the marker byte
      while (offset < buffer.length && buffer[offset] === 0xff) {
        offset++;
      }
      if (offset >= buffer.length) break;
      const marker = buffer[offset];
      offset++; // move past marker byte

      // EOI (0xd9) or SOS (0xda) - stop scanning as SOF is always before SOS
      if (marker === 0xd9 || marker === 0xda) {
        break;
      }

      // Skip markers with no payload
      const hasNoPayload = (marker >= 0xd0 && marker <= 0xd7) || marker === 0xd8 || marker === 0xd9 || marker === 0x01;
      if (hasNoPayload) {
        continue;
      }

      // Read length of payload
      if (offset + 2 > buffer.length) break;
      const length = (buffer[offset] << 8) | buffer[offset + 1];

      // SOF markers: 0xc0-0xc3, 0xc5-0xc7, 0xc9-0xcb, 0xcd-0xcf (excluding DHT 0xc4, JPG 0xc8, DAC 0xcc)
      const isSOF = (marker >= 0xc0 && marker <= 0xcf) && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;

      if (isSOF) {
        if (offset + 7 > buffer.length) break;
        const height = (buffer[offset + 3] << 8) | buffer[offset + 4];
        const width = (buffer[offset + 5] << 8) | buffer[offset + 6];
        return { width, height };
      }

      // Skip payload
      offset += length;
    }
  }

  // Check WebP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    const chunkHeader = String.fromCharCode(buffer[12], buffer[13], buffer[14], buffer[15]);
    if (chunkHeader === 'VP8 ') {
      const width = buffer[26] | (buffer[27] << 8);
      const height = buffer[28] | (buffer[29] << 8);
      return { width, height };
    } else if (chunkHeader === 'VP8X') {
      const width = (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16)) + 1;
      const height = (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16)) + 1;
      return { width, height };
    }
  }

  return null;
}

async function readImageDimensions(filePath: string): Promise<{ width: number; height: number } | null> {
  try {
    const { open } = await import('@tauri-apps/plugin-fs');
    const file = await open(filePath, { read: true });
    const buffer = new Uint8Array(262144);
    const bytesRead = await file.read(buffer);
    await file.close();

    if (!bytesRead || bytesRead < 8) return null;
    return parseImageDimensions(buffer);
  } catch {
    return null;
  }
}

async function scanDirectory(dirPath: string): Promise<FileEntry[]> {
  try {
    const { readDir, stat } = await import('@tauri-apps/plugin-fs');
    const entries = await readDir(dirPath);
    const files: FileEntry[] = [];

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = `${dirPath}/${entry.name}`;
      try {
        const fileStat = await stat(fullPath);
        if (fileStat.isFile) {
          const ext = entry.name.split('.').pop()?.toLowerCase() || '';
          const mimeType = getMimeFromExtension(ext);
          let width = 0;
          let height = 0;

          if (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mimeType)) {
            try {
              const dims = await readImageDimensions(fullPath);
              if (dims) {
                width = dims.width;
                height = dims.height;
              }
            } catch (err) {
              console.warn(`Failed to parse dimensions for ${entry.name}:`, err);
            }
          }

          files.push({ name: entry.name, path: fullPath, size: fileStat.size, mimeType, width, height });
        }
      } catch {}
    }
    return files;
  } catch (error) {
    console.error('[AI Curator] Failed to scan directory:', error);
    throw error;
  }
}

function getMimeFromExtension(ext: string): string {
  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp', tiff: 'image/tiff',
    tif: 'image/tiff', avif: 'image/avif', heic: 'image/heic', heif: 'image/heif',
    raw: 'image/x-raw', cr2: 'image/x-canon-cr2', nef: 'image/x-nikon-nef',
    arw: 'image/x-sony-arw', dng: 'image/x-adobe-dng',
    mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo',
    mkv: 'video/x-matroska', webm: 'video/webm',
    pdf: 'application/pdf', doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    txt: 'text/plain', csv: 'text/csv', json: 'application/json', xml: 'application/xml',
    zip: 'application/zip', psd: 'image/vnd.adobe.photoshop', ai: 'application/postscript',
    eps: 'application/postscript',
  };
  return mimeMap[ext] || 'application/octet-stream';
}

function getServicePrompt(serviceType: ServiceType): string {
  try {
    const savedOverrides = localStorage.getItem('ai-curator-custom-prompts');
    if (savedOverrides) {
      const overrides = JSON.parse(savedOverrides);
      if (overrides[serviceType]) return overrides[serviceType];
    }

    const saved = localStorage.getItem('ai-curator-custom-services');
    if (saved) {
      const customServices = JSON.parse(saved);
      if (Array.isArray(customServices)) {
        const found = customServices.find(s => s.value === serviceType);
        if (found) return found.prompt;
      } else if (customServices[serviceType]) {
        return customServices[serviceType].prompt || customServices[serviceType];
      }
    }
  } catch (e) {
    console.error('Failed to parse custom services or overrides:', e);
  }
  return SERVICE_PROMPTS[serviceType] || SERVICE_PROMPTS.general;
}

async function downscaleImageToBase64(filePath: string, mimeType: string): Promise<string | null> {
  const supportedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!supportedMimeTypes.includes(mimeType)) {
    return null;
  }

  try {
    const { readFile } = await import('@tauri-apps/plugin-fs');
    const data = await readFile(filePath);
    
    // Create blob and object URL
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    try {
      // Load into HTML image
      const img = new Image();
      img.src = url;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Image failed to load'));
        // Timeout after 5 seconds
        setTimeout(() => reject(new Error('Image load timeout')), 5000);
      });

      // Create canvas and downscale
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      const MAX_DIM = 600;
      let width = img.width;
      let height = img.height;
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width > height) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      // Export as base64 JPEG
      const base64 = canvas.toDataURL('image/jpeg', 0.85);
      return base64;
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.warn('[AI Curator] Failed to downscale image for AI payload:', error);
    return null;
  }
}

function buildAiPrompt(
  file: { fileName: string; filePath: string; fileSizeBytes: number; mimeType: string },
  serviceType: ServiceType,
  mode: CurationMode,
  settings: CuratorSettings,
  hasImage: boolean
): string {
  const prompt = settings.enableServiceSpecificPrompts ? getServicePrompt(serviceType) : SERVICE_PROMPTS.general;

  const tagsText = settings.evaluationTags && settings.evaluationTags.length > 0
    ? `\nAdditionally, analyze the media content and select any relevant tags from the following list to include in the "reasonTags" array if applicable: ${settings.evaluationTags.join(', ')}.`
    : '';

  const imageText = hasImage
    ? '\nAn image preview of this file is attached. You MUST visually inspect the image to grade its sharpness, focus, exposure, composition, subject, and professional suitability.'
    : '\n(No image preview attached. Evaluate using available file metadata and name only.)';

  return `You are an AI media curator for a professional production studio. Your job is to analyze this media file and provide structured scoring.

File: ${file.fileName}
Path: ${file.filePath}
Size: ${file.fileSizeBytes} bytes
MIME: ${file.mimeType}
Service: ${serviceType || 'general'}
${imageText}

${prompt}
${tagsText}

Respond with ONLY valid JSON in this exact format:
{
  "scores": {
    "overall": <0-100>,
    "technicalQuality": <0-100>,
    "composition": <0-100>,
    "subjectQuality": <0-100>,
    "serviceFit": <0-100>,
    "deliverableReadiness": <0-100>,
    "uniqueness": <0-100>,
    "editPotential": <0-100>
  },
  "explanation": "<brief 1-2 sentence explanation reflecting your visual observations>",
  "reasonTags": ["<tag1>", "<tag2>"],
  "suggestedFolder": "best_selects|usable_secondary|reject_candidates|needs_editing|manual_review"
}

Score the file from 0-100 where 0 is unusable and 100 is perfect for delivery. Be critical and honest. Only mark files as "best_selects" if they truly excel for the intended service type.`;
}

function getAiAssistantSettings() {
  try {
    const saved = localStorage.getItem('ai-assistant-settings');
    if (saved) return JSON.parse(saved);
  } catch {}
  return null;
}

async function callAiForCuration(
  file: { fileName: string; filePath: string; fileSizeBytes: number; mimeType: string },
  serviceType: ServiceType,
  mode: CurationMode,
  settings: CuratorSettings,
  signal?: AbortSignal
): Promise<AiCurationResult | null> {
  const provider = settings.provider || 'openrouter';

  // 1. Fetch base64 image data if supported
  let base64Image: string | null = null;
  const isImage = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimeType);
  if (isImage && (mode === 'smart_sort' || mode === 'deep_ai_review')) {
    base64Image = await downscaleImageToBase64(file.filePath, file.mimeType);
  }

  const promptText = buildAiPrompt(file, serviceType, mode, settings, Boolean(base64Image));
  let text = '';

  try {
    if (provider === 'openrouter') {
      if (!openRouterService.isConfigured()) {
        const assistantSettings = getAiAssistantSettings();
        if (assistantSettings?.openRouter) {
          openRouterService.updateSettings(assistantSettings.openRouter);
        }
      }
      if (!openRouterService.isConfigured()) {
        console.warn('[AI Curator] OpenRouter not configured. Using default scores.');
        return null;
      }
      const content = base64Image
        ? [
            { type: 'text' as const, text: promptText },
            { type: 'image_url' as const, image_url: { url: base64Image, detail: 'low' as const } }
          ]
        : promptText;

      const messages: OpenRouterMessage[] = [{ role: 'user', content }];
      const response = await openRouterService.chat(messages, {
        model: settings.preferredModel,
        signal
      });
      const responseContent = response.choices[0]?.message?.content || '';
      text = typeof responseContent === 'string'
        ? responseContent
        : Array.isArray(responseContent)
        ? responseContent.map(part => part.type === 'text' ? part.text || '' : '').join('')
        : '';
    } else if (provider === 'anthropic') {
      const assistantSettings = getAiAssistantSettings();
      const apiKey = assistantSettings?.apiKey;
      if (!apiKey) {
        console.warn('[AI Curator] Anthropic API key not configured.');
        return null;
      }

      const content = base64Image
        ? [
            {
              type: 'image' as const,
              source: {
                type: 'base64' as const,
                media_type: 'image/jpeg' as const,
                data: base64Image.split(',')[1]
              }
            },
            {
              type: 'text' as const,
              text: promptText
            }
          ]
        : [{ type: 'text' as const, text: promptText }];

      const AnthropicClass = (await import('@anthropic-ai/sdk')).default;
      const client = new AnthropicClass({ apiKey });
      const response = await client.messages.create({
        model: settings.preferredModel || 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        messages: [{ role: 'user', content }],
      }, { signal });
      const responseContent = response.content[0];
      text = responseContent && responseContent.type === 'text' ? responseContent.text : '';
    } else if (provider === 'ollama') {
      const assistantSettings = getAiAssistantSettings();
      const baseUrl = assistantSettings?.ollamaBaseUrl || 'http://localhost:11434';
      const model = settings.preferredModel || assistantSettings?.ollamaModel || 'llama3.2:3b';

      const userMessage: any = {
        role: 'user',
        content: promptText
      };
      if (base64Image) {
        userMessage.images = [base64Image.split(',')[1]];
      }

      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: 'You are a JSON-only API. You must respond with raw JSON matching the requested schema. Do not output markdown backticks or explanations.' },
            userMessage
          ],
          options: {
            temperature: 0.1,
            num_predict: 400
          },
          stream: false,
          format: 'json',
        }),
        signal,
      });
      if (!response.ok) {
        throw new Error(`Ollama error: ${response.statusText}`);
      }
      const data = await response.json();
      text = data.message?.content || '';
    }

    if (!text) return null;

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[AI Curator] No JSON found in AI response');
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const s = parsed.scores || {};
    const defaultScore = 50;

    const scores: MediaScore = {
      overall: Math.min(100, Math.max(0, Number(s.overall) || defaultScore)),
      technicalQuality: Math.min(100, Math.max(0, Number(s.technicalQuality) || defaultScore)),
      composition: Math.min(100, Math.max(0, Number(s.composition) || defaultScore)),
      subjectQuality: Math.min(100, Math.max(0, Number(s.subjectQuality) || defaultScore)),
      serviceFit: Math.min(100, Math.max(0, Number(s.serviceFit) || defaultScore)),
      deliverableReadiness: Math.min(100, Math.max(0, Number(s.deliverableReadiness) || defaultScore)),
      uniqueness: Math.min(100, Math.max(0, Number(s.uniqueness) || defaultScore)),
      editPotential: Math.min(100, Math.max(0, Number(s.editPotential) || defaultScore)),
      automationConfidence: 75,
      aiConfidence: 80,
    };

    const validFolders = ['best_selects', 'usable_secondary', 'reject_candidates', 'needs_editing', 'manual_review'];
    const suggestedFolder = validFolders.includes(parsed.suggestedFolder) ? parsed.suggestedFolder : getDefaultFolder(scores, settings);

    return {
      scores,
      explanation: String(parsed.explanation || 'AI analysis completed.'),
      reasonTags: Array.isArray(parsed.reasonTags) ? parsed.reasonTags.map(String) : ['AI-reviewed'],
      suggestedFolder,
    };
  } catch (error: any) {
    if (error.name === 'AbortError' || error.message?.includes('cancelled')) throw error;
    console.error('[AI Curator] AI analysis failed:', error);
    return null;
  }
}

function stageProgress(
  onProgress: (p: CurationProgress) => void,
  stage: CurationStage,
  processed: number,
  total: number,
  currentFile?: string,
  currentFilePath?: string
) {
  onProgress({
    processed,
    total,
    currentFile,
    currentFilePath,
    stage: CURATION_STAGE_LABELS[stage],
    percent: total > 0 ? Math.round((processed / total) * 100) : 0,
  });
}

function buildSimilarGroups(results: CuratedFile[]): SimilarGroup[] {
  const groupMap = new Map<string, CuratedFile[]>();
  for (const file of results) {
    const gid = file.similarGroupId || file.assetId;
    if (!groupMap.has(gid)) groupMap.set(gid, []);
    groupMap.get(gid)!.push(file);
  }

  const groups: SimilarGroup[] = [];
  for (const [groupId, files] of groupMap.entries()) {
    if (files.length < 2) continue;
    const bestFile = files.reduce((best, f) => f.confidenceScore > best.confidenceScore ? f : best, files[0]);
    groups.push({
      groupId,
      bestFileAssetId: bestFile.assetId,
      allFileAssetIds: files.map((f) => f.assetId),
      files,
      reason: `Similar group with ${files.length} files. Best: ${bestFile.fileName} (score: ${bestFile.confidenceScore})`,
    });
  }
  return groups;
}

async function mapConcurrent<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<void>
): Promise<void> {
  let index = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (index < items.length) {
      const currentIdx = index++;
      await fn(items[currentIdx], currentIdx);
    }
  });
  await Promise.all(workers);
}

export async function runCuration(
  dirPath: string,
  mode: CurationMode,
  serviceType: ServiceType,
  onProgress: (progress: CurationProgress) => void
): Promise<CurationRun> {
  abortController = new AbortController();
  const signal = abortController.signal;
  const settings = getDefaultSettings();
  const runId = `curation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const startTime = new Date().toISOString();

  addAuditLog(runId, 'curation_started', `Curation started in mode: ${mode}, service: ${serviceType}, dir: ${dirPath}`, { mode, serviceType, dirPath });
  addAuditLog(runId, 'mode_selected', `Mode: ${mode} selected`);

  if (settings.enableNotifications) {
    addNotification(runId, 'curation_started', 'Curation Started', `AI Curator started processing in mode: ${MODE_LABEL(mode)}`);
  }

  stageProgress(onProgress, 'scanning', 0, 0);
  const files = await scanDirectory(dirPath);
  const totalFiles = files.length;
  addAuditLog(runId, 'files_queued', `Queued ${totalFiles} files for curation`);

  if (totalFiles === 0) {
    const emptyRun: CurationRun = createEmptyRun(runId, dirPath, mode, serviceType, startTime);
    saveRun(emptyRun);
    addAuditLog(runId, 'curation_completed', 'No files found, curation complete');
    abortController = null;
    return emptyRun;
  }

  const costEstimate = estimateCost(files, mode, settings);
  if (costEstimate.estimatedCostCents > settings.monthlyAiBudgetCents) {
    const failedRun = createFailedRun(runId, dirPath, mode, serviceType, startTime,
      `Estimated cost (${costEstimate.estimatedCostCents}c) exceeds monthly AI budget (${settings.monthlyAiBudgetCents}c).`);
    saveRun(failedRun);
    if (settings.enableNotifications) {
      addNotification(runId, 'cost_limit_reached', 'Cost Limit Reached', failedRun.errorMessage!);
    }
    abortController = null;
    return failedRun;
  }

  const results: CuratedFile[] = [];
  let processedCount = 0, autoSortedCount = 0, aiReviewedCount = 0;
  let bestSelectsCount = 0, usableCount = 0, rejectCount = 0, duplicateCount = 0;
  let errorCount = 0, skippedAiCount = 0;
  let actualCostCents = 0;
  const hashCounts = new Map<string, number>();
  const duplicateFiles = new Set<string>();
  const eligibilityResults = new Map<string, AiEligibility>();
  const qualityFlagsMap = new Map<string, string[]>();

  stageProgress(onProgress, 'extracting_metadata', 0, totalFiles);

  for (const file of files) {
    if (signal.aborted) return buildPartialRun(runId, dirPath, mode, serviceType, results, processedCount, autoSortedCount, aiReviewedCount, skippedAiCount, bestSelectsCount, usableCount, rejectCount, duplicateCount, errorCount, startTime, 'cancelled');

    const simpleHash = computeSimpleHash(file.name, file.size);
    const flags = deriveBasicQualityFlags(file.width, file.height, file.size, file.mimeType, undefined, undefined, file.name);
    const eligibility = deriveAiEligibility(flags, mode, file.width, file.height);
    eligibilityResults.set(file.path, eligibility);
    qualityFlagsMap.set(file.path, flags);

    const count = (hashCounts.get(simpleHash) || 0) + 1;
    hashCounts.set(simpleHash, count);

    if (count > 1) {
      duplicateFiles.add(file.path);
    }
  }

  addAuditLog(runId, 'files_preprocessed', `Preprocessed ${totalFiles} files`);
  stageProgress(onProgress, 'detecting_duplicates', 0, totalFiles);
  stageProgress(onProgress, 'grouping_similar', 0, totalFiles);

  const concurrency = settings.provider === 'ollama' ? 1 : Math.min(settings.maxBatchSize || 5, 5);

  await mapConcurrent(files, concurrency, async (file, index) => {
    if (signal.aborted) return;

    try {
      stageProgress(onProgress, 'running_ai_review', processedCount, totalFiles, file.name, file.path);

      const simpleHash = computeSimpleHash(file.name, file.size);
      const qualityFlags = qualityFlagsMap.get(file.path) || [];
      const aiEligibility = eligibilityResults.get(file.path) || 'manual_review_only';
      const count = hashCounts.get(simpleHash) || 0;
      const duplicateGroupId = count > 1 ? `dup-${simpleHash}` : undefined;
      const isDuplicate = duplicateFiles.has(file.path);

      const overSizeLimit = settings.fileSizeLimitBytes > 0 && file.size > settings.fileSizeLimitBytes;
      const shouldSkipDuplicate = settings.skipAiForExactDuplicates && isDuplicate;
      const shouldSkipLowQuality = settings.skipAiForLowResolution && aiEligibility === 'skip_low_quality';
      const isFastSort = mode === 'fast_sort';

      let shouldSkipAi = aiEligibility !== 'eligible' || isFastSort || overSizeLimit || shouldSkipDuplicate || shouldSkipLowQuality;

      if (mode === 'smart_sort' && !shouldSkipAi) {
        const autoResult = computeAutoScores(qualityFlags, isDuplicate, file.size, overSizeLimit, file.width, file.height, file.mimeType, file.name);
        const baseOverall = autoResult.scores.overall;
        // If metadata overall quality is definitive (excellent >= 75 or bad < 30), skip AI review
        if (baseOverall >= 75 || baseOverall < 30) {
          shouldSkipAi = true;
        }
      }

      let scores: MediaScore;
      let explanation: string;
      let wasAiReviewed = false;
      let reasonTags: string[];
      let fileAiEligibility: AiEligibility = aiEligibility;
      let fileQualityFlags = qualityFlags;

      if (shouldSkipAi) {
        autoSortedCount++;
        skippedAiCount++;
        const autoResult = computeAutoScores(qualityFlags, isDuplicate, file.size, overSizeLimit, file.width, file.height, file.mimeType, file.name);
        scores = autoResult.scores;
        explanation = autoResult.explanation;
        reasonTags = deriveReasonTags(scores, qualityFlags, isDuplicate, false);
      } else {
        try {
          const aiResult = await callAiForCuration(
            {
              fileName: file.name,
              filePath: file.path,
              fileSizeBytes: file.size,
              mimeType: file.mimeType
            },
            serviceType,
            mode,
            settings,
            signal
          );
          if (aiResult) {
            scores = aiResult.scores;
            explanation = aiResult.explanation;
            reasonTags = aiResult.reasonTags;
            wasAiReviewed = true;
            aiReviewedCount++;
            actualCostCents += estimateAiCallCostCents(mode);
          } else {
            autoSortedCount++;
            skippedAiCount++;
            const autoResult = computeAutoScores(qualityFlags, isDuplicate, file.size, overSizeLimit, file.width, file.height, file.mimeType, file.name);
            scores = { ...autoResult.scores, automationConfidence: 60 };
            explanation = autoResult.explanation;
            reasonTags = deriveReasonTags(scores, qualityFlags, isDuplicate, false);
          }
        } catch (aiError: any) {
          if (aiError.name === 'AbortError') {
            throw aiError;
          }
          autoSortedCount++;
          skippedAiCount++;
          const autoResult = computeAutoScores(qualityFlags, isDuplicate, file.size, overSizeLimit, file.width, file.height, file.mimeType, file.name);
          scores = { ...autoResult.scores, automationConfidence: 40 };
          explanation = 'AI analysis failed. Auto-sorted with available metadata.';
          reasonTags = deriveReasonTags(scores, qualityFlags, isDuplicate, false);
        }
      }

      const suggestedFolder = isDuplicate ? 'similar_review' as const : determineSuggestedFolder(scores, qualityFlags, isDuplicate, settings);
      if (suggestedFolder === 'best_selects') bestSelectsCount++;
      else if (suggestedFolder === 'usable_secondary') usableCount++;
      else if (suggestedFolder === 'reject_candidates') rejectCount++;
      else if (suggestedFolder === 'similar_review') duplicateCount++;

      results.push({
        assetId: `file-${index}-${simpleHash}`,
        fileName: file.name,
        filePath: file.path,
        fileSizeBytes: file.size,
        mimeType: file.mimeType,
        width: file.width,
        height: file.height,
        suggestedFolder,
        confidenceScore: scores.overall,
        scores,
        reasonTags,
        explanation,
        similarGroupId: duplicateGroupId || undefined,
        isBestOfSimilarGroup: !isDuplicate,
        wasReviewedByAI: wasAiReviewed,
        wasAutoSorted: !wasAiReviewed,
        staffDecision: 'pending',
        aiEligibility: fileAiEligibility,
        qualityFlags: fileQualityFlags,
      });

      processedCount++;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') throw err;
      console.error(`[AI Curator] Error processing ${file.name}:`, err);
      errorCount++;
      processedCount++;
    }
  });

  if (signal.aborted) {
    return buildPartialRun(runId, dirPath, mode, serviceType, results, processedCount, autoSortedCount, aiReviewedCount, skippedAiCount, bestSelectsCount, usableCount, rejectCount, duplicateCount, errorCount, startTime, 'cancelled');
  }

  stageProgress(onProgress, 'creating_suggestions', processedCount, totalFiles);
  const similarGroups = buildSimilarGroups(results);
  const similarGroupCount = similarGroups.length;
  const folderPlan = buildFolderPlan(results);

  addAuditLog(runId, 'folder_recommendations_created', `Created ${folderPlan.length} folder groups with ${results.length} files`);

  const run: CurationRun = {
    id: runId,
    status: 'ready_for_review',
    sourceDirectory: dirPath,
    mode,
    serviceType,
    totalFiles,
    processedCount,
    aiReviewedCount,
    autoSortedCount,
    skippedAiCount,
    bestSelectsCount,
    usableCount,
    rejectCount,
    duplicateCount,
    similarGroupCount,
    errorCount,
    totalFilesQueued: totalFiles,
    progressPercent: 100,
    currentStepLabel: CURATION_STAGE_LABELS.ready_for_review,
    currentStage: 'ready_for_review',
    folderPlan,
    allResults: results,
    similarGroups,
    estimatedCostCents: actualCostCents > 0 ? actualCostCents : costEstimate.estimatedCostCents,
    actualCostCents,
    createdAt: startTime,
    startedAt: startTime,
    completedAt: new Date().toISOString(),
  };

  saveRun(run);
  addAuditLog(runId, 'curation_completed', `Curation completed: ${totalFiles} files, ${aiReviewedCount} AI-reviewed, ${autoSortedCount} auto-sorted`);

  if (settings.enableNotifications) {
    addNotification(runId, 'review_ready', 'AI Curator Review Ready',
      `AI Curator finished sorting ${totalFiles} files in ${mode} mode. Review the suggested folders when you're ready.`);
  }

  abortController = null;
  return run;
}

function MODE_LABEL(mode: CurationMode): string {
  const labels: Record<CurationMode, string> = { fast_sort: 'Fast Sort', smart_sort: 'Smart Sort', deep_ai_review: 'Deep AI Review' };
  return labels[mode];
}

function createEmptyRun(runId: string, dirPath: string, mode: CurationMode, serviceType: ServiceType, startTime: string): CurationRun {
  return {
    id: runId, status: 'ready_for_review', sourceDirectory: dirPath, mode, serviceType,
    totalFiles: 0, processedCount: 0, aiReviewedCount: 0, autoSortedCount: 0, skippedAiCount: 0,
    bestSelectsCount: 0, usableCount: 0, rejectCount: 0, duplicateCount: 0, similarGroupCount: 0,
    errorCount: 0, totalFilesQueued: 0, progressPercent: 100, currentStepLabel: 'No files found in directory.',
    currentStage: 'ready_for_review', folderPlan: [], allResults: [], similarGroups: [],
    createdAt: startTime, completedAt: new Date().toISOString(),
  };
}

function createFailedRun(runId: string, dirPath: string, mode: CurationMode, serviceType: ServiceType, startTime: string, errorMessage: string): CurationRun {
  return {
    id: runId, status: 'failed', sourceDirectory: dirPath, mode, serviceType,
    totalFiles: 0, processedCount: 0, aiReviewedCount: 0, autoSortedCount: 0, skippedAiCount: 0,
    bestSelectsCount: 0, usableCount: 0, rejectCount: 0, duplicateCount: 0, similarGroupCount: 0,
    errorCount: 0, totalFilesQueued: 0, progressPercent: 0, currentStepLabel: 'Failed',
    currentStage: 'failed', folderPlan: [], allResults: [], similarGroups: [],
    errorMessage, createdAt: startTime, completedAt: new Date().toISOString(),
  };
}

function buildPartialRun(
  runId: string, dirPath: string, mode: CurationMode, serviceType: ServiceType,
  results: CuratedFile[], processedCount: number, autoSortedCount: number,
  aiReviewedCount: number, skippedAiCount: number, bestSelectsCount: number,
  usableCount: number, rejectCount: number, duplicateCount: number,
  errorCount: number, startTime: string, status: 'cancelled' | 'failed'
): CurationRun {
  const folderPlan = buildFolderPlan(results);
  const similarGroups = buildSimilarGroups(results);
  const run: CurationRun = {
    id: runId, status: status as CurationStage, sourceDirectory: dirPath, mode, serviceType,
    totalFiles: results.length, processedCount, aiReviewedCount, autoSortedCount, skippedAiCount,
    bestSelectsCount, usableCount, rejectCount, duplicateCount, similarGroupCount: 0, errorCount,
    totalFilesQueued: results.length,
    progressPercent: status === 'cancelled' ? Math.round((processedCount / (processedCount + errorCount || 1)) * 100) : 100,
    currentStepLabel: status === 'cancelled' ? 'Cancelled by user' : 'Failed',
    currentStage: status,
    folderPlan, allResults: results, similarGroups,
    createdAt: startTime, completedAt: new Date().toISOString(),
  };
  saveRun(run);
  addAuditLog(runId, status === 'cancelled' ? 'curation_cancelled' : 'curation_failed',
    `Curation ${status}: ${processedCount} files processed, ${errorCount} errors`);

  if (getDefaultSettings().enableNotifications) {
    addNotification(runId, 'curation_failed', 'Curation Failed',
      `AI Curator ${status} after processing ${processedCount} files.`);
  }
  abortController = null;
  return run;
}

function buildFolderPlan(results: CuratedFile[]): FolderPlan[] {
  const bestSelects = results.filter(r => r.suggestedFolder === 'best_selects');
  const usableSecondary = results.filter(r => r.suggestedFolder === 'usable_secondary');
  const needsEditing = results.filter(r => r.suggestedFolder === 'needs_editing');
  const rejectCandidates = results.filter(r => r.suggestedFolder === 'reject_candidates');
  const similarReview = results.filter(r => r.suggestedFolder === 'similar_review');
  const manualReview = results.filter(r => r.suggestedFolder === 'manual_review');

  const plans: FolderPlan[] = [];
  if (bestSelects.length > 0) plans.push({ folderName: 'Best Selects', suggestedLabel: 'best_selects', description: 'Highest quality files matching project needs', confidence: 85, files: bestSelects });
  if (usableSecondary.length > 0) plans.push({ folderName: 'Usable / Secondary', suggestedLabel: 'usable_secondary', description: 'Decent alternatives and secondary shots', confidence: 70, files: usableSecondary });
  if (needsEditing.length > 0) plans.push({ folderName: 'Needs Editing', suggestedLabel: 'needs_editing', description: 'Promising files that need editing or staff judgment', confidence: 65, files: needsEditing });
  if (similarReview.length > 0) plans.push({ folderName: 'Similar / Duplicate Review', suggestedLabel: 'similar_review', description: 'Possible duplicates or similar files for side-by-side review', confidence: 75, files: similarReview });
  if (manualReview.length > 0) plans.push({ folderName: 'Manual Review', suggestedLabel: 'manual_review', description: 'Files that need a staff decision before organization', confidence: 50, files: manualReview });
  if (rejectCandidates.length > 0) plans.push({ folderName: 'Reject Candidates', suggestedLabel: 'reject_candidates', description: 'Low quality or unsuitable files', confidence: 90, files: rejectCandidates });
  return plans;
}

function saveRun(run: CurationRun): void {
  try {
    const saved = localStorage.getItem('ai-curator-runs');
    const runs: CurationRun[] = saved ? JSON.parse(saved) : [];
    const idx = runs.findIndex(r => r.id === run.id);
    if (idx >= 0) runs[idx] = run;
    else runs.unshift(run);
    localStorage.setItem('ai-curator-runs', JSON.stringify(runs.slice(0, 50)));
  } catch {}
}

export function getSavedRuns(): CurationRun[] {
  try {
    const saved = localStorage.getItem('ai-curator-runs');
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
}

export function getRunById(runId: string): CurationRun | null {
  return getSavedRuns().find(r => r.id === runId) || null;
}

export function updateRun(run: CurationRun): void {
  saveRun(run);
}

export async function rerunCurationOnSelected(
  run: CurationRun,
  fileAssetIds: string[],
  onProgress: (progress: CurationProgress) => void
): Promise<CurationRun> {
  const filesToRerun = run.allResults.filter(r => fileAssetIds.includes(r.assetId));
  if (filesToRerun.length === 0) return run;

  const newRunId = `curation-rerun-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const settings = getDefaultSettings();
  abortController = new AbortController();
  const signal = abortController.signal;

  addAuditLog(newRunId, 'staff_reran_curation', `Rerunning curation on ${filesToRerun.length} files`);

  let aiReviewedCount = 0, autoSortedCount = 0, processedCount = 0;
  let bestSelectsCount = 0, usableCount = 0, rejectCount = 0, duplicateCount = 0, errorCount = 0, skippedAiCount = 0;
  const updatedResults: CuratedFile[] = [];

  for (let i = 0; i < filesToRerun.length; i++) {
    if (signal.aborted) break;
    const file = filesToRerun[i];

    onProgress({ processed: i, total: filesToRerun.length, currentFile: file.fileName, currentFilePath: file.filePath, stage: `Rerunning AI on ${file.fileName}...`, percent: Math.round((i / filesToRerun.length) * 100) });

    try {
      const aiResult = await callAiForCuration(
        { fileName: file.fileName, filePath: file.filePath, fileSizeBytes: file.fileSizeBytes, mimeType: file.mimeType },
        run.serviceType, run.mode, settings, signal
      );

      if (aiResult) {
        file.scores = aiResult.scores;
        file.explanation = aiResult.explanation;
        file.reasonTags = aiResult.reasonTags;
        file.wasReviewedByAI = true;
        file.wasAutoSorted = false;
        file.suggestedFolder = aiResult.suggestedFolder as any;
        file.confidenceScore = aiResult.scores.overall;
        aiReviewedCount++;
      } else {
        autoSortedCount++;
        skippedAiCount++;
      }
      processedCount++;
    } catch {
      errorCount++;
      processedCount++;
    }

    if (file.suggestedFolder === 'best_selects') bestSelectsCount++;
    else if (file.suggestedFolder === 'usable_secondary') usableCount++;
    else if (file.suggestedFolder === 'reject_candidates') rejectCount++;
    else if (file.suggestedFolder === 'similar_review') duplicateCount++;

    updatedResults.push(file);
  }

  const otherFiles = run.allResults.filter(r => !fileAssetIds.includes(r.assetId));
  const allResults = [...otherFiles, ...updatedResults];
  const folderPlan = buildFolderPlan(allResults);
  const similarGroups = buildSimilarGroups(allResults);

  const updated: CurationRun = {
    ...run,
    id: newRunId,
    status: 'ready_for_review',
    processedCount: allResults.length,
    aiReviewedCount: run.aiReviewedCount - filesToRerun.filter(f => f.wasReviewedByAI).length + aiReviewedCount,
    autoSortedCount: run.autoSortedCount - filesToRerun.filter(f => !f.wasReviewedByAI).length + autoSortedCount,
    skippedAiCount: run.skippedAiCount + skippedAiCount,
    bestSelectsCount, usableCount, rejectCount, duplicateCount, errorCount,
    progressPercent: 100,
    currentStepLabel: 'Rerun complete - ready for review',
    currentStage: 'ready_for_review',
    folderPlan, allResults, similarGroups,
    actualCostCents: (run.actualCostCents || 0) + (aiReviewedCount * estimateAiCallCostCents(run.mode)),
    completedAt: new Date().toISOString(),
  };

  saveRun(updated);
  abortController = null;
  return updated;
}

export async function applyCurationResults(
  results: CuratedFile[],
  targetBasePath: string,
  onProgress?: (current: number, total: number, fileName: string) => void
): Promise<{ moved: number; errors: number }> {
  let moved = 0, errors = 0;
  const total = results.length;

  try {
    const { mkdir, copyFile } = await import('@tauri-apps/plugin-fs');
    const { join } = await import('@tauri-apps/api/path');

    for (let i = 0; i < results.length; i++) {
      const file = results[i];
      onProgress?.(i + 1, total, file.fileName);

      try {
        const folderName = getFolderDisplayName(file.suggestedFolder);
        const targetDir = await join(targetBasePath, folderName);
        await mkdir(targetDir, { recursive: true });
        const targetPath = await join(targetDir, file.fileName);
        await copyFile(file.filePath, targetPath);
        moved++;
      } catch (err) {
        console.error(`[AI Curator] Failed to move ${file.fileName}:`, err);
        errors++;
      }
    }
  } catch (err) {
    console.error('[AI Curator] File operations not available', err);
    throw err;
  }

  return { moved, errors };
}

function getFolderDisplayName(folder: string): string {
  const names: Record<string, string> = {
    best_selects: 'Best Selects', usable_secondary: 'Usable Secondary',
    needs_editing: 'Needs Editing', reject_candidates: 'Reject Candidates',
    similar_review: 'Similar Review', manual_review: 'Manual Review',
  };
  return names[folder] || folder;
}
