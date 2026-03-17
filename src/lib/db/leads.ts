import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";
import { normalizeOptionalText, requireText } from "@/lib/validation/crm";

export type LeadResolution = "open" | "converted" | "discarded" | "closed";

export type LeadRecord = {
  id: string;
  company_id: number;
  contact_id: number;
  current_state_id: string;
  name: string | null;
  owner_user_id: string | null;
  owner_email: string | null;
  created_by_user_id: string | null;
  created_by_email: string | null;
  opened_at: string;
  converted_at: string | null;
  closed_at: string | null;
  resolution: LeadResolution;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ListLeadsPageParams = {
  page?: number;
  pageSize?: number;
  q?: string;
  stateId?: string;
  ownerUserId?: string;
  resolution?: LeadResolution;
};

export type CreateLeadInput = {
  company_id: number | string;
  contact_id: number | string;
  current_state_id: string;
  name?: string;
  owner_user_id?: string;
  owner_email?: string;
  created_by_user_id?: string;
  created_by_email?: string;
  opened_at?: string;
  notes?: string;
};

export type UpdateLeadInput = {
  id: string;
  name?: string;
  owner_user_id?: string | null;
  owner_email?: string | null;
  notes?: string | null;
  resolution?: LeadResolution;
  converted_at?: string | null;
  closed_at?: string | null;
};

export type UpdateLeadStateInput = {
  lead_id: string;
  current_state_id: string;
  resolution?: LeadResolution;
  converted_at?: string | null;
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

export async function listLeadsPage(params: ListLeadsPageParams = {}) {
  const db = createSourceCrmServerClient();
  const page = normalizePage(params.page);
  const pageSize = normalizePageSize(params.pageSize);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const q = String(params.q ?? "").trim();

  let query = db
    .from("leads")
    .select("id, company_id, contact_id, current_state_id, name, owner_user_id, owner_email, created_by_user_id, created_by_email, opened_at, converted_at, closed_at, resolution, notes, created_at, updated_at", { count: "exact" })
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
  if (q) {
    const pattern = `%${q}%`;
    query = query.or(`name.ilike.${pattern},owner_email.ilike.${pattern},notes.ilike.${pattern}`);
  }

  const result = await query.range(from, to);
  if (result.error) throw result.error;

  return {
    rows: (result.data ?? []) as LeadRecord[],
    totalCount: result.count ?? 0
  };
}

export async function getLeadById(id: string) {
  const db = createSourceCrmServerClient();
  const result = await db
    .from("leads")
    .select("id, company_id, contact_id, current_state_id, name, owner_user_id, owner_email, created_by_user_id, created_by_email, opened_at, converted_at, closed_at, resolution, notes, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (result.error) throw result.error;
  return (result.data ?? null) as LeadRecord | null;
}

export async function createLead(input: CreateLeadInput) {
  const db = createSourceCrmServerClient();
  const payload = {
    company_id: normalizeBigint(input.company_id, "Compañía"),
    contact_id: normalizeBigint(input.contact_id, "Contacto"),
    current_state_id: requireText(input.current_state_id, "Estado actual", 120),
    name: normalizeOptionalText(input.name, 180),
    owner_user_id: normalizeOptionalText(input.owner_user_id, 64),
    owner_email: normalizeOptionalText(input.owner_email, 320),
    created_by_user_id: normalizeOptionalText(input.created_by_user_id, 64),
    created_by_email: normalizeOptionalText(input.created_by_email, 320),
    opened_at: normalizeOptionalText(input.opened_at, 64) ?? new Date().toISOString(),
    notes: normalizeOptionalText(input.notes, 2000)
  };

  const result = await db
    .from("leads")
    .insert(payload)
    .select("id, company_id, contact_id, current_state_id, name, owner_user_id, owner_email, created_by_user_id, created_by_email, opened_at, converted_at, closed_at, resolution, notes, created_at, updated_at")
    .single();

  if (result.error) throw result.error;
  return result.data as LeadRecord;
}

export async function updateLead(input: UpdateLeadInput) {
  const db = createSourceCrmServerClient();
  const payload = {
    name: input.name === undefined ? undefined : normalizeOptionalText(input.name, 180),
    owner_user_id: input.owner_user_id === undefined ? undefined : normalizeOptionalText(input.owner_user_id, 64),
    owner_email: input.owner_email === undefined ? undefined : normalizeOptionalText(input.owner_email, 320),
    notes: input.notes === undefined ? undefined : normalizeOptionalText(input.notes, 2000),
    resolution: input.resolution,
    converted_at: input.converted_at,
    closed_at: input.closed_at,
    updated_at: new Date().toISOString()
  };

  const result = await db
    .from("leads")
    .update(payload)
    .eq("id", input.id)
    .select("id, company_id, contact_id, current_state_id, name, owner_user_id, owner_email, created_by_user_id, created_by_email, opened_at, converted_at, closed_at, resolution, notes, created_at, updated_at")
    .single();

  if (result.error) throw result.error;
  return result.data as LeadRecord;
}

export async function updateLeadState(input: UpdateLeadStateInput) {
  const db = createSourceCrmServerClient();
  const payload = {
    current_state_id: requireText(input.current_state_id, "Estado actual", 120),
    resolution: input.resolution,
    converted_at: input.converted_at,
    closed_at: input.closed_at,
    updated_at: new Date().toISOString()
  };

  const result = await db
    .from("leads")
    .update(payload)
    .eq("id", input.lead_id)
    .select("id, company_id, contact_id, current_state_id, name, owner_user_id, owner_email, created_by_user_id, created_by_email, opened_at, converted_at, closed_at, resolution, notes, created_at, updated_at")
    .single();

  if (result.error) throw result.error;
  return result.data as LeadRecord;
}
