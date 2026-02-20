"use client";

import { useCallback, useEffect, useState } from "react";

type SavedView = {
  id: string;
  module: string;
  name: string;
  filters_json: Record<string, unknown>;
  is_default: boolean;
};

export function useSavedViews<TFilters extends Record<string, unknown>>(params: {
  module: "contacts" | "investors" | "deals" | "activities";
  currentFilters: TFilters;
  onApply: (filters: TFilters) => void;
}) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [loading, setLoading] = useState(false);

  const loadViews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/saved-views?module=${encodeURIComponent(params.module)}`);
      const payload = (await res.json().catch(() => null)) as { rows?: SavedView[] } | null;
      if (!res.ok) throw new Error("No se pudieron cargar vistas");
      setViews(payload?.rows ?? []);
    } catch {
      setViews([]);
    } finally {
      setLoading(false);
    }
  }, [params.module]);

  useEffect(() => {
    loadViews();
  }, [loadViews]);

  const saveCurrent = useCallback(
    async (name: string) => {
      const safe = name.trim();
      if (!safe) return;
      await fetch("/api/saved-views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module: params.module,
          name: safe,
          filters: params.currentFilters
        })
      });
      await loadViews();
    },
    [loadViews, params.currentFilters, params.module]
  );

  const applyView = useCallback(
    (id: string) => {
      const view = views.find((v) => v.id === id);
      if (!view) return;
      params.onApply(view.filters_json as TFilters);
    },
    [params, views]
  );

  const deleteView = useCallback(
    async (id: string) => {
      await fetch(`/api/saved-views?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      await loadViews();
    },
    [loadViews]
  );

  return { views, loading, saveCurrent, applyView, deleteView, reload: loadViews };
}
