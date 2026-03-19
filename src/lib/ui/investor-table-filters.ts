export const INVESTOR_COLUMN_FILTER_KEYS = [
  "id",
  "name",
  "category",
  "website",
  "strategy",
  "status_name",
  "sector",
  "updated_at"
] as const;

export type InvestorColumnKey = (typeof INVESTOR_COLUMN_FILTER_KEYS)[number];
export type InvestorColumnFilterState = Partial<Record<InvestorColumnKey, string>>;

export function getInvestorColumnFilterParamName(key: InvestorColumnKey): string {
  return `if_${key}`;
}

export function readInvestorColumnFilters(
  searchParams?: Record<string, string | string[] | undefined>
): InvestorColumnFilterState {
  const filters: InvestorColumnFilterState = {};
  if (!searchParams) return filters;

  for (const key of INVESTOR_COLUMN_FILTER_KEYS) {
    const rawValue = searchParams[getInvestorColumnFilterParamName(key)];
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) {
      filters[key] = trimmed;
    }
  }

  return filters;
}

export function readInvestorColumnFiltersFromUrlSearchParams(searchParams: URLSearchParams): InvestorColumnFilterState {
  const filters: InvestorColumnFilterState = {};

  for (const key of INVESTOR_COLUMN_FILTER_KEYS) {
    const value = searchParams.get(getInvestorColumnFilterParamName(key))?.trim();
    if (value) {
      filters[key] = value;
    }
  }

  return filters;
}

export function writeInvestorColumnFiltersToUrlSearchParams(params: URLSearchParams, filters: InvestorColumnFilterState) {
  for (const key of INVESTOR_COLUMN_FILTER_KEYS) {
    const value = String(filters[key] ?? "").trim();
    const paramName = getInvestorColumnFilterParamName(key);
    if (value) {
      params.set(paramName, value);
    } else {
      params.delete(paramName);
    }
  }
}
