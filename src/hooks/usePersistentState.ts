
import { useState, useEffect, useCallback } from 'react';

/**
 * A hook that manages state which persists to localStorage.
 * 
 * @param key The key to use in localStorage
 * @param initialValue The initial value if no value exists in storage
 * @returns [value, setValue, resetValue] - The current value, a setter, and a resetter
 */
export function usePersistentState<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void, () => void] {
    // Initialize state from localStorage or initialValue
    const [state, setState] = useState<T>(() => {
        try {
            const item = window.localStorage.getItem(key);
            console.log(`[usePersistentState] Reading key "${key}":`, item);
            if (item) {
                return JSON.parse(item);
            }
        } catch (error) {
            console.warn(`Error reading localStorage key "${key}":`, error);
        }
        console.log(`[usePersistentState] Using initial value for "${key}":`, initialValue);
        return initialValue;
    });

    // Update localStorage when state changes
    useEffect(() => {
        try {
            if (state === undefined) {
                console.log(`[usePersistentState] Removing key "${key}"`);
                window.localStorage.removeItem(key);
            } else {
                console.log(`[usePersistentState] Writing key "${key}":`, state);
                window.localStorage.setItem(key, JSON.stringify(state));
            }
        } catch (error) {
            console.warn(`Error setting localStorage key "${key}":`, error);
        }
    }, [key, state]);

    // Wrapper for setState that handles function updates correctly if we were exposing raw setState,
    // but since we are just using the returned setter from useState, it already handles function updates.
    // We just return it directly.

    const resetState = useCallback(() => {
        setState(initialValue);
        try {
            // We can remove it or set it to initial. Removing allows future defaults to change.
            // But strict compliance with "reset to default" usually means "set to initialValue".
            // Let's remove it to be cleaner, relying on the initializer to pick up initialValue next time?
            // No, if we remove it, the *current* state is still effectively initialValue (set above).
            // But if we mount again, it picks up initialValue.
            // If we set it to initialValue explicitly in storage, it persists that value.
            window.localStorage.removeItem(key);
        } catch (error) {
            console.error(error);
        }
    }, [initialValue, key]);

    return [state, setState, resetState];
}
