import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";
import { normalizeOptionalText, requireText } from "@/lib/validation/crm";

export type OpportunityResolution = "open" | "won" | "lost" | "cancelled";

export type OpportunityRecord = {
  id: string;
  lead_id: string;
  company_id: number;
  contact_id: number;
  product_id: string;
  current_state_id: string;
  name: string | null;
  owner_user_id: string | null;
  owner_email: string | null;
  created_by_user_id: string | null;
  created_by_email: string | null;
  opened_at: string;
  closed_at: string | null;
  resolution: OpportunityResolution;
  estimated_amount: number | null;
  closed_amount: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ListOpportunitiesPageParams = {
  page?: number;
  pageSize?: number;
  q?: string;
  stateId?: string;
  ownerUserId?: string;
  resolution?: OpportunityResolution;
  productId?: string;
  leadId?: string;
};

export type CreateOpportunityInput = {
  lead_id: string;
  company_id: number | string;
  contact_id: number | string;
  product_id: string;
  current_state_id: string;
  name?: string;
  owner_user_id?: string;
  owner_email?: string;
  created_by_user_id?: string;
  created_by_email?: string;
  opened_at?: string;
  estimated_amount?: number | string | null;
  closed_amount?: number | string | null;
  notes?: string;
};

export type UpdateOpportunityInput = {
  id: string;
  product_id?: string;
  name?: string;
  owner_user_id?: string | null;
  owner_email?: string | null;
  estimated_amount?: number | string | null;
  closed_amount?: number | string | null;
  notes?: string | null;
  resolution?: OpportunityResolution;
  closed_at?: string | null;
};

export type UpdateOpportunityStateInput = {
  opportunity_id: string;
  current_state_id: string;
  resolution?: OpportunityResolution;
  closed_at?: string | null;
};

function normalizePage(value: number | undefined) {
  if (!Number.isFinite(value) || (value ?? 0) < 1) return 1;
  return Math.trunc(value as number);
}

function normalizePageSize(value: number | undefined) {
  if (!Number.isFinite(value) || (value ?? 0) < 1) return 25;
  return Math.min(100, Math.trunc(value as number));
}

function normalizeBigint(value: number | string, label: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} no válido`);
  }
  return Math.trunc(parsed);
}

function normalizeMoney(value: number | string | null | undefined) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Importe no válido");
  }
  return parsed;
}

export async function listOpportunitiesPage(params: ListOpportunitiesPageParams = {}) {
  const db = createSourceCrmServerClient();
  const page = normalizePage(params.page);
  const pageSize = normalizePageSize(params.pageSize);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const q = String(params.q ?? "").trim();

  let query = db
    .from("opportunities")
    .select("id, lead_id, company_id, contact_id, product_id, current_state_id, name, owner_user_id, owner_email, created_by_user_id, created_by_email, opened_at, closed_at, resolution, estimated_amount, closed_amount, notes, created_at, updated_at", { count: "exact" })
    .order("updated_at", { ascending: false });

  if (params.stateId) {
    query = query.eq("current_state_id", params.stateId);
  }
  if (params.ownerUserId) {
    query = query.eq("owner_user_id", params.ownerUserId);
  }
  if (params.resolution) {
    query = query.eq("resolution", params.resolution);
  }
  if (params.productId) {
    query = query.eq("product_id", params.productId);
  }
  if (params.leadId) {
    query = query.eq("lead_id", params.leadId);
  }
  if (q) {
    const pattern = `%${q}%`;
    query = query.or(`name.ilike.${pattern},owner_email.ilike.${pattern},notes.ilike.${pattern}`);
  }

  const result = await query.range(from, to);
  if (result.error) throw result.error;

  return {
    rows: (result.data ?? []) as OpportunityRecord[],
    totalCount: result.count ?? 0
  };
}

export async function getOpportunityById(id: string) {
  const db = createSourceCrmServerClient();
  const result = await db
    .from("opportunities")
    .select("id, lead_id, company_id, contact_id, product_id, current_state_id, name, owner_user_id, owner_email, created_by_user_id, created_by_email, opened_at, closed_at, resolution, estimated_amount, closed_amount, notes, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (result.error) throw result.error;
  return (result.data ?? null) as OpportunityRecord | null;
}

export async function createOpportunity(input: CreateOpportunityInput) {
  const db = createSourceCrmServerClient();
  const payload = {
    lead_id: requireText(input.lead_id, "Lead", 120),
    company_id: normalizeBigint(input.company_id, "Compañía"),
    contact_id: normalizeBigint(input.contact_id, "Contacto"),
    product_id: requireText(input.product_id, "Producto", 120),
    current_state_id: requireText(input.current_state_id, "Estado actual", 120),
    name: normalizeOptionalText(input.name, 180),
    owner_user_id: normalizeOptionalText(input.owner_user_id, 64),
    owner_email: normalizeOptionalText(input.owner_email, 320),
    created_by_user_id: normalizeOptionalText(input.created_by_user_id, 64),
    created_by_email: normalizeOptionalText(input.created_by_email, 320),
    opened_at: normalizeOptionalText(input.opened_at, 64) ?? new Date().toISOString(),
    estimated_amount: normalizeMoney(input.estimated_amount),
    closed_amount: normalizeMoney(input.closed_amount),
    notes: normalizeOptionalText(input.notes, 2000)
  };

  const result = await db
    .from("opportunities")
    .insert(payload)
    .select("id, lead_id, company_id, contact_id, product_id, current_state_id, name, owner_user_id, owner_email, created_by_user_id, created_by_email, opened_at, closed_at, resolution, estimated_amount, closed_amount, notes, created_at, updated_at")
    .single();

  if (result.error) throw result.error;
  return result.data as OpportunityRecord;
}

export async function updateOpportunity(input: UpdateOpportunityInput) {
  const db = createSourceCrmServerClient();
  const payload = {
    product_id: input.product_id === undefined ? undefined : normalizeOptionalText(input.product_id, 120),
    name: input.name === undefined ? undefined : normalizeOptionalText(input.name, 180),
    owner_user_id: input.owner_user_id === undefined ? undefined : normalizeOptionalText(input.owner_user_id, 64),
    owner_email: input.owner_email === undefined ? undefined : normalizeOptionalText(input.owner_email, 320),
    estimated_amount: input.estimated_amount === undefined ? undefined : normalizeMoney(input.estimated_amount),
    closed_amount: input.closed_amount === undefined ? undefined : normalizeMoney(input.closed_amount),
    notes: input.notes === undefined ? undefined : normalizeOptionalText(input.notes, 2000),
    resolution: input.resolution,
    closed_at: input.closed_at,
    updated_at: new Date().toISOString()
  };

  const result = await db
    .from("opportunities")
    .update(payload)
    .eq("id", input.id)
    .select("id, lead_id, company_id, contact_id, product_id, current_state_id, name, owner_user_id, owner_email, created_by_user_id, created_by_email, opened_at, closed_at, resolution, estimated_amount, closed_amount, notes, created_at, updated_at")
    .single();

  if (result.error) throw result.error;
  return result.data as OpportunityRecord;
}

export async function updateOpportunityState(input: UpdateOpportunityStateInput) {
  const db = createSourceCrmServerClient();
  const payload = {
    current_state_id: requireText(input.current_state_id, "Estado actual", 120),
    resolution: input.resolution,
    closed_at: input.closed_at,
    updated_at: new Date().toISOString()
  };

  const result = await db
    .from("opportunities")
    .update(payload)
    .eq("id", input.opportunity_id)
    .select("id, lead_id, company_id, contact_id, product_id, current_state_id, name, owner_user_id, owner_email, created_by_user_id, created_by_email, opened_at, closed_at, resolution, estimated_amount, closed_amount, notes, created_at, updated_at")
    .single();

  if (result.error) throw result.error;
  return result.data as OpportunityRecord;
}
