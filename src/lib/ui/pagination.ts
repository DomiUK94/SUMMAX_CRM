export const PER_PAGE_OPTIONS = [25, 50, 75, 100] as const;

export function normalizePerPage(value: string | undefined): number {
  const parsed = Number(value ?? "25");
  if (parsed === 25 || parsed === 50 || parsed === 75 || parsed === 100) return parsed;
  return 25;
}
