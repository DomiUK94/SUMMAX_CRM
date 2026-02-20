"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function ContactsSearchInput({ tab, initialValue }: { tab: string; initialValue: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tab);
      params.set("page", "1");
      if (value.trim()) {
        params.set("q", value.trim());
      } else {
        params.delete("q");
      }
      router.replace(`${pathname}?${params.toString()}`);
    }, 260);

    return () => clearTimeout(timer);
  }, [value, tab, pathname, router, searchParams]);

  return (
    <input
      className="contacts-search"
      placeholder="Buscar"
      value={value}
      onChange={(event) => setValue(event.target.value)}
    />
  );
}
