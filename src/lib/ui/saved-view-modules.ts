export type SavedViewModule = "contacts" | "investors" | "business";

const MODULE_ALIASES: Record<string, SavedViewModule> = {
  contacts: "contacts",
  investors: "investors",
  business: "business",
  deals: "business"
};

export function normalizeSavedViewModule(value: string | null | undefined): SavedViewModule | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  return MODULE_ALIASES[normalized] ?? null;
}

export const SAVED_VIEW_MODULES: SavedViewModule[] = ["contacts", "investors", "business"];
