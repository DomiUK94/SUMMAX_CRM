"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

export function usePersistedState<T>(storageKey: string, initialValue: T): [T, Dispatch<SetStateAction<T>>, boolean] {
  const [value, setValue] = useState<T>(initialValue);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw != null) {
        setValue(JSON.parse(raw) as T);
      }
    } catch {
      // Ignore invalid persisted state.
    } finally {
      setHydrated(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // Ignore storage write errors.
    }
  }, [storageKey, value, hydrated]);

  return [value, setValue, hydrated];
}
