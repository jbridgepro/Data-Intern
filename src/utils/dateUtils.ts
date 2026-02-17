/**
 * File: src/utils/dateUtils.ts
 * 
 * Shared date formatting utilities supporting custom patterns.
 */

/**
 * Formats a date object using a pattern string with the following tokens:
 * - YYYY: Full year (e.g., 2026)
 * - YY: Short year (e.g., 26)
 * - MM: Month (01-12)
 * - DD: Day of month (01-31)
 * - HH: Hours (00-23)
 * - mm: Minutes (00-59)
 * - ss: Seconds (00-59)
 * - timestamp: Unix timestamp (milliseconds)
 * 
 * @param pattern - The format pattern string or a preset format name
 * @param date - The date object to format (defaults to now)
 * @returns Formatted date string
 */
export const formatDate = (pattern: string, date: Date = new Date()): string => {
    if (pattern === 'timestamp') {
        return String(date.getTime());
    }

    const yearFull = date.getFullYear();
    const yearShort = String(yearFull).slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    // Handle presets for backward compatibility or convenience
    const presets: Record<string, string> = {
        'YYYY-MM-DD': 'YYYY-MM-DD',
        'YYYYMMDD': 'YYYYMMDD',
        'YY-MM-DD': 'YY-MM-DD',
        'YYMMDD': 'YYMMDD',
        'DD-MM-YYYY': 'DD-MM-YYYY',
        'MM-DD-YYYY': 'MM-DD-YYYY',
        'MM-DD-YY': 'MM-DD-YY',
        'MMDDYY': 'MMDDYY',
        'YYYY-MM-DD_HH-MM-SS': 'YYYY-MM-DD_HH-MM-SS',
        'YYYYMMDD_HHMMSS': 'YYYYMMDD_HHMMSS',
        'YYMMDD_HHMMSS': 'YYMMDD_HHMMSS',
        'HH-MM-SS': 'HH-MM-SS',
        'HHMMSS': 'HHMMSS',
    };

    const actualPattern = presets[pattern] || pattern;

    return actualPattern
        .replace(/YYYY/g, String(yearFull))
        .replace(/YY/g, yearShort)
        .replace(/MM/g, month)
        .replace(/DD/g, day)
        .replace(/HH/g, hours)
        .replace(/mm/g, minutes)
        .replace(/ss/g, seconds);
};
