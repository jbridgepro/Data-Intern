/**
 * File: src/contexts/FavoritesContext.tsx
 *
 * Frontend: Shared context for managing favorite pages/tools across
 * the Sidebar and individual page headers. Persists the ordered list
 * of favorite item IDs to localStorage so the user's selection and
 * custom ordering survive page reloads.
 */

import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { usePersistentState } from "@/hooks/usePersistentState";

// ─── Context value interface ───────────────────────────────────────
interface FavoritesContextValue {
  /** Ordered list of favorite nav-item IDs (user-defined order) */
  favoriteItemIds: string[];

  /** Replace the entire favorites list (used by drag-reorder) */
  setFavoriteItemIds: (ids: string[] | ((prev: string[]) => string[])) => void;

  /** Toggle a single item in or out of the favorites list */
  toggleFavorite: (itemId: string) => void;

  /** Check whether a given item ID is currently favorited */
  isFavorite: (itemId: string) => boolean;
}

// ─── Context creation ──────────────────────────────────────────────
const FavoritesContext = createContext<FavoritesContextValue | null>(null);

// ─── Provider component ────────────────────────────────────────────
interface FavoritesProviderProps {
  children: ReactNode;
}

export const FavoritesProvider = ({ children }: FavoritesProviderProps) => {
  // Persisted ordered list of favorite item IDs
  const [favoriteItemIds, setFavoriteItemIds] = usePersistentState<string[]>(
    "sidebar-favorite-items",
    [],
  );

  // Toggle an item in/out of the favorites list
  const toggleFavorite = useCallback(
    (itemId: string) => {
      setFavoriteItemIds((prev) => {
        if (prev.includes(itemId)) {
          // Remove from favorites
          return prev.filter((id) => id !== itemId);
        }
        // Append to end of the favorites list
        return [...prev, itemId];
      });
    },
    [setFavoriteItemIds],
  );

  // Fast membership check via a Set derived from the list
  const favoriteSet = useMemo(
    () => new Set(favoriteItemIds),
    [favoriteItemIds],
  );

  const isFavorite = useCallback(
    (itemId: string) => favoriteSet.has(itemId),
    [favoriteSet],
  );

  const contextValue = useMemo<FavoritesContextValue>(
    () => ({
      favoriteItemIds,
      setFavoriteItemIds,
      toggleFavorite,
      isFavorite,
    }),
    [favoriteItemIds, setFavoriteItemIds, toggleFavorite, isFavorite],
  );

  return (
    <FavoritesContext.Provider value={contextValue}>
      {children}
    </FavoritesContext.Provider>
  );
};

// ─── Consumer hook ─────────────────────────────────────────────────
/**
 * Access the shared favorites state from any component wrapped by
 * <FavoritesProvider>.
 */
export const useFavorites = (): FavoritesContextValue => {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error("useFavorites must be used within a <FavoritesProvider>");
  }
  return context;
};
