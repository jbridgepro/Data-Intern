/**
 * File: src/utils/fileValidation.ts
 *
 * Shared validation utilities for file operations
 * Used by both file creation and folder creation features
 */

/**
 * Validates file name for invalid characters
 * @param fileName - The file name to validate (without extension)
 * @returns Error message if invalid, null if valid
 */
export const validateFileNameChars = (fileName: string): string | null => {
  if (!fileName.trim()) {
    return "File name cannot be empty";
  }

  // Check for invalid characters (OS-dependent, but common subset)
  const invalidChars = /[<>:"/\\|?*\x00-\x1F]/g;
  if (invalidChars.test(fileName)) {
    return "Contains invalid characters: < > : \" / \\ | ? *";
  }

  return null;
};

/**
 * Validates file extension format
 * @param ext - The extension to validate (with or without leading dot)
 * @returns Error message if invalid, null if valid
 */
export const validateExtension = (ext: string): string | null => {
  if (!ext) {
    return "Extension is required";
  }

  // Remove leading dot if present
  const clean = ext.replace(/^\./, '');

  // Extension should only contain letters and numbers
  if (!/^[a-zA-Z0-9]+$/.test(clean)) {
    return "Extension can only contain letters and numbers";
  }

  return null;
};

/**
 * Sanitizes file name by replacing invalid characters with underscores
 * @param fileName - The file name to sanitize
 * @returns Sanitized file name
 */
export const sanitizeFileName = (fileName: string): string => {
  return fileName.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
};

/**
 * Normalizes extension by removing leading dot
 * @param ext - The extension to normalize
 * @returns Normalized extension without leading dot
 */
export const normalizeExtension = (ext: string): string => {
  return ext.replace(/^\./, '').toLowerCase();
};
