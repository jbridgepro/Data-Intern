/**
 * Semaphore for controlling concurrent operations
 * Prevents resource exhaustion by limiting the number of simultaneous operations
 */
export class Semaphore {
  private permits: number;
  private waiting: Array<() => void> = [];

  /**
   * Creates a new Semaphore
   * @param permits Maximum number of concurrent operations allowed
   */
  constructor(permits: number) {
    if (permits <= 0) {
      throw new Error('Semaphore permits must be greater than 0');
    }
    this.permits = permits;
  }

  /**
   * Acquires a permit, waiting if necessary
   * @returns A release function that must be called when the operation completes
   */
  async acquire(): Promise<() => void> {
    if (this.permits > 0) {
      this.permits--;
      return () => this.release();
    }

    // No permits available, wait for one
    return new Promise<() => void>((resolve) => {
      this.waiting.push(() => {
        this.permits--;
        resolve(() => this.release());
      });
    });
  }

  /**
   * Releases a permit back to the semaphore
   * @private
   */
  private release(): void {
    this.permits++;

    // Wake up next waiting operation if any
    const next = this.waiting.shift();
    if (next) {
      next();
    }
  }

  /**
   * Gets the current number of available permits
   */
  getAvailablePermits(): number {
    return this.permits;
  }

  /**
   * Gets the number of operations waiting for permits
   */
  getWaitingCount(): number {
    return this.waiting.length;
  }
}

/**
 * Helper function to run an async operation with concurrency control
 * @param semaphore The semaphore to use for concurrency control
 * @param operation The async operation to execute
 * @returns Promise that resolves to the operation result
 */
export async function withSemaphore<T>(
  semaphore: Semaphore,
  operation: () => Promise<T>
): Promise<T> {
  const release = await semaphore.acquire();
  try {
    return await operation();
  } finally {
    release();
  }
}
