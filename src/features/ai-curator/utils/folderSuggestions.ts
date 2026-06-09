import type { MediaScore, SuggestedFolder, CuratorSettings } from '../types';

export function determineSuggestedFolder(
  scores: MediaScore,
  flags: string[],
  isDuplicate: boolean,
  settings?: CuratorSettings
): SuggestedFolder {
  if (isDuplicate) return 'similar_review';
  if (flags.includes('unsupported_format') || flags.includes('corrupt_file')) return 'reject_candidates';
  
  const bestThresh = settings?.bestSelectsThreshold ?? 70;
  const usableThresh = settings?.usableSecondaryThreshold ?? 40;
  const needsThresh = settings?.needsEditingThreshold ?? 20;

  if (scores.overall >= bestThresh) return 'best_selects';
  if (scores.overall >= usableThresh) return 'usable_secondary';
  if (scores.overall >= needsThresh) return 'needs_editing';
  return 'reject_candidates';
}

export function deriveReasonTags(
  scores: MediaScore,
  flags: string[],
  isDuplicate: boolean,
  wasAiReviewed: boolean
): string[] {
  const tags: string[] = [];
  if (isDuplicate) tags.push('Duplicate candidate');
  if (flags.includes('very_low_resolution')) tags.push('Low resolution');
  if (flags.includes('possibly_blurry')) tags.push('Soft focus');
  if (flags.includes('very_dark')) tags.push('Underexposed');
  if (flags.includes('very_bright')) tags.push('Overexposed');
  if (flags.includes('extreme_aspect_ratio')) tags.push('Extreme aspect ratio');
  if (flags.includes('high_compression')) tags.push('High compression');
  if (flags.includes('raw_format')) tags.push('RAW format');

  if (wasAiReviewed) tags.push('AI-reviewed');
  else tags.push('Auto-sorted without AI');
  
  if (scores.overall >= 70) tags.push('Sharp focus', 'Good exposure', 'Strong composition');
  if (scores.overall >= 40 && scores.overall < 70) tags.push('Needs editing');
  if (scores.overall < 40) tags.push('Not client-ready');
  return tags;
}

export function generateExplanation(
  scores: MediaScore,
  flags: string[],
  folder: SuggestedFolder | 'manual_review',
  wasAiReviewed: boolean
): string {
  const parts: string[] = [];
  if (folder === 'best_selects') parts.push('Strong candidate for this project.');
  else if (folder === 'usable_secondary') parts.push('Decent quality, usable as secondary or alternate.');
  else if (folder === 'reject_candidates') parts.push('Not suitable for delivery based on quality checks.');
  else if (folder === 'needs_editing') parts.push('May be salvageable with editing.');
  else if (folder === 'similar_review') parts.push('Similar to another file; staff review recommended.');

  if (scores.serviceFit >= 70) parts.push('Good alignment with requested service.');
  else if (scores.serviceFit < 40) parts.push('Low alignment with project requirements.');

  if (wasAiReviewed) parts.push('AI analysis applied.');
  else parts.push('Sorted by automated preprocessing without AI.');

  return parts.join(' ');
}

export function getDefaultFolder(scores: Partial<MediaScore>, settings?: CuratorSettings): SuggestedFolder {
  const overall = Number(scores.overall) || 50;
  const bestThresh = settings?.bestSelectsThreshold ?? 70;
  const usableThresh = settings?.usableSecondaryThreshold ?? 40;
  const needsThresh = settings?.needsEditingThreshold ?? 20;

  if (overall >= bestThresh) return 'best_selects';
  if (overall >= usableThresh) return 'usable_secondary';
  if (overall >= needsThresh) return 'needs_editing';
  return 'reject_candidates';
}

export function computeAutoScores(
  flags: string[],
  isDuplicate: boolean,
  fileSize: number,
  overSizeLimit: boolean,
  width?: number,
  height?: number,
  mimeType?: string,
  fileName?: string
): { scores: MediaScore; explanation: string } {
  const scores: MediaScore = {
    overall: 50,
    technicalQuality: 50,
    composition: 50,
    subjectQuality: 50,
    serviceFit: 50,
    deliverableReadiness: 50,
    uniqueness: 50,
    editPotential: 50,
    automationConfidence: 80,
  };

  // 1. Establish the base quality scoring based on RAW vs standard files
  const isRaw = flags.includes('raw_format');
  if (isRaw) {
    scores.overall = 65;
    scores.technicalQuality = 65;
    scores.composition = 55;
    scores.editPotential = 85;
  } else {
    scores.overall = 60;
    scores.technicalQuality = 55;
    scores.composition = 55;
  }

  // 2. Adjust scores based on flags
  if (flags.includes('very_low_resolution')) {
    scores.overall = 15;
    scores.technicalQuality = 10;
    scores.composition = 20;
    scores.deliverableReadiness = 5;
    scores.editPotential = 15;
  }

  if (flags.includes('extreme_aspect_ratio')) {
    scores.composition = 20;
    scores.overall = Math.max(10, scores.overall - 15);
  }

  if (flags.includes('high_compression')) {
    scores.technicalQuality = 30;
    scores.overall = Math.max(10, scores.overall - 10);
  }

  if (
    flags.includes('possibly_blurry') ||
    flags.includes('very_dark') ||
    flags.includes('very_bright')
  ) {
    // If not already set to very low resolution, apply standard degradation
    if (!flags.includes('very_low_resolution')) {
      scores.overall = 20;
      scores.technicalQuality = 15;
      scores.composition = Math.min(scores.composition, 30);
      scores.deliverableReadiness = Math.min(scores.deliverableReadiness, 10);
    }
  }

  // 3. Megapixel Density Boost (>= 12MP rewards high resolution uploads)
  if (width && height) {
    const megapixels = (width * height) / 1000000;
    if (megapixels >= 12) {
      const hasCriticalFlags =
        flags.includes('very_low_resolution') ||
        flags.includes('possibly_blurry') ||
        flags.includes('very_dark') ||
        flags.includes('very_bright') ||
        flags.includes('extreme_aspect_ratio');

      if (!hasCriticalFlags) {
        scores.overall = Math.min(85, scores.overall + 10);
        scores.technicalQuality = Math.min(85, scores.technicalQuality + 10);
      }
    }
  }

  // 4. File Size Limits
  if (fileSize > 0 && fileSize < 1024 * 50) {
    scores.overall = Math.min(scores.overall, 20);
  }

  // 5. Duplicates Check
  if (isDuplicate) {
    scores.overall = Math.min(scores.overall, 35);
    scores.uniqueness = 10;
  }

  // 6. Over Size Limit
  let explanation = '';
  if (overSizeLimit) {
    scores.automationConfidence = 50;
    explanation = 'File is over the configured AI size limit. Sent to manual review using metadata only.';
  }

  if (!explanation) {
    explanation = generateExplanation(scores, flags, determineSuggestedFolder(scores, flags, isDuplicate), false);
  }

  return { scores, explanation };
}
