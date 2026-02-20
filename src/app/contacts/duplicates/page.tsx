import { AppShell } from "@/components/app-shell";
import { ContactsDuplicatesClient } from "@/components/contacts-duplicates-client";
import { requireUser } from "@/lib/auth/session";

export default async function ContactsDuplicatesPage() {
  const user = await requireUser();
  return (
    <AppShell title="Duplicados" subtitle="Revisar y fusionar contactos" canViewGlobal={user.can_view_global_dashboard}>
      <ContactsDuplicatesClient />
    </AppShell>
  );
}
