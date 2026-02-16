/**
 * Cancellation token system for aborting long-running operations
 * Provides a way to signal and check for cancellation requests
 */

export class CancellationToken {
  private cancelled = false;
  private callbacks: Array<() => void> = [];

  /**
   * Returns true if cancellation has been requested
   */
  isCancelled(): boolean {
    return this.cancelled;
  }

  /**
   * Throws an error if cancellation has been requested
   * Use this to check cancellation at critical points in your operation
   */
  throwIfCancelled(): void {
    if (this.cancelled) {
      throw new CancellationError('Operation was cancelled');
    }
  }

  /**
   * Internal method to mark the token as cancelled
   * Should only be called by CancellationTokenSource
   * @internal
   */
  cancel(): void {
    if (!this.cancelled) {
      this.cancelled = true;
      // Notify all registered callbacks
      this.callbacks.forEach(callback => callback());
      this.callbacks = [];
    }
  }

  /**
   * Registers a callback to be called when cancellation is requested
   * @param callback Function to call on cancellation
   * @returns Disposer function to unregister the callback
   */
  onCancelled(callback: () => void): () => void {
    if (this.cancelled) {
      // Already cancelled, call immediately
      callback();
      return () => {};
    }

    this.callbacks.push(callback);

    // Return disposer function
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index >= 0) {
        this.callbacks.splice(index, 1);
      }
    };
  }
}

/**
 * Source for creating and managing cancellation tokens
 * Create one of these at the start of an operation and pass the token to async functions
 */
export class CancellationTokenSource {
  readonly token: CancellationToken;
  private _cancelled = false;

  constructor() {
    this.token = new CancellationToken();
  }

  /**
   * Requests cancellation
   * This will trigger all registered callbacks and cause throwIfCancelled() to throw
   */
  cancel(): void {
    if (!this._cancelled) {
      this._cancelled = true;
      this.token.cancel();
    }
  }

  /**
   * Returns true if cancellation has been requested
   */
  isCancelled(): boolean {
    return this._cancelled;
  }

  /**
   * Disposes the cancellation token source
   * After disposal, the token should not be used
   */
  dispose(): void {
    this.cancel();
  }
}

/**
 * Custom error thrown when an operation is cancelled
 */
export class CancellationError extends Error {
  constructor(message = 'Operation was cancelled') {
    super(message);
    this.name = 'CancellationError';
  }
}

/**
 * Helper to check if an error is a cancellation error
 */
export function isCancellationError(error: any): error is CancellationError {
  return error instanceof CancellationError || error?.name === 'CancellationError';
}

/**
 * Helper function to run an async operation with cancellation support
 * @param operation The async operation to execute
 * @param token Cancellation token to check
 * @returns Promise that resolves to the operation result or rejects on cancellation
 */
export async function withCancellation<T>(
  operation: (token: CancellationToken) => Promise<T>,
  token: CancellationToken
): Promise<T> {
  token.throwIfCancelled();
  return await operation(token);
}
