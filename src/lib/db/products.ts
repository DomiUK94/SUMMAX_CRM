import { createDimServerClient } from "@/lib/supabase/dim";

export type ProductCode = "prestamo_participativo" | "franquicia";
export type ProductFamily = "loan" | "franchise";

export type ProductRecord = {
  id: string;
  code: ProductCode;
  name: string;
  product_family: ProductFamily;
  amount_min: number | null;
  amount_max: number | null;
  default_multiplier: number | null;
  requires_amount: boolean;
  requires_multiplier: boolean;
  requires_company_valuation: boolean;
  requires_country: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export function getProductFamilyLabel(value: ProductFamily): string {
  return value === "loan" ? "Préstamo" : "Franquicia";
}

export function formatCurrencyRange(min: number | null, max: number | null): string {
  if (min === null && max === null) return "--";
  const formatter = new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  });
  if (min !== null && max !== null) return `${formatter.format(min)} - ${formatter.format(max)}`;
  return formatter.format(min ?? max ?? 0);
}

export async function listProducts() {
  const db = createDimServerClient();
  const result = await db
    .from("product")
    .select(
      "id, code, name, product_family, amount_min, amount_max, default_multiplier, requires_amount, requires_multiplier, requires_company_valuation, requires_country, active, created_at, updated_at"
    )
    .order("name", { ascending: true });

  if (result.error) throw result.error;
  return (result.data ?? []) as ProductRecord[];
}
