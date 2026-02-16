/**
 * Min-heap implementation for efficient top-K tracking
 * Maintains only the K largest items, discarding smaller ones
 * Space complexity: O(K) instead of O(N)
 * Time complexity: O(log K) per insertion instead of O(N log N) for full sort
 */
export class TopKHeap<T> {
  private heap: Array<{ item: T; score: number }> = [];
  private k: number;
  private scoreFunc: (item: T) => number;

  /**
   * Creates a new TopKHeap
   * @param k Maximum number of items to track
   * @param scoreFunc Function to extract numeric score from items (higher scores are "better")
   */
  constructor(k: number, scoreFunc: (item: T) => number) {
    if (k <= 0) {
      throw new Error('K must be greater than 0');
    }
    this.k = k;
    this.scoreFunc = scoreFunc;
  }

  /**
   * Adds an item to the heap
   * If heap is full and item has lower score than minimum, it's discarded
   * If heap is full and item has higher score, minimum is evicted
   */
  add(item: T): void {
    const score = this.scoreFunc(item);

    if (this.heap.length < this.k) {
      // Heap not full, add item and heapify up
      this.heap.push({ item, score });
      this.heapifyUp(this.heap.length - 1);
    } else if (score > this.heap[0].score) {
      // Item has higher score than minimum, replace minimum
      this.heap[0] = { item, score };
      this.heapifyDown(0);
    }
    // Else: item score is too low, discard it
  }

  /**
   * Gets the top K items sorted by score (highest first)
   * @returns Array of items in descending score order
   */
  getTop(): T[] {
    return [...this.heap]
      .sort((a, b) => b.score - a.score)
      .map(h => h.item);
  }

  /**
   * Gets the top K items with their scores
   * @returns Array of {item, score} objects in descending score order
   */
  getTopWithScores(): Array<{ item: T; score: number }> {
    return [...this.heap].sort((a, b) => b.score - a.score);
  }

  /**
   * Gets the current number of items in the heap
   */
  size(): number {
    return this.heap.length;
  }

  /**
   * Checks if the heap is full
   */
  isFull(): boolean {
    return this.heap.length >= this.k;
  }

  /**
   * Gets the minimum score in the heap (if full, items below this are rejected)
   */
  getMinScore(): number | null {
    return this.heap.length > 0 ? this.heap[0].score : null;
  }

  /**
   * Clears all items from the heap
   */
  clear(): void {
    this.heap = [];
  }

  /**
   * Maintains min-heap property by moving element up
   * @private
   */
  private heapifyUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);

      if (this.heap[index].score >= this.heap[parentIndex].score) {
        break;
      }

      // Swap with parent
      [this.heap[index], this.heap[parentIndex]] = [this.heap[parentIndex], this.heap[index]];
      index = parentIndex;
    }
  }

  /**
   * Maintains min-heap property by moving element down
   * @private
   */
  private heapifyDown(index: number): void {
    while (true) {
      let smallest = index;
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;

      if (
        leftChild < this.heap.length &&
        this.heap[leftChild].score < this.heap[smallest].score
      ) {
        smallest = leftChild;
      }

      if (
        rightChild < this.heap.length &&
        this.heap[rightChild].score < this.heap[smallest].score
      ) {
        smallest = rightChild;
      }

      if (smallest === index) {
        break;
      }

      // Swap with smallest child
      [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
      index = smallest;
    }
  }
}
