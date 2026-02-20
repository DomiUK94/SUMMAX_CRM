"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function QueryParamMemory({
  param,
  value,
  hasValue,
  storageKey
}: {
  param: string;
  value: string;
  hasValue: boolean;
  storageKey: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (hasValue) {
      window.localStorage.setItem(storageKey, value);
      return;
    }
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set(param, stored);
    params.set("page", "1");
    router.replace(`${pathname}?${params.toString()}`);
  }, [hasValue, value, storageKey, searchParams, param, router, pathname]);

  return null;
}
