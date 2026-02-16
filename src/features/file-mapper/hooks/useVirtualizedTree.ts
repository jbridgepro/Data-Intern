/**
 * Custom hook for virtualizing tree views
 * Flattens hierarchical tree data into a flat list suitable for virtual scrolling
 */

import { useMemo } from 'react';
import { FileSystemNode } from '../utils/fileSystemScanner';

export interface FlatNode {
  node: FileSystemNode;
  depth: number;
  index: number;
  hasChildren: boolean;
  isExpanded: boolean;
}

/**
 * Flattens a tree structure into a list of visible nodes
 * Only includes nodes that should be visible based on expansion state
 *
 * @param root The root node of the tree
 * @param expandedPaths Set of paths that are currently expanded
 * @returns Flat array of visible nodes with depth information
 */
export function flattenVisibleNodes(
  root: FileSystemNode,
  expandedPaths: Set<string>
): FlatNode[] {
  const result: FlatNode[] = [];
  let globalIndex = 0;

  const traverse = (node: FileSystemNode, depth: number) => {
    const hasChildren = node.isDirectory && node.children && node.children.length > 0;
    const isExpanded = expandedPaths.has(node.path);

    result.push({
      node,
      depth,
      index: globalIndex++,
      hasChildren: hasChildren || false,
      isExpanded,
    });

    // Only traverse children if node is expanded
    if (isExpanded && hasChildren && node.children) {
      for (const child of node.children) {
        traverse(child, depth + 1);
      }
    }
  };

  traverse(root, 0);
  return result;
}

/**
 * Hook to manage flattened tree state for virtualization
 *
 * @param data The root node of the tree
 * @param expandedPaths Set of expanded node paths
 * @returns Memoized flat array of visible nodes
 */
export function useVirtualizedTree(
  data: FileSystemNode | null,
  expandedPaths: Set<string>
): FlatNode[] {
  return useMemo(() => {
    if (!data) return [];
    return flattenVisibleNodes(data, expandedPaths);
  }, [data, expandedPaths]);
}

/**
 * Helper to get all paths in a tree (useful for "expand all" functionality)
 *
 * @param root The root node
 * @returns Set of all directory paths in the tree
 */
export function getAllPaths(root: FileSystemNode): Set<string> {
  const paths = new Set<string>();

  const traverse = (node: FileSystemNode) => {
    if (node.isDirectory) {
      paths.add(node.path);
      if (node.children) {
        node.children.forEach(traverse);
      }
    }
  };

  traverse(root);
  return paths;
}

/**
 * Helper to find a node by path in a flat list
 *
 * @param flatNodes The flattened node list
 * @param path The path to search for
 * @returns The FlatNode if found, undefined otherwise
 */
export function findNodeByPath(
  flatNodes: FlatNode[],
  path: string
): FlatNode | undefined {
  return flatNodes.find((fn) => fn.node.path === path);
}

/**
 * Helper to get the index of a node by path
 *
 * @param flatNodes The flattened node list
 * @param path The path to search for
 * @returns The index if found, -1 otherwise
 */
export function getNodeIndex(flatNodes: FlatNode[], path: string): number {
  return flatNodes.findIndex((fn) => fn.node.path === path);
}
