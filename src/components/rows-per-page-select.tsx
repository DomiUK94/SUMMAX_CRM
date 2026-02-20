"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PER_PAGE_OPTIONS } from "@/lib/ui/pagination";
import { useEffect } from "react";

export function RowsPerPageSelect({ value, storageKey }: { value: number; storageKey?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!storageKey) return;
    const hasPerPageInUrl = Boolean(searchParams.get("per_page"));
    const stored = window.localStorage.getItem(storageKey);
    if (!hasPerPageInUrl && stored && PER_PAGE_OPTIONS.includes(Number(stored) as (typeof PER_PAGE_OPTIONS)[number])) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("per_page", stored);
      params.set("page", "1");
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [storageKey, searchParams, pathname, router]);

  return (
    <select
      value={String(value)}
      onChange={(event) => {
        if (storageKey) {
          window.localStorage.setItem(storageKey, event.target.value);
        }
        const params = new URLSearchParams(searchParams.toString());
        params.set("per_page", event.target.value);
        params.set("page", "1");
        router.replace(`${pathname}?${params.toString()}`);
      }}
    >
      {PER_PAGE_OPTIONS.map((option) => (
        <option key={option} value={String(option)}>
          {option}
        </option>
      ))}
    </select>
  );
}
