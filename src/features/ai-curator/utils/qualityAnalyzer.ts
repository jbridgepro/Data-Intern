export interface QualityFlags {
  flags: string[];
  blurEstimate: number;
  brightnessEstimate: number;
  aiEligibility: AiEligibility;
}

export type AiEligibility =
  | 'eligible'
  | 'skip_low_quality'
  | 'skip_unsupported'
  | 'skip_corrupt'
  | 'manual_review_only';

export function computeSimpleHash(filename: string, sizeBytes: number): string {
  let hash = 0;
  const str = `${filename}::${sizeBytes}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `simple-${Math.abs(hash).toString(16)}`;
}

export function estimateBlur(imageData?: Uint8Array | number[]): number {
  if (!imageData || imageData.length < 100) return 0;
  let totalDiff = 0;
  let samples = 0;
  for (let i = 1; i < imageData.length; i++) {
    const diff = Math.abs(imageData[i] - imageData[i - 1]);
    totalDiff += diff;
    samples++;
  }
  const avgDiff = samples > 0 ? totalDiff / samples : 0;
  return Math.min(100, Math.round((avgDiff / 128) * 100));
}

export function estimateBrightness(imageData?: Uint8Array | number[]): number {
  if (!imageData || imageData.length < 100) return 50;
  let total = 0;
  let samples = 0;
  for (let i = 0; i < imageData.length && samples < 10000; i++) {
    total += imageData[i];
    samples++;
  }
  return Math.round((total / samples / 255) * 100);
}

export function deriveBasicQualityFlags(
  width: number,
  height: number,
  fileSize: number,
  mimeType: string,
  blurEstimate?: number,
  brightnessEstimate?: number,
  fileName?: string
): string[] {
  const flags: string[] = [];
  if (width && height) {
    const resolution = width * height;
    if (resolution < 1000000) flags.push('very_low_resolution');

    const ratio = width / height;
    if (ratio > 3.0 || ratio < 0.33) flags.push('extreme_aspect_ratio');

    if (resolution >= 1000000 && fileSize > 0 && fileSize < 150 * 1024) {
      flags.push('high_compression');
    }
  }
  if (fileSize > 0 && fileSize < 1024 * 10) flags.push('very_small_file');
  if (blurEstimate !== undefined && blurEstimate < 15) flags.push('possibly_blurry');
  if (brightnessEstimate !== undefined && brightnessEstimate < 15) flags.push('very_dark');
  if (brightnessEstimate !== undefined && brightnessEstimate > 90) flags.push('very_bright');
  if (!mimeType || mimeType === 'application/octet-stream') flags.push('unsupported_format');

  const rawExtensions = ['cr2', 'nef', 'arw', 'dng', 'crw', 'orf', 'rw2', 'pef', 'raf', 'mrw', 'srw', 'raw'];
  const ext = fileName?.split('.').pop()?.toLowerCase() || '';
  const isRaw = rawExtensions.includes(ext) ||
    (mimeType && (mimeType.startsWith('image/x-') || mimeType === 'image/dng' || mimeType.includes('raw')));
  if (isRaw) {
    flags.push('raw_format');
  }

  return flags;
}

export function deriveAiEligibility(
  flags: string[],
  mode: string,
  width: number,
  height: number
): AiEligibility {
  if (flags.includes('unsupported_format')) return 'skip_unsupported';
  if (flags.includes('corrupt_file')) return 'skip_corrupt';
  if (mode === 'fast_sort') return 'manual_review_only';
  if (mode === 'smart_sort') {
    if (flags.includes('very_low_resolution') || flags.includes('possibly_blurry') || flags.includes('very_dark') || flags.includes('very_bright')) {
      return 'skip_low_quality';
    }
    return 'eligible';
  }
  if (mode === 'deep_ai_review') {
    if ((width && height && width * height < 320 * 240) || flags.includes('very_small_file')) return 'skip_low_quality';
    return 'eligible';
  }
  if (width && height && width * height < 320 * 240) return 'skip_low_quality';
  return 'eligible';
}

export function estimateQualityFromMetadata(
  width: number,
  height: number,
  fileSize: number,
  mimeType: string,
  fileName?: string
): QualityFlags {
  const blurEstimate = 0;
  const brightnessEstimate = 50;
  const flags = deriveBasicQualityFlags(width, height, fileSize, mimeType, blurEstimate, brightnessEstimate, fileName);
  const aiEligibility = deriveAiEligibility(flags, 'fast_sort', width, height);
  return { flags, blurEstimate, brightnessEstimate, aiEligibility };
}
