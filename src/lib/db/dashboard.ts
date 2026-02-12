import { createSupabaseServerClient } from "@/lib/supabase/server";

type CountByStatus = { status: string; count: number };

export async function getGlobalDashboardData() {
  const supabase = createSupabaseServerClient();

  const [
    investorsRes,
    contactsRes,
    pendingRes,
    meetingsRes,
    statusRes,
    staleRes
  ] = await Promise.all([
    supabase.from("investors").select("id", { count: "exact", head: true }),
    supabase.from("contacts").select("id", { count: "exact", head: true }),
    supabase.from("contacts").select("id", { count: "exact", head: true }).lt("due_date", new Date().toISOString().slice(0, 10)),
    supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .gte("due_date", new Date().toISOString().slice(0, 10))
      .lte("due_date", new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().slice(0, 10)),
    supabase
      .from("contacts")
      .select("status_name")
      .not("status_name", "is", null),
    supabase
      .from("contacts")
      .select("id, full_name, status_name, next_step, due_date, owner_email, updated_at")
      .lt("updated_at", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
      .limit(8)
  ]);

  const byStatusMap = new Map<string, number>();
  (statusRes.data ?? []).forEach((row) => {
    const key = row.status_name ?? "Sin estado";
    byStatusMap.set(key, (byStatusMap.get(key) ?? 0) + 1);
  });

  const byStatus: CountByStatus[] = Array.from(byStatusMap.entries()).map(([status, count]) => ({ status, count }));

  return {
    totals: {
      investors: investorsRes.count ?? 0,
      contacts: contactsRes.count ?? 0,
      overdue: pendingRes.count ?? 0,
      meetings48h: meetingsRes.count ?? 0
    },
    byStatus,
    staleContacts: staleRes.data ?? []
  };
}

export async function getMyDashboardData(userId: string) {
  const supabase = createSupabaseServerClient();
  const today = new Date().toISOString().slice(0, 10);

  const [
    myContacts,
    dueToday,
    overdue,
    upcoming,
    list
  ] = await Promise.all([
    supabase.from("contacts").select("id", { count: "exact", head: true }).eq("owner_user_id", userId),
    supabase.from("contacts").select("id", { count: "exact", head: true }).eq("owner_user_id", userId).eq("due_date", today),
    supabase.from("contacts").select("id", { count: "exact", head: true }).eq("owner_user_id", userId).lt("due_date", today),
    supabase.from("contacts").select("id", { count: "exact", head: true }).eq("owner_user_id", userId).gte("due_date", today),
    supabase
      .from("contacts")
      .select("id, full_name, status_name, next_step, due_date, priority_level, investor_name")
      .eq("owner_user_id", userId)
      .order("priority_level", { ascending: false })
      .order("due_date", { ascending: true })
      .limit(15)
  ]);

  return {
    totals: {
      myContacts: myContacts.count ?? 0,
      dueToday: dueToday.count ?? 0,
      overdue: overdue.count ?? 0,
      upcoming: upcoming.count ?? 0
    },
    queue: list.data ?? []
  };
}
