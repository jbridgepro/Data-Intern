/**
 * Queue-based directory traversal utilities
 * Prevents stack overflow by using iteration instead of recursion
 * Safer for deeply nested directory structures
 */

/**
 * Interface for traversal callbacks
 */
export interface TraversalCallbacks<T> {
  /**
   * Called when entering a directory
   * @returns Array of children to process, or null/undefined to skip
   */
  onDirectory?: (item: T) => Promise<T[]> | T[];

  /**
   * Called for each item (file or directory)
   * @returns true to continue, false to stop traversal
   */
  onItem?: (item: T) => Promise<boolean | void> | boolean | void;

  /**
   * Called when an error occurs
   * @returns true to continue, false to stop traversal
   */
  onError?: (error: Error, item: T) => boolean;

  /**
   * Maximum number of items to process (safety limit)
   * Defaults to 1,000,000
   */
  maxItems?: number;
}

/**
 * Traverses a tree structure using a queue (breadth-first)
 * This avoids stack overflow issues with deep recursion
 *
 * @param root The root item to start traversal from
 * @param isDirectory Function to check if an item is a directory
 * @param callbacks Callbacks for handling items during traversal
 * @returns Array of all visited items
 */
export async function queueTraversal<T>(
  root: T,
  isDirectory: (item: T) => boolean,
  callbacks: TraversalCallbacks<T>
): Promise<T[]> {
  const queue: T[] = [root];
  const visited: T[] = [];
  const maxItems = callbacks.maxItems || 1_000_000;

  while (queue.length > 0) {
    // Safety check: prevent infinite loops or excessive memory usage
    if (visited.length >= maxItems) {
      console.warn(`Queue traversal hit safety limit of ${maxItems} items`);
      break;
    }

    const current = queue.shift()!;
    visited.push(current);

    try {
      // Call onItem callback
      if (callbacks.onItem) {
        const shouldContinue = await callbacks.onItem(current);
        if (shouldContinue === false) {
          break; // Stop traversal
        }
      }

      // If it's a directory, get children and add to queue
      if (isDirectory(current) && callbacks.onDirectory) {
        const children = await callbacks.onDirectory(current);
        if (children && children.length > 0) {
          queue.push(...children);
        }
      }
    } catch (error) {
      const shouldContinue = callbacks.onError
        ? callbacks.onError(error as Error, current)
        : false;

      if (!shouldContinue) {
        break; // Stop on error if callback returns false
      }
    }
  }

  return visited;
}

/**
 * Depth-first queue traversal (iterative, not recursive)
 * Processes children of each directory before moving to siblings
 *
 * @param root The root item to start traversal from
 * @param isDirectory Function to check if an item is a directory
 * @param callbacks Callbacks for handling items during traversal
 * @returns Array of all visited items
 */
export async function depthFirstQueueTraversal<T>(
  root: T,
  isDirectory: (item: T) => boolean,
  callbacks: TraversalCallbacks<T>
): Promise<T[]> {
  const stack: T[] = [root];
  const visited: T[] = [];
  const maxItems = callbacks.maxItems || 1_000_000;

  while (stack.length > 0) {
    // Safety check
    if (visited.length >= maxItems) {
      console.warn(`Depth-first traversal hit safety limit of ${maxItems} items`);
      break;
    }

    const current = stack.pop()!;
    visited.push(current);

    try {
      // Call onItem callback
      if (callbacks.onItem) {
        const shouldContinue = await callbacks.onItem(current);
        if (shouldContinue === false) {
          break;
        }
      }

      // If it's a directory, get children and add to stack (reverse order for correct traversal)
      if (isDirectory(current) && callbacks.onDirectory) {
        const children = await callbacks.onDirectory(current);
        if (children && children.length > 0) {
          // Add in reverse order so first child is processed first
          for (let i = children.length - 1; i >= 0; i--) {
            stack.push(children[i]);
          }
        }
      }
    } catch (error) {
      const shouldContinue = callbacks.onError
        ? callbacks.onError(error as Error, current)
        : false;

      if (!shouldContinue) {
        break;
      }
    }
  }

  return visited;
}

/**
 * Counts total items in a tree without recursion
 *
 * @param root The root item
 * @param isDirectory Function to check if an item is a directory
 * @param getChildren Function to get children of a directory
 * @param maxItems Safety limit (default: 1M)
 * @returns Total count of items
 */
export async function countItemsIteratively<T>(
  root: T,
  isDirectory: (item: T) => boolean,
  getChildren: (item: T) => Promise<T[]> | T[],
  maxItems = 1_000_000
): Promise<number> {
  const items = await queueTraversal(root, isDirectory, {
    onDirectory: getChildren,
    maxItems,
  });
  return items.length;
}

/**
 * Finds an item in a tree structure without recursion
 *
 * @param root The root item
 * @param predicate Function to test each item
 * @param isDirectory Function to check if an item is a directory
 * @param getChildren Function to get children of a directory
 * @returns The found item or null
 */
export async function findItemIteratively<T>(
  root: T,
  predicate: (item: T) => boolean,
  isDirectory: (item: T) => boolean,
  getChildren: (item: T) => Promise<T[]> | T[]
): Promise<T | null> {
  let foundItem: T | null = null;

  await queueTraversal(root, isDirectory, {
    onDirectory: getChildren,
    onItem: async (item) => {
      if (predicate(item)) {
        foundItem = item;
        return false; // Stop traversal
      }
      return true; // Continue
    },
  });

  return foundItem;
}
