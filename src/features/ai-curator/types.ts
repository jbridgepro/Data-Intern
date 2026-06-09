export type CurationMode = 'fast_sort' | 'smart_sort' | 'deep_ai_review';

export type CurationStage =
  | 'queued'
  | 'scanning'
  | 'generating_thumbnails'
  | 'extracting_metadata'
  | 'detecting_duplicates'
  | 'grouping_similar'
  | 'running_ai_review'
  | 'creating_suggestions'
  | 'ready_for_review'
  | 'applied'
  | 'rejected'
  | 'failed'
  | 'cancelled';

export type ServiceType = string;

export type SuggestedFolder =
  | 'best_selects'
  | 'usable_secondary'
  | 'needs_editing'
  | 'reject_candidates'
  | 'similar_review'
  | 'manual_review';

export type AiEligibility =
  | 'eligible'
  | 'skip_exact_duplicate'
  | 'skip_corrupt'
  | 'skip_unsupported'
  | 'skip_low_quality'
  | 'manual_review_only';

export type StaffDecision = 'accepted' | 'modified' | 'rejected' | 'pending';

export type AuditAction =
  | 'curation_started'
  | 'mode_selected'
  | 'files_queued'
  | 'files_preprocessed'
  | 'files_sent_to_ai'
  | 'files_skipped_ai'
  | 'folder_recommendations_created'
  | 'staff_reviewed_results'
  | 'staff_modified_recommendation'
  | 'staff_applied_recommendations'
  | 'staff_rejected_recommendations'
  | 'staff_moved_to_deliverables'
  | 'staff_archived_files'
  | 'staff_reran_curation'
  | 'curation_failed'
  | 'curation_completed'
  | 'curation_cancelled';

export interface AuditLogEntry {
  id: string;
  curationRunId: string;
  action: AuditAction;
  details: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface MediaScore {
  overall: number;
  technicalQuality: number;
  composition: number;
  subjectQuality: number;
  serviceFit: number;
  deliverableReadiness: number;
  uniqueness: number;
  editPotential: number;
  automationConfidence?: number;
  aiConfidence?: number;
}

export interface CuratedFile {
  assetId: string;
  fileName: string;
  filePath: string;
  fileSizeBytes: number;
  mimeType: string;
  width: number;
  height: number;
  suggestedFolder: SuggestedFolder;
  confidenceScore: number;
  scores: MediaScore;
  reasonTags: string[];
  explanation: string;
  similarGroupId?: string;
  isBestOfSimilarGroup: boolean;
  wasReviewedByAI: boolean;
  wasAutoSorted: boolean;
  staffDecision?: StaffDecision;
  finalFolder?: string;
  aiEligibility?: AiEligibility;
  qualityFlags?: string[];
  errorMessage?: string;
}

export interface SimilarGroup {
  groupId: string;
  bestFileAssetId: string;
  allFileAssetIds: string[];
  files: CuratedFile[];
  reason: string;
}

export interface FolderPlan {
  folderName: string;
  suggestedLabel: SuggestedFolder | 'manual_review';
  description: string;
  confidence: number;
  files: CuratedFile[];
}

export interface CostEstimate {
  totalFiles: number;
  estimatedAiCalls: number;
  estimatedCostCents: number;
  autoSortableCount: number;
  eligibleForAiCount: number;
  projectedAiReviewCount: number;
  currency: string;
}

export interface CurationRun {
  id: string;
  status: CurationStage;
  sourceDirectory: string;
  mode: CurationMode;
  serviceType: ServiceType;
  totalFiles: number;
  processedCount: number;
  aiReviewedCount: number;
  autoSortedCount: number;
  skippedAiCount: number;
  bestSelectsCount: number;
  usableCount: number;
  rejectCount: number;
  duplicateCount: number;
  similarGroupCount: number;
  errorCount: number;
  totalFilesQueued: number;
  progressPercent: number;
  currentStepLabel: string;
  currentStage: CurationStage;
  folderPlan: FolderPlan[];
  allResults: CuratedFile[];
  similarGroups: SimilarGroup[];
  estimatedCostCents?: number;
  actualCostCents?: number;
  errorMessage?: string;
  resumeToken?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface CuratorSettings {
  maxBatchSize: number;
  preferredModel: string;
  provider?: 'anthropic' | 'ollama' | 'openrouter';
  confidenceThreshold: number;
  enableServiceSpecificPrompts: boolean;
  skipAiForExactDuplicates: boolean;
  skipAiForLowResolution: boolean;
  fileSizeLimitBytes: number;
  enableNotifications: boolean;
  maxAiCallsPerJob: number;
  monthlyAiBudgetCents: number;
  defaultMode: CurationMode;
  retryLimit: number;
  useThumbnailsForAi: boolean;
  requireApprovalForDeepReview: boolean;
  bestSelectsThreshold: number;
  usableSecondaryThreshold: number;
  needsEditingThreshold: number;
  evaluationTags: string[];
}

export interface CurationNotification {
  id: string;
  curationRunId: string;
  type: 'curation_started' | 'curation_completed' | 'curation_failed' | 'review_ready' | 'cost_limit_reached';
  title: string;
  message: string;
  status: 'queued' | 'sent' | 'read';
  createdAt: string;
}

export const DEFAULT_SETTINGS_KEY = 'ai-curator-settings';
export const DEFAULT_RUNS_KEY = 'ai-curator-runs';
export const DEFAULT_AUDIT_KEY = 'ai-curator-audit';
export const DEFAULT_NOTIFICATIONS_KEY = 'ai-curator-notifications';

export const DEFAULT_CURATOR_SETTINGS: CuratorSettings = {
  maxBatchSize: 10,
  preferredModel: 'google/gemini-2.0-flash-001',
  provider: 'openrouter',
  confidenceThreshold: 70,
  enableServiceSpecificPrompts: true,
  skipAiForExactDuplicates: true,
  skipAiForLowResolution: true,
  fileSizeLimitBytes: 20 * 1024 * 1024,
  enableNotifications: true,
  maxAiCallsPerJob: 200,
  monthlyAiBudgetCents: 50000,
  defaultMode: 'smart_sort',
  retryLimit: 3,
  useThumbnailsForAi: true,
  requireApprovalForDeepReview: false,
  bestSelectsThreshold: 70,
  usableSecondaryThreshold: 40,
  needsEditingThreshold: 20,
  evaluationTags: ['candid', 'staged', 'outdoor', 'indoor', 'golden-hour', 'close-up', 'wide-angle'],
};

export const CURATION_STAGE_LABELS: Record<CurationStage, string> = {
  queued: 'Queued',
  scanning: 'Scanning files...',
  generating_thumbnails: 'Generating thumbnails...',
  extracting_metadata: 'Extracting metadata...',
  detecting_duplicates: 'Detecting duplicates...',
  grouping_similar: 'Grouping similar files...',
  running_ai_review: 'Running AI analysis...',
  creating_suggestions: 'Creating suggestions...',
  ready_for_review: 'Ready for review',
  applied: 'Applied',
  rejected: 'Rejected',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export const MODE_DESCRIPTIONS: Record<CurationMode, { label: string; description: string; speed: string; cost: string; quality: string }> = {
  fast_sort: {
    label: 'Fast Sort',
    description: 'Quick metadata-based organization without AI. Best for rapid sorting.',
    speed: 'Very fast',
    cost: 'Free',
    quality: 'Basic',
  },
  smart_sort: {
    label: 'Smart Sort',
    description: 'Automation first, then AI on select candidates. Best default option.',
    speed: 'Fast',
    cost: 'Low',
    quality: 'High',
  },
  deep_ai_review: {
    label: 'Deep AI Review',
    description: 'Broader AI analysis for premium jobs. Most thorough review.',
    speed: 'Slow',
  cost: 'Higher',
    quality: 'Highest',
  },
};

export const SERVICE_PROMPTS: Record<ServiceType, string> = {
  portrait_photography: `Evaluate each image for professional portrait quality, subject presentation, expression, technical sharpness, and suitability for client-facing portrait deliverables.

Prioritize:

1. Eye focus and facial sharpness
   The subject’s eyes and face should be sharp. Soft focus on the eyes should strongly reduce the score unless the image is intentionally artistic.

2. Expression and presence
   Prioritize natural, confident, flattering, professional, and emotionally appropriate expressions. Flag closed eyes, awkward expressions, mid-blink shots, unflattering moments, or distracted looks.

3. Lighting and skin presentation
   Evaluate flattering light, even exposure, skin tone accuracy, harsh shadows, blown highlights, color balance, and whether retouching could reasonably improve the image.

4. Composition and framing
   Evaluate headroom, cropping, posture, background cleanliness, body position, distracting objects, and whether the image works for LinkedIn, business profiles, websites, social media, or branding.

5. Client service fit
   Use the job details to determine whether the portrait should feel corporate, personal branding, editorial, creative, formal, casual, group-based, or lifestyle-oriented.

6. Similar expression grouping
   Group images with similar pose, outfit, expression, angle, or background. Select the strongest image from each group and place weaker alternates into secondary review.

Sort into these folders:

* Best Headshots / Portrait Selects: sharp eyes, strong expression, flattering light, clean background, professional presentation
* Strong Alternates: good images that are usable but not the strongest from their set
* Needs Retouching: good images with minor skin, lighting, crop, color, or background issues
* Similar Expressions / Duplicate Review: repeated expressions, poses, or near-identical frames
* Rejects: closed eyes, missed focus, awkward expression, severe blur, poor lighting, bad framing, or non-flattering shots

Reason tags to use:

* Sharp eyes
* Soft eye focus
* Strong expression
* Closed eyes
* Awkward expression
* Flattering lighting
* Harsh lighting
* Clean background
* Distracting background
* Strong posture
* Crop issue
* Professional presentation
* Similar expression
* Best of pose group
* Needs retouching
* Not client-ready

For every similar group, identify the best image and explain why it is stronger than the alternatives.

Do not delete, publish, or notify the client automatically. All recommendations are staff-only until approved.`,

  event_documentary: `Evaluate each file for storytelling value, key moments, emotional impact, technical quality, and usefulness in documenting the event or experience.

Prioritize:

1. Key moments
   Identify important moments such as speeches, reactions, ceremonies, performances, group interactions, candid emotion, milestone moments, audience engagement, and meaningful details.

2. Storytelling value
   Prioritize files that help tell the full story of the event: wide establishing shots, medium interaction shots, close-up emotional shots, detail shots, and transition moments.

3. People and expressions
   Prioritize clear views of important people, natural emotion, good timing, open eyes, meaningful reactions, and flattering candid expressions.

4. Technical usability
   Evaluate focus, motion blur, exposure, noise, lighting, color, stability, and whether the image/video is salvageable in editing.

5. Coverage variety
   Select a balanced mix of wide shots, medium shots, close-ups, detail shots, crowd shots, speaker/host shots, and candid moments. Avoid selecting too many files that show the same moment unless they each add value.

6. Burst and sequence handling
   Group burst sequences, repeated frames, similar action shots, and repeated angles. Select the frame with the strongest timing, expression, clarity, and storytelling value.

Sort into these folders:

* Best Storytelling Moments: strongest images/clips that capture emotion, action, or key event moments
* Key People / Priority Moments: important people, speakers, hosts, honorees, clients, or requested shot-list moments
* Good Alternates: usable backup shots and secondary moments
* Similar Burst Shots: repeated frames from the same sequence that need staff comparison
* Needs Editing: good content with lighting, color, crop, or noise issues
* Rejects: missed focus, bad timing, severe blur, closed eyes, accidental shots, irrelevant images, or repeated weak frames

Reason tags to use:

* Key moment
* Strong emotion
* Clear storytelling
* Important person
* Good candid
* Strong timing
* Wide establishing shot
* Strong detail shot
* Similar burst
* Best of sequence
* Motion blur
* Poor timing
* Distracting background
* Needs noise reduction
* Usable alternate
* Not relevant
* Reject candidate

Favor meaningful moments over technical perfection when the emotional or documentary value is high, but still flag major technical issues.

Do not delete, publish, or notify the client automatically. All recommendations are staff-only until approved.`,

  real_estate_property: `Evaluate each image or video file for real estate, rental, commercial property, or listing-readiness. Prioritize files that clearly, accurately, and attractively represent the property.

Prioritize:

1. Listing-ready quality
   Images should be bright, clean, sharp, properly exposed, and useful for MLS, rental listings, websites, social media, or property marketing.

2. Room clarity
   Prioritize images that clearly show the room layout, size, flow, usable space, finishes, windows, lighting, and property features.

3. Composition and vertical alignment
   Flag crooked verticals, distorted lines, awkward angles, excessive ceiling/floor, poor framing, clutter, reflections, and distracting objects.

4. Coverage completeness
   Identify strongest exterior shots, room-by-room interior shots, detail shots, amenity shots, and unique property features.

5. Best angle per room
   Group similar room angles and select the strongest image for each room or area. Keep useful alternate angles in secondary review.

6. Edit potential
   Flag images that need exposure blending, window correction, color correction, straightening, crop, clutter removal, twilight edit, or retouching.

Sort into these folders:

* Listing-Ready Selects: strongest images suitable for final listing or marketing
* Room Alternates: good secondary angles or backup room images
* Exterior Selects: best outside, curb appeal, entrance, yard, street view, or amenity shots
* Detail / Feature Shots: finishes, fixtures, staging, amenities, views, appliances, or unique selling points
* Needs Editing: good images needing straightening, exposure correction, color correction, or cleanup
* Similar Room Angles: repeated room/property angles requiring staff comparison
* Rejects: crooked, cluttered, blurry, too dark, too bright, misleading, accidental, or unusable images

Reason tags to use:

* Listing ready
* Strong room clarity
* Good exterior
* Strong feature shot
* Straight verticals
* Crooked verticals
* Bright exposure
* Underexposed interior
* Blown window
* Needs straightening
* Needs color correction
* Clutter visible
* Best room angle
* Duplicate room angle
* Weak composition
* Not listing-ready
* Reject candidate

Favor accurate and marketable representation over overly artistic shots. Do not select misleading images that make the property look inaccurate.

Do not delete, publish, or notify the client automatically. All recommendations are staff-only until approved.`,

  product_photography: `Evaluate each image for product clarity, commercial usefulness, brand presentation, and readiness for websites, ecommerce, catalogs, marketing, or social media.

Prioritize:

1. Product sharpness
   The product should be in focus, clear, and visually understandable. Detail shots should clearly show important features, materials, textures, labels, or functionality.

2. Clean presentation
   Evaluate background cleanliness, reflections, shadows, dust, fingerprints, distracting props, color accuracy, and whether the product is shown professionally.

3. Angle and coverage
   Identify hero shots, front/back/side views, detail shots, lifestyle shots, scale shots, packaging shots, and product variation shots.

4. Commercial usability
   Determine whether the image is suitable for ecommerce, website product pages, social media, ads, lookbooks, catalogs, or brand campaigns.

5. Consistency
   Group similar product angles and select the strongest version. Maintain consistency across product sets when possible.

6. Editing needs
   Flag background removal, color correction, retouching, shadow cleanup, reflection cleanup, crop adjustment, or image alignment needs.

Sort into these folders:

* Hero Product Selects: strongest primary product images
* Detail Shots: close-ups of features, texture, labels, materials, or important product details
* Lifestyle Selects: product-in-use, styled, contextual, or brand-oriented shots
* Product Variations: required variations, colors, SKUs, packaging, or alternate views
* Similar Product Angles: repeated angles or near-duplicates
* Needs Retouching: good images needing cleanup, background work, color correction, or crop
* Rejects: blurry, poor lighting, bad reflections, distracting background, inaccurate color, incomplete product view, or irrelevant images

Reason tags to use:

* Sharp product
* Strong hero shot
* Good detail shot
* Lifestyle usable
* Accurate color
* Color issue
* Clean background
* Background distraction
* Reflection issue
* Needs background removal
* Needs retouching
* Complete product view
* Cropped product
* Similar angle
* Best of product group
* Marketplace-ready
* Not product-ready

If every product variation is required by the client, do not reject variations solely because they are repetitive. Instead, group them under Product Variations or Similar Product Angles for staff review.

Do not delete, publish, or notify the client automatically. All recommendations are staff-only until approved.`,

  brand_commercial: `Evaluate each file for brand alignment, campaign usefulness, marketing value, professional polish, and readiness for websites, social media, advertising, or business content.

Prioritize:

1. Brand alignment
   Determine whether the file matches the client’s brand, industry, tone, audience, color direction, visual style, and project goals.

2. Marketing usefulness
   Prioritize files that could be used for website hero sections, about pages, service pages, social media posts, ads, banners, thumbnails, profile images, email campaigns, or business presentations.

3. Composition and negative space
   Identify strong compositions with clean framing, clear subject, useful negative space for text overlays, horizontal/vertical crop flexibility, and minimal distractions.

4. Professional polish
   Evaluate lighting, sharpness, styling, expression, product/business presentation, environmental cleanliness, and overall production value.

5. Content variety
   Select a useful mix of hero images, detail shots, people/team shots, workspace shots, product/service shots, vertical social assets, horizontal website assets, and campaign-style visuals.

6. Similarity grouping
   Group similar poses, scenes, setups, product angles, or brand moments and select the strongest image from each group.

Sort into these folders:

* Campaign Selects: strongest marketing-ready images
* Website Hero Options: wide, clean, high-impact images with space for text or strong website use
* Social Media Selects: vertical, square, engaging, or platform-friendly images
* Brand Detail Shots: supporting textures, workspace, tools, products, environment, or behind-the-scenes details
* Good Alternates: usable backup images
* Needs Editing: good images needing color, crop, retouching, or cleanup
* Rejects: off-brand, blurry, cluttered, weak, irrelevant, or unusable images

Reason tags to use:

* Strong brand fit
* Campaign-ready
* Website hero potential
* Social media ready
* Good negative space
* Professional polish
* Strong composition
* Clear subject
* Brand detail
* Off-brand
* Distracting background
* Needs cleanup
* Similar setup
* Best of campaign group
* Good alternate
* Not marketing-ready

Prioritize files that can help the client sell, explain, promote, or elevate their brand.

Do not delete, publish, or notify the client automatically. All recommendations are staff-only until approved.`,

  video_production: `Evaluate video clips, thumbnails, still frames, audio-linked media, and production assets for edit usefulness, technical quality, story value, and alignment with the requested deliverable.

Prioritize:

1. Technical quality
   Evaluate sharpness, exposure, color, stability, frame rate consistency, resolution, noise, compression artifacts, and whether the clip appears usable in an edit.

2. Stability and motion
   Prioritize stable, intentional camera movement. Flag shaky, accidental, unusable, poorly framed, or overly chaotic footage unless it has clear documentary value.

3. Subject and scene relevance
   Determine whether the clip supports the requested video deliverable, such as promo video, event recap, social reel, testimonial, property video, product video, behind-the-scenes, or brand film.

4. Audio usefulness
   If audio is available or relevant, flag whether the clip appears to include clear speaking, important sound, background noise, unusable audio, or possible sync issues.

5. B-roll and storytelling value
   Identify strong b-roll, establishing shots, detail shots, action shots, reaction shots, transitions, cutaways, and key story moments.

6. Similar clip grouping
   Group similar clips, repeated takes, alternate angles, repeated b-roll, and near-identical footage. Recommend strongest clips for the edit.

Sort into these folders:

* Best Clips: strongest footage likely to be used in the final edit
* Strong B-Roll: useful supporting visuals, cutaways, details, motion shots, and transitions
* Key Moments / Story Clips: important moments, interviews, performances, actions, or client-requested shots
* Usable Alternates: backup takes or secondary angles
* Needs Review: uncertain clips, audio concerns, unstable but potentially useful footage
* Reject / Unusable: shaky, blurry, irrelevant, accidental, corrupted, poor exposure, or unusable footage
* Similar Takes: repeated takes or alternate versions requiring editor comparison

Reason tags to use:

* Strong clip
* Strong b-roll
* Key moment
* Good framing
* Stable footage
* Shaky footage
* Good exposure
* Poor exposure
* Useful cutaway
* Audio likely useful
* Audio concern
* Repeated take
* Best of similar clips
* Needs editor review
* Not relevant
* Reject candidate

Favor footage that helps tell the requested story, supports the client’s deliverable, and gives the editor useful coverage.

Do not delete, publish, or notify the client automatically. All recommendations are staff-only until approved.`,

  website_strategy: `Evaluate uploaded project files, screenshots, documents, brand assets, website references, dashboard examples, workflow materials, and client-provided media for relevance to Strategy & Systems work.

Use this prompt for services such as Website Development, Business Analysis, Workflow Optimization, Dashboard & Reporting Strategy, client portal work, automation planning, content gathering, or general consulting projects.

Prioritize:

1. Project relevance
   Determine whether the file directly supports the requested project scope, business challenge, website build, workflow audit, dashboard/reporting work, or strategic planning.

2. Content usefulness
   Identify assets that can be used for website content, copywriting, branding, UI design, business analysis, dashboards, process documentation, reporting, or implementation.

3. Clarity and completeness
   Evaluate whether documents are readable, screenshots are clear, reports are complete, references are understandable, and files contain enough useful information.

4. Asset category
   Classify files as brand assets, website content, screenshots, reports, workflow/process documents, reference examples, client uploads, source materials, or unclear/unrelated files.

5. Duplicate and version handling
   Group duplicate documents, repeated screenshots, multiple versions, outdated files, or similar reference materials. Recommend the clearest or most recent version when possible.

6. Actionability
   Identify whether the file is ready to use, needs clarification, should be reviewed by staff, or should be requested again from the client.

Sort into these folders:

* Priority Project Assets: files directly needed for the project
* Brand Assets: logos, colors, fonts, brand guides, imagery, tone references
* Website Content: copy, images, page content, service details, testimonials, bios, offers
* Dashboard / Reporting Assets: reports, spreadsheets, KPI lists, dashboards, data exports, screenshots
* Workflow / Process Materials: SOPs, diagrams, forms, intake processes, approval flows, automations
* Reference Materials: inspiration links, competitor examples, design references, screenshots
* Needs Clarification: incomplete, unclear, outdated, low-quality, or ambiguous files
* Not Relevant / Archive Review: unrelated, duplicate, old, or unusable files

Reason tags to use:

* Priority asset
* Brand asset
* Website content
* Dashboard reference
* Workflow material
* Useful screenshot
* Clear document
* Needs clarification
* Missing context
* Possible duplicate
* Outdated version
* Strong reference
* Not relevant
* Low quality upload
* Manual review needed

Prioritize usefulness for project execution over visual quality alone. A plain screenshot or document may be highly valuable if it explains the client’s business need.

Do not delete, publish, or notify the client automatically. All recommendations are staff-only until approved.`,

  general: `Evaluate each media file for overall professional quality, client relevance, technical usability, and deliverable potential. This prompt should be used when the project type is broad, mixed, or does not clearly fit one specialized service category.

Analyze the media using the following criteria:

1. Technical quality
   Evaluate sharpness, focus, exposure, color balance, resolution, noise, motion blur, stability, and overall clarity. Flag files that are blurry, underexposed, overexposed, corrupted, too low-resolution, or technically weak.

2. Composition and presentation
   Evaluate framing, balance, subject placement, background distractions, crop potential, visual cleanliness, and whether the media looks polished enough for professional use.

3. Subject relevance
   Determine whether the file appears relevant to the client’s requested service, project scope, intake answers, deliverables, brand, event, product, property, or creative direction.

4. Deliverable readiness
   Identify whether the file is ready for editing, ready for internal review, likely usable as a final deliverable, or only useful as a reference/supporting asset.

5. Similarity and duplicates
   Group exact duplicates, near-duplicates, similar angles, burst sequences, repeated frames, or files that appear to show the same subject with only minor differences. Select the strongest version from each group and place similar alternates into secondary review.

Sort files into these recommended folders:

* Best / Priority Selects: strongest, cleanest, most relevant, most client-ready files
* Usable / Secondary: decent alternates, backup options, salvageable files, similar but weaker options
* Needs Editing: files that are strong enough to save but require crop, retouching, exposure correction, color correction, stabilization, or cleanup
* Similar / Duplicate Review: near-duplicates or repeated files that require staff comparison
* Reject / Consider Deleting: weak, irrelevant, blurry, corrupted, accidental, unusable, or non-client-ready files
* Manual Review Needed: files where the AI is uncertain or where staff judgment is required

For each file, return:

* Suggested folder
* Overall score from 0–100
* Technical quality score
* Composition score
* Service fit score
* Deliverable readiness score
* Duplicate/similarity status
* Reason tags
* A short explanation for the recommendation

Do not delete, publish, or notify the client automatically. All recommendations are staff-only until a staff member approves them.`,
};

export const REASON_TAG_OPTIONS = [
  'Sharp focus',
  'Soft focus',
  'Motion blur',
  'Good exposure',
  'Underexposed',
  'Overexposed',
  'Strong composition',
  'Cropping issue',
  'Distracting background',
  'Strong expression',
  'Closed eyes',
  'Awkward expression',
  'Duplicate candidate',
  'Exact duplicate',
  'Similar sequence',
  'Best of similar group',
  'Good alternate',
  'Does not match shot list',
  'Good for social media crop',
  'Good for website hero',
  'Good for gallery',
  'Needs editing',
  'Not client-ready',
  'Low resolution',
  'Unsupported format',
  'Manual review needed',
  'Auto-sorted without AI',
  'AI-reviewed',
] as const;
