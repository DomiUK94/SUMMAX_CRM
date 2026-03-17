"use client";

import { useEffect, useRef, useState } from "react";
import type { VisibilityState } from "@tanstack/react-table";
import type { SavedViewModule } from "@/lib/ui/saved-view-modules";
import { usePersistedState } from "@/lib/ui/use-persisted-state";

const COLUMN_PREFERENCE_NAME = "__columns__";

type SavedViewRow = {
  id: string;
  filters_json?: Record<string, unknown> | null;
};

function isVisibilityState(value: unknown): value is VisibilityState {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function useUserColumnVisibility(
  module: Extract<SavedViewModule, "contacts" | "investors" | "business">,
  storageKey: string,
  defaultValue: VisibilityState
) {
  const [columnVisibility, setColumnVisibility, hydrated] = usePersistedState<VisibilityState>(storageKey, defaultValue);
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);
  const remoteIdRef = useRef<string | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPreference() {
      try {
        const res = await fetch(
          `/api/saved-views?module=${encodeURIComponent(module)}&name=${encodeURIComponent(COLUMN_PREFERENCE_NAME)}`
        );
        const payload = (await res.json().catch(() => null)) as { rows?: SavedViewRow[] } | null;
        if (!res.ok || cancelled) return;
        const row = payload?.rows?.[0] ?? null;
        remoteIdRef.current = row?.id ?? null;
        const nextColumns = row?.filters_json?.columns;
        if (isVisibilityState(nextColumns)) {
          setColumnVisibility(nextColumns);
        }
      } finally {
        if (!cancelled) {
          loadedRef.current = true;
          setLoading(false);
        }
      }
    }

    void loadPreference();

    return () => {
      cancelled = true;
    };
  }, [module, setColumnVisibility]);

  useEffect(() => {
    if (!hydrated || !loadedRef.current) return;
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = window.setTimeout(() => {
      const payload = {
        module,
        name: COLUMN_PREFERENCE_NAME,
        filters: { columns: columnVisibility }
      };

      const request = remoteIdRef.current
        ? fetch("/api/saved-views", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: remoteIdRef.current, ...payload })
          })
        : fetch("/api/saved-views", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });

      void request
        .then(async (res) => {
          const body = (await res.json().catch(() => null)) as { row?: SavedViewRow } | null;
          if (!res.ok) return;
          if (body?.row?.id) remoteIdRef.current = body.row.id;
        })
        .catch(() => {
          // Ignore background sync errors and keep local persistence.
        });
    }, 350);

    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [columnVisibility, hydrated, module]);

  return { columnVisibility, setColumnVisibility, loading };
}
