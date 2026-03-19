export type BusinessColumnFilterState = Record<string, string>;

function getBusinessColumnFilterParamName(key: string): string {
  return `bf_${key}`;
}

export function readBusinessColumnFilters(
  searchParams: Record<string, string | string[] | undefined> | undefined,
  keys: string[]
): BusinessColumnFilterState {
  const filters: BusinessColumnFilterState = {};
  if (!searchParams) return filters;

  for (const key of keys) {
    const rawValue = searchParams[getBusinessColumnFilterParamName(key)];
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) {
      filters[key] = trimmed;
    }
  }

  return filters;
}

export function readBusinessColumnFiltersFromUrlSearchParams(searchParams: URLSearchParams, keys: string[]): BusinessColumnFilterState {
  const filters: BusinessColumnFilterState = {};

  for (const key of keys) {
    const value = searchParams.get(getBusinessColumnFilterParamName(key))?.trim();
    if (value) {
      filters[key] = value;
    }
  }

  return filters;
}

export function writeBusinessColumnFiltersToUrlSearchParams(params: URLSearchParams, filters: BusinessColumnFilterState, keys: string[]) {
  for (const key of keys) {
    const value = String(filters[key] ?? "").trim();
    const paramName = getBusinessColumnFilterParamName(key);
    if (value) {
      params.set(paramName, value);
    } else {
      params.delete(paramName);
    }
  }
}

export function applyBusinessColumnFilters<T extends { values: Record<string, string> }>(rows: T[], filters: BusinessColumnFilterState) {
  const activeEntries = Object.entries(filters).filter(([, value]) => String(value).trim());
  if (activeEntries.length === 0) return rows;

  return rows.filter((row) =>
    activeEntries.every(([key, value]) => String(row.values[key] ?? "").toLowerCase().includes(String(value).trim().toLowerCase()))
  );
}
