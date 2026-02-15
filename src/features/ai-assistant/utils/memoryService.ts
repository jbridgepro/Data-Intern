/**
 * File: src/features/ai-assistant/utils/memoryService.ts
 *
 * Persistent memory service for the AI Assistant.
 * Stores conversation history and important context across sessions.
 */

const STORAGE_KEY = 'ai-assistant-memory';
const MAX_ENTRIES = 1000;
const DEFAULT_RETENTION_DAYS = 30;

/**
 * Memory entry structure for stored context.
 */
export interface MemoryEntry {
    id: string;
    content: string;
    role: 'user' | 'assistant';
    timestamp: number;
    topics: string[];
    importance: number; // 0-1
    sessionId: string;
    embedding?: number[];
}

/**
 * Memory service configuration.
 */
export interface MemoryConfig {
    enabled: boolean;
    retentionDays: number;
    maxEntries: number;
    enableSemanticSearch: boolean;
}

const DEFAULT_CONFIG: MemoryConfig = {
    enabled: true,
    retentionDays: DEFAULT_RETENTION_DAYS,
    maxEntries: MAX_ENTRIES,
    enableSemanticSearch: true,
};

/**
 * MemoryService handles persistent storage and retrieval of conversation context.
 */
export class MemoryService {
    private entries: MemoryEntry[] = [];
    private config: MemoryConfig;
    private sessionId: string;
    private isDirty = false;

    constructor(config?: Partial<MemoryConfig>) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.sessionId = this.generateSessionId();
        this.load();
    }

    /**
     * Generates a unique session ID.
     */
    private generateSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    /**
     * Gets the current session ID.
     */
    getSessionId(): string {
        return this.sessionId;
    }

    /**
     * Adds a memory entry.
     */
    add(entry: Omit<MemoryEntry, 'id' | 'timestamp' | 'sessionId'>): MemoryEntry {
        const newEntry: MemoryEntry = {
            ...entry,
            id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            timestamp: Date.now(),
            sessionId: this.sessionId,
        };

        this.entries.push(newEntry);
        this.isDirty = true;

        // Auto-prune if needed
        if (this.entries.length > this.config.maxEntries) {
            this.prune();
        }

        // Auto-save
        this.save();

        return newEntry;
    }

    /**
     * Adds a conversation message to memory with automatic importance scoring.
     */
    addMessage(
        content: string,
        role: 'user' | 'assistant',
        options?: { topics?: string[]; importance?: number }
    ): MemoryEntry {
        const importance = options?.importance ?? this.calculateImportance(content, role);
        const topics = options?.topics ?? this.extractTopics(content);

        return this.add({
            content,
            role,
            topics,
            importance,
        });
    }

    /**
     * Calculates importance score based on content characteristics.
     */
    private calculateImportance(content: string, role: 'user' | 'assistant'): number {
        let score = 0.3; // Base score

        // Longer messages often contain more important info
        if (content.length > 200) score += 0.1;
        if (content.length > 500) score += 0.1;

        // Questions are often important context
        if (content.includes('?')) score += 0.1;

        // Commands/actions
        if (/\b(create|delete|move|copy|rename|organize)\b/i.test(content)) score += 0.15;

        // Technical terms
        if (/\b(file|folder|directory|path|error|success)\b/i.test(content)) score += 0.1;

        // Confirmations
        if (/\b(yes|no|confirm|cancel|proceed)\b/i.test(content)) score += 0.1;

        // Assistant responses with code or paths
        if (role === 'assistant' && /`[^`]+`/.test(content)) score += 0.1;

        return Math.min(1, score);
    }

    /**
     * Extracts topic keywords from content.
     */
    private extractTopics(content: string): string[] {
        const topics: Set<string> = new Set();

        // Extract common topic patterns
        const patterns = [
            /\b(file|folder|directory)\b/gi,
            /\b(create|delete|move|copy|rename|organize|find)\b/gi,
            /\b(error|success|failed|completed)\b/gi,
            /\b(image|video|audio|document|pdf|text)\b/gi,
        ];

        for (const pattern of patterns) {
            const matches = content.match(pattern);
            if (matches) {
                matches.forEach((m) => topics.add(m.toLowerCase()));
            }
        }

        // Extract potential file extensions
        const extensions = content.match(/\.\w{2,4}\b/g);
        if (extensions) {
            extensions.forEach((ext) => topics.add(ext));
        }

        return Array.from(topics).slice(0, 10);
    }

    /**
     * Searches memory for relevant entries.
     */
    search(query: string, options?: { limit?: number; minImportance?: number }): MemoryEntry[] {
        const limit = options?.limit ?? 10;
        const minImportance = options?.minImportance ?? 0.3;

        // Simple keyword matching for now
        const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);

        return this.entries
            .filter((entry) => entry.importance >= minImportance)
            .map((entry) => {
                const contentLower = entry.content.toLowerCase();
                let relevance = 0;

                for (const word of queryWords) {
                    if (contentLower.includes(word)) relevance += 1;
                }

                // Topic match bonus
                for (const topic of entry.topics) {
                    if (queryWords.some((w) => topic.includes(w))) relevance += 0.5;
                }

                return { entry, relevance };
            })
            .filter((item) => item.relevance > 0)
            .sort((a, b) => b.relevance - a.relevance)
            .slice(0, limit)
            .map((item) => item.entry);
    }

    /**
     * Gets recent entries from memory.
     */
    getRecent(limit = 20): MemoryEntry[] {
        return this.entries.slice(-limit);
    }

    /**
     * Gets entries from the current session.
     */
    getCurrentSession(): MemoryEntry[] {
        return this.entries.filter((e) => e.sessionId === this.sessionId);
    }

    /**
     * Gets all entries.
     */
    getAll(): MemoryEntry[] {
        return [...this.entries];
    }

    /**
     * Prunes old entries based on retention policy.
     */
    prune(): number {
        const cutoffTime = Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000;
        const originalLength = this.entries.length;

        // Remove old entries with low importance
        this.entries = this.entries.filter((entry) => {
            if (entry.timestamp > cutoffTime) return true;
            // Keep high-importance entries longer
            if (entry.importance > 0.7) return true;
            return false;
        });

        // If still over limit, remove by importance
        if (this.entries.length > this.config.maxEntries) {
            this.entries.sort((a, b) => {
                // Prioritize recent and important
                const aScore = a.importance + (a.timestamp / Date.now());
                const bScore = b.importance + (b.timestamp / Date.now());
                return bScore - aScore;
            });
            this.entries = this.entries.slice(0, this.config.maxEntries);
        }

        const pruned = originalLength - this.entries.length;
        if (pruned > 0) {
            this.isDirty = true;
            this.save();
        }

        return pruned;
    }

    /**
     * Clears all memory entries.
     */
    clear(): void {
        this.entries = [];
        this.isDirty = true;
        this.save();
        console.log('[MemoryService] Memory cleared');
    }

    /**
     * Saves memory to localStorage.
     */
    save(): void {
        if (!this.config.enabled) return;

        try {
            const data = {
                version: 1,
                entries: this.entries,
                lastSaved: Date.now(),
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            this.isDirty = false;
        } catch (error) {
            console.error('[MemoryService] Failed to save:', error);
        }
    }

    /**
     * Loads memory from localStorage.
     */
    load(): void {
        if (!this.config.enabled) return;

        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const data = JSON.parse(stored);
                if (data.entries && Array.isArray(data.entries)) {
                    this.entries = data.entries;
                    console.log(`[MemoryService] Loaded ${this.entries.length} entries`);
                }
            }
        } catch (error) {
            console.error('[MemoryService] Failed to load:', error);
            this.entries = [];
        }
    }

    /**
     * Exports memory to JSON string.
     */
    export(): string {
        return JSON.stringify({
            version: 1,
            exportedAt: new Date().toISOString(),
            entries: this.entries,
        }, null, 2);
    }

    /**
     * Imports memory from JSON string.
     */
    import(jsonString: string): number {
        try {
            const data = JSON.parse(jsonString);
            if (data.entries && Array.isArray(data.entries)) {
                const imported = data.entries.length;
                this.entries.push(...data.entries);
                this.prune();
                this.save();
                return imported;
            }
            return 0;
        } catch (error) {
            console.error('[MemoryService] Import failed:', error);
            return 0;
        }
    }

    /**
     * Gets memory statistics.
     */
    getStats(): {
        totalEntries: number;
        sessionEntries: number;
        oldestEntry: number | null;
        newestEntry: number | null;
    } {
        return {
            totalEntries: this.entries.length,
            sessionEntries: this.getCurrentSession().length,
            oldestEntry: this.entries.length > 0 ? this.entries[0].timestamp : null,
            newestEntry: this.entries.length > 0 ? this.entries[this.entries.length - 1].timestamp : null,
        };
    }

    /**
     * Updates configuration.
     */
    updateConfig(newConfig: Partial<MemoryConfig>): void {
        this.config = { ...this.config, ...newConfig };
        if (newConfig.enabled === false) {
            this.clear();
        }
    }
}

// Singleton instance
let memoryServiceInstance: MemoryService | null = null;

/**
 * Gets the memory service singleton.
 */
export function getMemoryService(config?: Partial<MemoryConfig>): MemoryService {
    if (!memoryServiceInstance) {
        memoryServiceInstance = new MemoryService(config);
    }
    return memoryServiceInstance;
}

/**
 * Resets the memory service singleton (for testing).
 */
export function resetMemoryService(): void {
    memoryServiceInstance = null;
}
