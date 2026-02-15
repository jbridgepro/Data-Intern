/**
 * File: src/features/ai-assistant/utils/directoryCache.ts
 * 
 * Caching layer for directory analysis results.
 * Improves performance by avoiding redundant directory scans.
 * 
 * Key features:
 * - TTL-based expiration (configurable)
 * - Content-hash based invalidation (optional)
 * - LRU eviction when cache is full
 * - Manual invalidation support
 * - Cache statistics tracking
 */

import type { DirectoryAnalysis } from '../types';

/**
 * Cache entry with metadata for TTL and invalidation.
 */
export interface CacheEntry {
  /** The cached directory analysis result */
  analysis: DirectoryAnalysis;
  /** Timestamp when the entry was created */
  timestamp: number;
  /** Hash of directory contents for invalidation (optional) */
  contentHash?: string;
  /** Number of times this entry has been accessed */
  accessCount: number;
  /** Last access timestamp */
  lastAccess: number;
  /** Size of the cached data in bytes (approximate) */
  size: number;
}

/**
 * Cache configuration options.
 */
export interface CacheConfig {
  /** Enable/disable caching (default: true) */
  enabled: boolean;
  /** Time-to-live in seconds (default: 300 = 5 minutes) */
  ttlSeconds: number;
  /** Maximum number of entries to cache (default: 50) */
  maxEntries: number;
  /** Maximum total cache size in bytes (default: 10MB) */
  maxSizeBytes: number;
  /** Use content hashing for smarter invalidation (default: false, more expensive) */
  useContentHash: boolean;
  /** Auto-invalidate on file system changes (requires watcher) */
  autoInvalidate: boolean;
}

/**
 * Default cache configuration.
 */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  enabled: true,
  ttlSeconds: 300, // 5 minutes
  maxEntries: 50,
  maxSizeBytes: 10 * 1024 * 1024, // 10MB
  useContentHash: false,
  autoInvalidate: false,
};

/**
 * Cache statistics for monitoring.
 */
export interface CacheStats {
  /** Total number of cache hits */
  hits: number;
  /** Total number of cache misses */
  misses: number;
  /** Current number of cached entries */
  entries: number;
  /** Current total size in bytes */
  totalSize: number;
  /** Hit rate percentage */
  hitRate: number;
  /** Number of evictions due to TTL */
  ttlEvictions: number;
  /** Number of evictions due to size/count limits */
  lruEvictions: number;
  /** Oldest entry age in seconds */
  oldestEntryAge: number;
}

/**
 * DirectoryCache manages caching of directory analysis results.
 */
export class DirectoryCache {
  private cache: Map<string, CacheEntry> = new Map();
  private config: CacheConfig;
  private stats: CacheStats;

  constructor(config?: Partial<CacheConfig>) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.stats = {
      hits: 0,
      misses: 0,
      entries: 0,
      totalSize: 0,
      hitRate: 0,
      ttlEvictions: 0,
      lruEvictions: 0,
      oldestEntryAge: 0,
    };
  }

  /**
   * Updates cache configuration.
   * @param newConfig - Partial configuration to update
   */
  updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // If cache is disabled, clear it
    if (!this.config.enabled) {
      this.clear();
    }
  }

  /**
   * Gets the current configuration.
   * @returns Current cache configuration
   */
  getConfig(): CacheConfig {
    return { ...this.config };
  }

  /**
   * Normalizes a path for use as a cache key.
   * Ensures consistent key format across platforms.
   * @param path - Directory path
   * @returns Normalized path string
   */
  private normalizeKey(path: string): string {
    // Remove trailing slashes and normalize
    return path.replace(/\/+$/, '').toLowerCase();
  }

  /**
   * Estimates the size of an analysis object in bytes.
   * @param analysis - Directory analysis to measure
   * @returns Approximate size in bytes
   */
  private estimateSize(analysis: DirectoryAnalysis): number {
    // Rough estimation based on JSON string length
    try {
      return JSON.stringify(analysis).length * 2; // UTF-16 chars = 2 bytes
    } catch {
      return 1024; // Default estimate if stringify fails
    }
  }

  /**
   * Checks if a cache entry is still valid (not expired).
   * @param entry - Cache entry to check
   * @returns True if entry is still valid
   */
  private isValid(entry: CacheEntry): boolean {
    const now = Date.now();
    const ageMs = now - entry.timestamp;
    const ttlMs = this.config.ttlSeconds * 1000;
    return ageMs < ttlMs;
  }

  /**
   * Evicts expired entries from the cache.
   * Called automatically on get/set operations.
   */
  private evictExpired(): void {
    const now = Date.now();
    const ttlMs = this.config.ttlSeconds * 1000;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp >= ttlMs) {
        this.stats.totalSize -= entry.size;
        this.cache.delete(key);
        this.stats.ttlEvictions++;
      }
    }
    
    this.stats.entries = this.cache.size;
  }

  /**
   * Evicts least recently used entries until within limits.
   * Uses LRU (Least Recently Used) strategy.
   */
  private evictLRU(): void {
    // Check if we need to evict based on count
    while (this.cache.size > this.config.maxEntries) {
      this.evictOldest();
    }
    
    // Check if we need to evict based on size
    while (this.stats.totalSize > this.config.maxSizeBytes && this.cache.size > 0) {
      this.evictOldest();
    }
  }

  /**
   * Evicts the least recently accessed entry.
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestAccess = Infinity;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccess < oldestAccess) {
        oldestAccess = entry.lastAccess;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      const entry = this.cache.get(oldestKey);
      if (entry) {
        this.stats.totalSize -= entry.size;
      }
      this.cache.delete(oldestKey);
      this.stats.lruEvictions++;
      this.stats.entries = this.cache.size;
    }
  }

  /**
   * Gets a cached directory analysis if available and valid.
   * @param path - Directory path to look up
   * @param contentHash - Optional content hash for validation
   * @returns Cached analysis or null if not found/expired
   */
  get(path: string, contentHash?: string): DirectoryAnalysis | null {
    if (!this.config.enabled) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // Clean up expired entries periodically
    this.evictExpired();

    const key = this.normalizeKey(path);
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // Check TTL validity
    if (!this.isValid(entry)) {
      this.cache.delete(key);
      this.stats.totalSize -= entry.size;
      this.stats.entries = this.cache.size;
      this.stats.misses++;
      this.stats.ttlEvictions++;
      this.updateHitRate();
      return null;
    }

    // Check content hash if provided and configured
    if (this.config.useContentHash && contentHash && entry.contentHash) {
      if (entry.contentHash !== contentHash) {
        this.cache.delete(key);
        this.stats.totalSize -= entry.size;
        this.stats.entries = this.cache.size;
        this.stats.misses++;
        this.updateHitRate();
        return null;
      }
    }

    // Update access stats
    entry.accessCount++;
    entry.lastAccess = Date.now();

    this.stats.hits++;
    this.updateHitRate();

    console.log(`[DirectoryCache] Cache HIT for: ${path} (age: ${Math.round((Date.now() - entry.timestamp) / 1000)}s)`);
    
    return entry.analysis;
  }

  /**
   * Stores a directory analysis in the cache.
   * @param path - Directory path
   * @param analysis - Analysis result to cache
   * @param contentHash - Optional content hash for future validation
   */
  set(path: string, analysis: DirectoryAnalysis, contentHash?: string): void {
    if (!this.config.enabled) {
      return;
    }

    const key = this.normalizeKey(path);
    const size = this.estimateSize(analysis);
    const now = Date.now();

    // Check if updating existing entry
    const existingEntry = this.cache.get(key);
    if (existingEntry) {
      this.stats.totalSize -= existingEntry.size;
    }

    const entry: CacheEntry = {
      analysis,
      timestamp: now,
      contentHash,
      accessCount: 1,
      lastAccess: now,
      size,
    };

    this.cache.set(key, entry);
    this.stats.totalSize += size;
    this.stats.entries = this.cache.size;

    // Evict if necessary
    this.evictLRU();

    console.log(`[DirectoryCache] Cached analysis for: ${path} (size: ${Math.round(size / 1024)}KB, entries: ${this.cache.size})`);
  }

  /**
   * Invalidates a specific cache entry.
   * @param path - Directory path to invalidate
   * @returns True if entry was found and removed
   */
  invalidate(path: string): boolean {
    const key = this.normalizeKey(path);
    const entry = this.cache.get(key);
    
    if (entry) {
      this.stats.totalSize -= entry.size;
      this.cache.delete(key);
      this.stats.entries = this.cache.size;
      console.log(`[DirectoryCache] Invalidated: ${path}`);
      return true;
    }
    
    return false;
  }

  /**
   * Invalidates all entries that match a path prefix.
   * Useful when a parent directory changes.
   * @param pathPrefix - Path prefix to match
   * @returns Number of entries invalidated
   */
  invalidatePrefix(pathPrefix: string): number {
    const normalizedPrefix = this.normalizeKey(pathPrefix);
    let count = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (key.startsWith(normalizedPrefix)) {
        this.stats.totalSize -= entry.size;
        this.cache.delete(key);
        count++;
      }
    }
    
    this.stats.entries = this.cache.size;
    
    if (count > 0) {
      console.log(`[DirectoryCache] Invalidated ${count} entries matching prefix: ${pathPrefix}`);
    }
    
    return count;
  }

  /**
   * Clears all cached entries.
   */
  clear(): void {
    this.cache.clear();
    this.stats.entries = 0;
    this.stats.totalSize = 0;
    console.log('[DirectoryCache] Cache cleared');
  }

  /**
   * Updates the hit rate statistic.
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  /**
   * Gets current cache statistics.
   * @returns Cache statistics object
   */
  getStats(): CacheStats {
    // Calculate oldest entry age
    let oldestTimestamp = Date.now();
    for (const entry of this.cache.values()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
      }
    }
    
    this.stats.oldestEntryAge = this.cache.size > 0 
      ? Math.round((Date.now() - oldestTimestamp) / 1000)
      : 0;
    
    return { ...this.stats };
  }

  /**
   * Resets cache statistics (but keeps cached data).
   */
  resetStats(): void {
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.stats.hitRate = 0;
    this.stats.ttlEvictions = 0;
    this.stats.lruEvictions = 0;
  }

  /**
   * Checks if a path is cached.
   * @param path - Directory path to check
   * @returns True if path is in cache (may still be expired)
   */
  has(path: string): boolean {
    const key = this.normalizeKey(path);
    const entry = this.cache.get(key);
    return entry !== undefined && this.isValid(entry);
  }

  /**
   * Gets all cached paths.
   * @returns Array of cached directory paths
   */
  getCachedPaths(): string[] {
    const paths: string[] = [];
    for (const [key, entry] of this.cache.entries()) {
      if (this.isValid(entry)) {
        paths.push(key);
      }
    }
    return paths;
  }

  /**
   * Gets cache entry metadata without the analysis data.
   * @param path - Directory path
   * @returns Entry metadata or null
   */
  getEntryInfo(path: string): Omit<CacheEntry, 'analysis'> | null {
    const key = this.normalizeKey(path);
    const entry = this.cache.get(key);
    
    if (!entry || !this.isValid(entry)) {
      return null;
    }
    
    return {
      timestamp: entry.timestamp,
      contentHash: entry.contentHash,
      accessCount: entry.accessCount,
      lastAccess: entry.lastAccess,
      size: entry.size,
    };
  }

  /**
   * Preloads analysis into cache.
   * Useful for warming up cache with known directories.
   * @param entries - Array of path/analysis pairs to cache
   */
  preload(entries: Array<{ path: string; analysis: DirectoryAnalysis }>): void {
    for (const { path, analysis } of entries) {
      this.set(path, analysis);
    }
    console.log(`[DirectoryCache] Preloaded ${entries.length} entries`);
  }

  /**
   * Exports cache data for persistence.
   * @returns Serializable cache data
   */
  export(): Array<{ path: string; entry: CacheEntry }> {
    const data: Array<{ path: string; entry: CacheEntry }> = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (this.isValid(entry)) {
        data.push({ path: key, entry });
      }
    }
    
    return data;
  }

  /**
   * Imports cache data from persistence.
   * Only imports entries that haven't expired.
   * @param data - Previously exported cache data
   */
  import(data: Array<{ path: string; entry: CacheEntry }>): void {
    const now = Date.now();
    const ttlMs = this.config.ttlSeconds * 1000;
    let imported = 0;
    
    for (const { path, entry } of data) {
      // Only import if not expired
      if (now - entry.timestamp < ttlMs) {
        this.cache.set(path, entry);
        this.stats.totalSize += entry.size;
        imported++;
      }
    }
    
    this.stats.entries = this.cache.size;
    console.log(`[DirectoryCache] Imported ${imported}/${data.length} entries`);
  }
}

/**
 * Singleton instance with default configuration.
 * Can be reconfigured via updateConfig().
 */
export const directoryCache = new DirectoryCache();

/**
 * Factory function to create a cache with custom configuration.
 * @param config - Custom configuration
 * @returns New DirectoryCache instance
 */
export function createDirectoryCache(config?: Partial<CacheConfig>): DirectoryCache {
  return new DirectoryCache(config);
}
