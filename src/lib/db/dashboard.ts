import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";

type CountByStatus = { status: string; count: number };
type WebUserRow = {
  id: string;
  email: string;
  created_at: string;
  updated_at: string | null;
  is_active: boolean | null;
  role: string | null;
};
type NdaProgressRow = {
  user_id: string;
  confirmed_at: string | null;
};
type CardProgressRow = {
  user_id: string;
  card_id: string;
  status: string | null;
  updated_at: string;
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function toDaysWithoutAction(updatedAt: string | null): number {
  if (!updatedAt) return 999;
  const diffMs = Date.now() - new Date(updatedAt).getTime();
  return Math.max(0, Math.floor(diffMs / ONE_DAY_MS));
}

export async function getGlobalDashboardData() {
  const supabase = createSourceCrmServerClient();

  const [investorsRes, contactsRes, highPriorityRes, statusRes, staleRes] = await Promise.all([
    supabase.from("inversion").select("company_id", { count: "exact", head: true }),
    supabase.from("contactos").select("contact_id", { count: "exact", head: true }),
    supabase.from("contactos").select("contact_id", { count: "exact", head: true }).eq("prioritario", "Si"),
    supabase.from("contactos").select("prioritario").not("prioritario", "is", null),
    supabase
      .from("contactos")
      .select("contact_id, persona_contacto, prioritario, comentarios, updated_at, compania")
      .lt("updated_at", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
      .limit(8)
  ]);

  const byStatusMap = new Map<string, number>();
  (statusRes.data ?? []).forEach((row) => {
    const key = row.prioritario ?? "Sin estado";
    byStatusMap.set(key, (byStatusMap.get(key) ?? 0) + 1);
  });

  const byStatus: CountByStatus[] = Array.from(byStatusMap.entries()).map(([status, count]) => ({ status, count }));

  return {
    totals: {
      investors: investorsRes.count ?? 0,
      contacts: contactsRes.count ?? 0,
      overdue: 0,
      meetings48h: highPriorityRes.count ?? 0
    },
    byStatus,
    staleContacts: (staleRes.data ?? []).map((row) => ({
      id: String(row.contact_id),
      full_name: row.persona_contacto,
      status_name: row.prioritario,
      next_step: row.comentarios,
      due_date: null,
      owner_email: row.compania,
      updated_at: row.updated_at
    }))
  };
}

export async function getMyDashboardData(userId: string) {
  const supabase = createSourceCrmServerClient();
  const sevenDaysAgoIso = new Date(Date.now() - 7 * ONE_DAY_MS).toISOString();
  const fourteenDaysAgoIso = new Date(Date.now() - 14 * ONE_DAY_MS).toISOString();

  const [myContacts, unassignedContacts, stale7Days, stale14Days, highPriorityContacts, list, unassignedList] = await Promise.all([
    supabase.from("contactos").select("contact_id", { count: "exact", head: true }).eq("owner_user_id", userId),
    supabase.from("contactos").select("contact_id", { count: "exact", head: true }).is("owner_user_id", null),
    supabase.from("contactos").select("contact_id", { count: "exact", head: true }).eq("owner_user_id", userId).lt("updated_at", sevenDaysAgoIso),
    supabase.from("contactos").select("contact_id", { count: "exact", head: true }).eq("owner_user_id", userId).lt("updated_at", fourteenDaysAgoIso),
    supabase.from("contactos").select("contact_id", { count: "exact", head: true }).eq("owner_user_id", userId).eq("prioritario", "Si"),
    supabase
      .from("contactos")
      .select("contact_id, persona_contacto, prioritario, comentarios, compania, updated_at, owner_email")
      .eq("owner_user_id", userId)
      .lt("updated_at", sevenDaysAgoIso)
      .order("updated_at", { ascending: true })
      .limit(25),
    supabase
      .from("contactos")
      .select("contact_id, persona_contacto, prioritario, comentarios, compania, updated_at")
      .is("owner_user_id", null)
      .order("updated_at", { ascending: true })
      .limit(25)
  ]);

  const queue = (list.data ?? []).map((row) => ({
    id: String(row.contact_id),
    full_name: row.persona_contacto,
    status_name: row.prioritario,
    next_step: row.comentarios,
    due_date: null,
    priority_level: null,
    investor_name: row.compania,
    owner_email: row.owner_email,
    updated_at: row.updated_at,
    days_without_action: toDaysWithoutAction(row.updated_at)
  }));

  return {
    totals: {
      myContacts: myContacts.count ?? 0,
      stale7Days: stale7Days.count ?? 0,
      stale14Days: stale14Days.count ?? 0,
      unassignedContacts: unassignedContacts.count ?? 0,
      highPriorityContacts: highPriorityContacts.count ?? 0
    },
    queue,
    unassignedQueue: (unassignedList.data ?? []).map((row) => ({
      id: String(row.contact_id),
      full_name: row.persona_contacto,
      status_name: row.prioritario,
      next_step: row.comentarios,
      investor_name: row.compania,
      updated_at: row.updated_at,
      days_without_action: toDaysWithoutAction(row.updated_at)
    }))
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

  for (const row of (ndaProgressRes.data ?? []) as NdaProgressRow[]) {
    if (!row.confirmed_at) continue;
    const current = ndaByUserId.get(row.user_id);
    if (!current || new Date(row.confirmed_at).getTime() > new Date(current).getTime()) {
      ndaByUserId.set(row.user_id, row.confirmed_at);
    }
  }

  for (const row of (cardProgressRes.data ?? []) as CardProgressRow[]) {
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

  const rows = ((usersRes.data ?? []) as WebUserRow[])
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
