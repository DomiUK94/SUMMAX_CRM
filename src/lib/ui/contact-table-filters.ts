export const CONTACT_COLUMN_FILTER_KEYS = [
  "id",
  "full_name",
  "investor_name",
  "is_financier",
  "is_prescriber",
  "owner_email",
  "owner_user_id",
  "email",
  "phone",
  "role",
  "other_contact",
  "linkedin",
  "comments",
  "updated_at",
  "days_without_action",
  "follow_up_status"
] as const;

export type ContactColumnKey = (typeof CONTACT_COLUMN_FILTER_KEYS)[number];
export type ContactColumnFilterState = Partial<Record<ContactColumnKey, string>>;

export function getContactColumnFilterParamName(key: ContactColumnKey): string {
  return `cf_${key}`;
}

export function readContactColumnFilters(
  searchParams?: Record<string, string | string[] | undefined>
): ContactColumnFilterState {
  const filters: ContactColumnFilterState = {};
  if (!searchParams) return filters;

  for (const key of CONTACT_COLUMN_FILTER_KEYS) {
    const rawValue = searchParams[getContactColumnFilterParamName(key)];
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) {
      filters[key] = trimmed;
    }
  }

  return filters;
}

export function readContactColumnFiltersFromUrlSearchParams(searchParams: URLSearchParams): ContactColumnFilterState {
  const filters: ContactColumnFilterState = {};

  for (const key of CONTACT_COLUMN_FILTER_KEYS) {
    const value = searchParams.get(getContactColumnFilterParamName(key))?.trim();
    if (value) {
      filters[key] = value;
    }
  }

  return filters;
}

export function writeContactColumnFiltersToUrlSearchParams(params: URLSearchParams, filters: ContactColumnFilterState) {
  for (const key of CONTACT_COLUMN_FILTER_KEYS) {
    const value = String(filters[key] ?? "").trim();
    const paramName = getContactColumnFilterParamName(key);
    if (value) {
      params.set(paramName, value);
    } else {
      params.delete(paramName);
    }
  }
}
