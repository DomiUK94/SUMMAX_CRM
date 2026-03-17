import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";
import { createDimServerClient } from "@/lib/supabase/dim";

type CountByStatus = { status: string; count: number };

type LeadRow = {
  id: string;
  company_id: number;
  contact_id: number;
  current_state_id: string;
  name: string | null;
  owner_user_id: string | null;
  owner_email: string | null;
  resolution: string;
  notes: string | null;
  opened_at: string;
  updated_at: string;
};

type OpportunityRow = {
  id: string;
  lead_id: string;
  company_id: number;
  contact_id: number;
  product_id: string;
  current_state_id: string;
  name: string | null;
  owner_user_id: string | null;
  owner_email: string | null;
  resolution: string;
  notes: string | null;
  opened_at: string;
  updated_at: string;
};

type ContactNameRow = {
  contact_id: number;
  persona_contacto: string | null;
};

type CompanyNameRow = {
  company_id: number;
  compania: string | null;
};

type StateRow = {
  id: string;
  name: string;
};

type BusinessQueueItem = {
  id: string;
  entity_type: "lead" | "opportunity";
  full_name: string;
  investor_name: string | null;
  state_name: string | null;
  next_step: string | null;
  owner_email: string | null;
  updated_at: string;
  days_without_action: number;
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function toDaysWithoutAction(updatedAt: string | null): number {
  if (!updatedAt) return 999;
  const diffMs = Date.now() - new Date(updatedAt).getTime();
  return Math.max(0, Math.floor(diffMs / ONE_DAY_MS));
}

function shortId(value: string) {
  return value.slice(0, 8);
}

function isOpenResolution(resolution: string | null | undefined) {
  return (resolution ?? "open") === "open";
}

async function loadStateMap() {
  const dim = createDimServerClient();
  const result = await dim.from("state").select("id, name");
  if (result.error) throw result.error;
  return new Map(((result.data ?? []) as StateRow[]).map((row) => [row.id, row.name]));
}

async function loadBusinessNameMaps(params: { contactIds: number[]; companyIds: number[] }) {
  const source = createSourceCrmServerClient();
  const [contactsRes, companiesRes] = await Promise.all([
    params.contactIds.length > 0
      ? source.from("contactos").select("contact_id, persona_contacto").in("contact_id", params.contactIds)
      : Promise.resolve({ data: [] as ContactNameRow[], error: null }),
    params.companyIds.length > 0
      ? source.from("inversion").select("company_id, compania").in("company_id", params.companyIds)
      : Promise.resolve({ data: [] as CompanyNameRow[], error: null })
  ]);

  if (contactsRes.error) throw contactsRes.error;
  if (companiesRes.error) throw companiesRes.error;

  return {
    contactNameById: new Map(((contactsRes.data ?? []) as ContactNameRow[]).map((row) => [row.contact_id, row.persona_contacto ?? null])),
    companyNameById: new Map(((companiesRes.data ?? []) as CompanyNameRow[]).map((row) => [row.company_id, row.compania ?? null]))
  };
}

function buildBusinessItem(params: {
  row: LeadRow | OpportunityRow;
  entityType: "lead" | "opportunity";
  stateNameById: Map<string, string>;
  contactNameById: Map<number, string | null>;
  companyNameById: Map<number, string | null>;
}): BusinessQueueItem {
  const contactName = params.contactNameById.get(params.row.contact_id) ?? null;
  const companyName = params.companyNameById.get(params.row.company_id) ?? null;
  const rowName =
    params.row.name ??
    contactName ??
    `${params.entityType === "lead" ? "Lead" : "Opportunity"} ${shortId(params.row.id)}`;

  return {
    id: params.row.id,
    entity_type: params.entityType,
    full_name: rowName,
    investor_name: companyName,
    state_name: params.stateNameById.get(params.row.current_state_id) ?? null,
    next_step: params.row.notes ?? null,
    owner_email: params.row.owner_email ?? null,
    updated_at: params.row.updated_at,
    days_without_action: toDaysWithoutAction(params.row.updated_at)
  };
}

export async function getGlobalDashboardData() {
  const source = createSourceCrmServerClient();
  const stateNameById = await loadStateMap();

  const [investorsRes, contactsRes, leadsRes, opportunitiesRes] = await Promise.all([
    source.from("inversion").select("company_id", { count: "exact", head: true }),
    source.from("contactos").select("contact_id", { count: "exact", head: true }),
    source
      .from("leads")
      .select("id, company_id, contact_id, current_state_id, name, owner_user_id, owner_email, resolution, notes, opened_at, updated_at")
      .order("updated_at", { ascending: false }),
    source
      .from("opportunities")
      .select("id, lead_id, company_id, contact_id, product_id, current_state_id, name, owner_user_id, owner_email, resolution, notes, opened_at, updated_at")
      .order("updated_at", { ascending: false })
  ]);

  if (leadsRes.error) throw leadsRes.error;
  if (opportunitiesRes.error) throw opportunitiesRes.error;

  const openLeads = ((leadsRes.data ?? []) as LeadRow[]).filter((row) => isOpenResolution(row.resolution));
  const openOpportunities = ((opportunitiesRes.data ?? []) as OpportunityRow[]).filter((row) => isOpenResolution(row.resolution));
  const staleBusiness = [...openLeads.map((row) => ({ row, entityType: "lead" as const })), ...openOpportunities.map((row) => ({ row, entityType: "opportunity" as const }))]
    .filter(({ row }) => toDaysWithoutAction(row.updated_at) >= 14)
    .sort((a, b) => new Date(a.row.updated_at).getTime() - new Date(b.row.updated_at).getTime())
    .slice(0, 8);

  const { contactNameById, companyNameById } = await loadBusinessNameMaps({
    contactIds: Array.from(new Set(staleBusiness.map(({ row }) => row.contact_id))),
    companyIds: Array.from(new Set(staleBusiness.map(({ row }) => row.company_id)))
  });

  const byStatusMap = new Map<string, number>();
  [...openLeads, ...openOpportunities].forEach((row) => {
    const key = stateNameById.get(row.current_state_id) ?? "Sin estado";
    byStatusMap.set(key, (byStatusMap.get(key) ?? 0) + 1);
  });

  const byStatus: CountByStatus[] = Array.from(byStatusMap.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totals: {
      investors: investorsRes.count ?? 0,
      contacts: contactsRes.count ?? 0,
      overdue: staleBusiness.length,
      meetings48h: openOpportunities.length
    },
    byStatus,
    staleContacts: staleBusiness.map(({ row, entityType }) =>
      buildBusinessItem({
        row,
        entityType,
        stateNameById,
        contactNameById,
        companyNameById
      })
    )
  };
}

export async function getMyDashboardData(userId: string) {
  const source = createSourceCrmServerClient();
  const stateNameById = await loadStateMap();

  const [myLeadsRes, myOpportunitiesRes, unassignedLeadsRes, unassignedOpportunitiesRes] = await Promise.all([
    source
      .from("leads")
      .select("id, company_id, contact_id, current_state_id, name, owner_user_id, owner_email, resolution, notes, opened_at, updated_at")
      .eq("owner_user_id", userId)
      .order("updated_at", { ascending: true }),
    source
      .from("opportunities")
      .select("id, lead_id, company_id, contact_id, product_id, current_state_id, name, owner_user_id, owner_email, resolution, notes, opened_at, updated_at")
      .eq("owner_user_id", userId)
      .order("updated_at", { ascending: true }),
    source
      .from("leads")
      .select("id, company_id, contact_id, current_state_id, name, owner_user_id, owner_email, resolution, notes, opened_at, updated_at")
      .is("owner_user_id", null)
      .order("updated_at", { ascending: true }),
    source
      .from("opportunities")
      .select("id, lead_id, company_id, contact_id, product_id, current_state_id, name, owner_user_id, owner_email, resolution, notes, opened_at, updated_at")
      .is("owner_user_id", null)
      .order("updated_at", { ascending: true })
  ]);

  if (myLeadsRes.error) throw myLeadsRes.error;
  if (myOpportunitiesRes.error) throw myOpportunitiesRes.error;
  if (unassignedLeadsRes.error) throw unassignedLeadsRes.error;
  if (unassignedOpportunitiesRes.error) throw unassignedOpportunitiesRes.error;

  const myOpenLeads = ((myLeadsRes.data ?? []) as LeadRow[]).filter((row) => isOpenResolution(row.resolution));
  const myOpenOpportunities = ((myOpportunitiesRes.data ?? []) as OpportunityRow[]).filter((row) => isOpenResolution(row.resolution));
  const unassignedOpenLeads = ((unassignedLeadsRes.data ?? []) as LeadRow[]).filter((row) => isOpenResolution(row.resolution));
  const unassignedOpenOpportunities = ((unassignedOpportunitiesRes.data ?? []) as OpportunityRow[]).filter((row) => isOpenResolution(row.resolution));

  const queueRows = [...myOpenLeads.map((row) => ({ row, entityType: "lead" as const })), ...myOpenOpportunities.map((row) => ({ row, entityType: "opportunity" as const }))]
    .filter(({ row }) => toDaysWithoutAction(row.updated_at) >= 7)
    .sort((a, b) => new Date(a.row.updated_at).getTime() - new Date(b.row.updated_at).getTime())
    .slice(0, 25);

  const unassignedRows = [...unassignedOpenLeads.map((row) => ({ row, entityType: "lead" as const })), ...unassignedOpenOpportunities.map((row) => ({ row, entityType: "opportunity" as const }))]
    .sort((a, b) => new Date(a.row.updated_at).getTime() - new Date(b.row.updated_at).getTime())
    .slice(0, 25);

  const { contactNameById, companyNameById } = await loadBusinessNameMaps({
    contactIds: Array.from(new Set([...queueRows, ...unassignedRows].map(({ row }) => row.contact_id))),
    companyIds: Array.from(new Set([...queueRows, ...unassignedRows].map(({ row }) => row.company_id)))
  });

  const queue = queueRows.map(({ row, entityType }) =>
    buildBusinessItem({
      row,
      entityType,
      stateNameById,
      contactNameById,
      companyNameById
    })
  );

  const unassignedQueue = unassignedRows.map(({ row, entityType }) =>
    buildBusinessItem({
      row,
      entityType,
      stateNameById,
      contactNameById,
      companyNameById
    })
  );

  return {
    totals: {
      myContacts: myOpenLeads.length + myOpenOpportunities.length,
      stale7Days: queueRows.length,
      stale14Days: [...myOpenLeads, ...myOpenOpportunities].filter((row) => toDaysWithoutAction(row.updated_at) >= 14).length,
      unassignedContacts: unassignedRows.length,
      openBusinessCount: myOpenLeads.length + myOpenOpportunities.length
    },
    queue,
    unassignedQueue
  };
}

export async function getWebDashboardData() {
  const supabase = createSupabaseServerClient();

  const [usersRes, ndaProgressRes, cardProgressRes] = await Promise.all([
    supabase.from("users").select("id, email, created_at, updated_at, is_active, role").eq("role", "investor").order("created_at", { ascending: false }),
    supabase.from("nda_progress").select("user_id, confirmed_at"),
    supabase.from("card_progress").select("user_id, card_id, status, updated_at")
  ]);

  if (usersRes.error) throw usersRes.error;
  if (ndaProgressRes.error) throw ndaProgressRes.error;
  if (cardProgressRes.error) throw cardProgressRes.error;

  const ndaByUserId = new Map<string, string>();
  const cardsByUserId = new Map<string, { count: number; lastOpenedAt: string | null }>();

  for (const row of ndaProgressRes.data ?? []) {
    if (!row.confirmed_at) continue;
    const current = ndaByUserId.get(row.user_id);
    if (!current || new Date(row.confirmed_at).getTime() > new Date(current).getTime()) {
      ndaByUserId.set(row.user_id, row.confirmed_at);
    }
  }

  for (const row of cardProgressRes.data ?? []) {
    if ((row.status ?? "").toLowerCase() !== "viewed") continue;
    const current = cardsByUserId.get(row.user_id) ?? { count: 0, lastOpenedAt: null };
    const nextLastOpenedAt =
      !current.lastOpenedAt || new Date(row.updated_at).getTime() > new Date(current.lastOpenedAt).getTime()
        ? row.updated_at
        : current.lastOpenedAt;

    cardsByUserId.set(row.user_id, {
      count: current.count + 1,
      lastOpenedAt: nextLastOpenedAt
    });
  }

  const rows = (usersRes.data ?? [])
    .map((user) => {
      const ndaAcceptedAt = ndaByUserId.get(user.id) ?? null;
      const cardStats = cardsByUserId.get(user.id) ?? { count: 0, lastOpenedAt: null };
      const lastLoginAt = user.updated_at ?? cardStats.lastOpenedAt ?? ndaAcceptedAt ?? user.created_at;

      return {
        id: user.id,
        email: user.email,
        lastLoginAt,
        ndaAcceptedAt,
        cardsOpened: cardStats.count,
        lastCardOpenedAt: cardStats.lastOpenedAt,
        isActive: user.is_active ?? true
      };
    })
    .sort((a, b) => new Date(b.lastLoginAt).getTime() - new Date(a.lastLoginAt).getTime());

  return {
    totals: {
      users: rows.length,
      ndaAccepted: rows.filter((row) => row.ndaAcceptedAt).length,
      cardsOpened: rows.reduce((sum, row) => sum + row.cardsOpened, 0),
      usersWithCardsOpened: rows.filter((row) => row.cardsOpened > 0).length
    },
    rows
  };
}

export async function getWebUserCardOpenings(userId: string) {
  const supabase = createSupabaseServerClient();
  const result = await supabase
    .from("card_progress")
    .select("card_id, status, updated_at")
    .eq("user_id", userId)
    .eq("status", "viewed")
    .order("updated_at", { ascending: true });

  if (result.error) throw result.error;

  return (result.data ?? []).map((row, index) => ({
    id: `${String(row.card_id)}:${String(row.updated_at)}:${index}`,
    cardId: String(row.card_id),
    cardLabel: `Carta ${String(row.card_id)}`,
    openedAt: String(row.updated_at)
  }));
}
