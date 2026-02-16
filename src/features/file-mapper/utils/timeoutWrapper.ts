/**
 * Promise timeout utilities
 * Prevents operations from hanging indefinitely on slow or unresponsive file systems
 */

export class TimeoutError extends Error {
  constructor(message = 'Operation timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Wraps a promise with a timeout
 * If the promise doesn't resolve within the timeout period, it rejects with a TimeoutError
 *
 * @param promise The promise to wrap
 * @param timeoutMs Timeout in milliseconds
 * @param timeoutMessage Optional custom timeout error message
 * @returns Promise that resolves to the original promise value or rejects on timeout
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage?: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new TimeoutError(timeoutMessage || `Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

/**
 * Wraps an async function with a timeout
 * Useful for wrapping file system operations that might hang
 *
 * @param fn The async function to wrap
 * @param timeoutMs Timeout in milliseconds
 * @param timeoutMessage Optional custom timeout error message
 * @returns Wrapped function that times out if it takes too long
 */
export function createTimeoutWrapper<TArgs extends any[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  timeoutMs: number,
  timeoutMessage?: string
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs) => {
    return withTimeout(fn(...args), timeoutMs, timeoutMessage);
  };
}

/**
 * Checks if an error is a timeout error
 */
export function isTimeoutError(error: any): error is TimeoutError {
  return error instanceof TimeoutError || error?.name === 'TimeoutError';
}

/**
 * Creates a promise that resolves after a specified delay
 * Useful for testing or adding deliberate delays
 *
 * @param ms Delay in milliseconds
 * @returns Promise that resolves after the delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Races multiple promises and returns the first one to resolve
 * Unlike Promise.race, this only resolves with successful results
 * If all promises reject, returns the last rejection
 *
 * @param promises Array of promises to race
 * @returns Promise that resolves with the first successful result
 */
export async function raceToSuccess<T>(promises: Promise<T>[]): Promise<T> {
  if (promises.length === 0) {
    throw new Error('Cannot race empty array of promises');
  }

  return new Promise((resolve, reject) => {
    let rejectionCount = 0;
    let lastError: any;

    promises.forEach((promise) => {
      promise
        .then(resolve) // Resolve as soon as any promise succeeds
        .catch((error) => {
          rejectionCount++;
          lastError = error;

          // If all promises have rejected, reject with the last error
          if (rejectionCount === promises.length) {
            reject(lastError);
          }
        });
    });
  });
}

/**
 * Retries an async operation with exponential backoff
 *
 * @param fn The async function to retry
 * @param options Retry configuration
 * @returns Promise that resolves to the function result
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
    shouldRetry?: (error: any) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    backoffMultiplier = 2,
    shouldRetry = () => true,
  } = options;

  let lastError: any;
  let currentDelay = initialDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if this was the last attempt or if shouldRetry returns false
      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }

      // Wait before retrying
      await delay(currentDelay);

      // Increase delay for next attempt (exponential backoff)
      currentDelay = Math.min(currentDelay * backoffMultiplier, maxDelayMs);
    }
  }

  throw lastError;
}
