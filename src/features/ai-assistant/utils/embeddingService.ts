/**
 * File: src/features/ai-assistant/utils/embeddingService.ts
 *
 * Lightweight embedding service for semantic search.
 * Uses TF-IDF vectors with cosine similarity for browser-based similarity search.
 * No external API required.
 */

/**
 * Document with embedding for similarity search.
 */
export interface EmbeddedDocument {
    id: string;
    content: string;
    embedding: number[];
    metadata?: Record<string, any>;
}

/**
 * Search result with similarity score.
 */
export interface SimilarityResult {
    document: EmbeddedDocument;
    similarity: number;
}

/**
 * TF-IDF based embedding service for semantic search.
 */
export class EmbeddingService {
    private vocabulary: Map<string, number> = new Map();
    private idf: Map<string, number> = new Map();
    private documents: EmbeddedDocument[] = [];
    private vocabSize = 0;

    /**
     * Tokenizes text into words.
     */
    private tokenize(text: string): string[] {
        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter((word) => word.length > 2 && !this.isStopWord(word));
    }

    /**
     * Checks if a word is a stop word.
     */
    private isStopWord(word: string): boolean {
        const stopWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
            'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
            'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
            'this', 'that', 'these', 'those', 'it', 'its', 'they', 'them',
            'their', 'we', 'us', 'our', 'you', 'your', 'he', 'she', 'him',
            'her', 'his', 'hers', 'i', 'me', 'my', 'mine', 'what', 'which',
            'who', 'whom', 'when', 'where', 'why', 'how', 'all', 'each',
            'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such',
            'only', 'same', 'so', 'than', 'too', 'very', 'just', 'also',
        ]);
        return stopWords.has(word);
    }

    /**
     * Calculates term frequency for a document.
     */
    private calculateTF(tokens: string[]): Map<string, number> {
        const tf = new Map<string, number>();
        for (const token of tokens) {
            tf.set(token, (tf.get(token) || 0) + 1);
        }
        // Normalize by document length
        const maxFreq = Math.max(...tf.values());
        for (const [token, freq] of tf) {
            tf.set(token, freq / maxFreq);
        }
        return tf;
    }

    /**
     * Builds the vocabulary and IDF from a corpus.
     */
    buildIndex(documents: Array<{ id: string; content: string; metadata?: Record<string, any> }>): void {
        // Reset
        this.vocabulary.clear();
        this.idf.clear();
        this.documents = [];

        // Build vocabulary and document frequency
        const docFreq = new Map<string, number>();
        const allTokens: string[][] = [];

        for (const doc of documents) {
            const tokens = this.tokenize(doc.content);
            allTokens.push(tokens);
            const uniqueTokens = new Set(tokens);

            for (const token of uniqueTokens) {
                docFreq.set(token, (docFreq.get(token) || 0) + 1);
                if (!this.vocabulary.has(token)) {
                    this.vocabulary.set(token, this.vocabSize++);
                }
            }
        }

        // Calculate IDF
        const N = documents.length;
        for (const [token, df] of docFreq) {
            this.idf.set(token, Math.log((N + 1) / (df + 1)) + 1);
        }

        // Generate embeddings
        for (let i = 0; i < documents.length; i++) {
            const embedding = this.generateEmbedding(allTokens[i]);
            this.documents.push({
                id: documents[i].id,
                content: documents[i].content,
                embedding,
                metadata: documents[i].metadata,
            });
        }

        console.log(`[EmbeddingService] Built index with ${this.documents.length} documents, vocab size: ${this.vocabSize}`);
    }

    /**
     * Generates a TF-IDF embedding for tokens.
     */
    private generateEmbedding(tokens: string[]): number[] {
        const embedding = new Array(this.vocabSize).fill(0);
        const tf = this.calculateTF(tokens);

        for (const [token, tfValue] of tf) {
            const idx = this.vocabulary.get(token);
            if (idx !== undefined) {
                const idfValue = this.idf.get(token) || 1;
                embedding[idx] = tfValue * idfValue;
            }
        }

        // Normalize to unit vector
        const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
        if (magnitude > 0) {
            for (let i = 0; i < embedding.length; i++) {
                embedding[i] /= magnitude;
            }
        }

        return embedding;
    }

    /**
     * Embeds a query string.
     */
    embed(text: string): number[] {
        const tokens = this.tokenize(text);
        return this.generateEmbedding(tokens);
    }

    /**
     * Calculates cosine similarity between two vectors.
     */
    private cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) return 0;

        let dotProduct = 0;
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
        }
        return dotProduct; // Vectors are already normalized
    }

    /**
     * Finds documents similar to a query.
     */
    findSimilar(query: string, options?: { limit?: number; minSimilarity?: number }): SimilarityResult[] {
        const limit = options?.limit ?? 10;
        const minSimilarity = options?.minSimilarity ?? 0.1;

        const queryEmbedding = this.embed(query);

        return this.documents
            .map((doc) => ({
                document: doc,
                similarity: this.cosineSimilarity(queryEmbedding, doc.embedding),
            }))
            .filter((result) => result.similarity >= minSimilarity)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit);
    }

    /**
     * Adds a document to the index incrementally.
     */
    addDocument(id: string, content: string, metadata?: Record<string, any>): void {
        const tokens = this.tokenize(content);

        // Update vocabulary
        for (const token of new Set(tokens)) {
            if (!this.vocabulary.has(token)) {
                this.vocabulary.set(token, this.vocabSize++);
            }
        }

        // Update IDF (simplified incremental update)
        const N = this.documents.length + 1;
        for (const token of new Set(tokens)) {
            const currentIdf = this.idf.get(token);
            if (currentIdf) {
                // Approximate update
                this.idf.set(token, Math.log((N + 1) / ((N / Math.exp(currentIdf - 1)) + 2)) + 1);
            } else {
                this.idf.set(token, Math.log((N + 1) / 2) + 1);
            }
        }

        // Generate embedding
        const embedding = this.generateEmbedding(tokens);

        this.documents.push({
            id,
            content,
            embedding,
            metadata,
        });
    }

    /**
     * Removes a document from the index.
     */
    removeDocument(id: string): boolean {
        const index = this.documents.findIndex((d) => d.id === id);
        if (index !== -1) {
            this.documents.splice(index, 1);
            return true;
        }
        return false;
    }

    /**
     * Gets the number of indexed documents.
     */
    getDocumentCount(): number {
        return this.documents.length;
    }

    /**
     * Gets vocabulary size.
     */
    getVocabularySize(): number {
        return this.vocabSize;
    }

    /**
     * Clears the index.
     */
    clear(): void {
        this.vocabulary.clear();
        this.idf.clear();
        this.documents = [];
        this.vocabSize = 0;
    }
}

// Singleton instance
let embeddingServiceInstance: EmbeddingService | null = null;

/**
 * Gets the embedding service singleton.
 */
export function getEmbeddingService(): EmbeddingService {
    if (!embeddingServiceInstance) {
        embeddingServiceInstance = new EmbeddingService();
    }
    return embeddingServiceInstance;
}

/**
 * Resets the embedding service singleton (for testing).
 */
export function resetEmbeddingService(): void {
    embeddingServiceInstance = null;
}
