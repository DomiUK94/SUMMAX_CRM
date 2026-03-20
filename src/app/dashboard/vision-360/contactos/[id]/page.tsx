import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Dashboard360Detail } from "@/components/dashboard-360-detail";
import { requireGlobalDashboardAccess } from "@/lib/auth/session";
import { getContact360DashboardData } from "@/lib/db/dashboard-360";

export default async function ContactVision360Page({
  params
}: {
  params: { id: string };
}) {
  const user = await requireGlobalDashboardAccess();
  const data = await getContact360DashboardData(params.id);

  if (!data) {
    notFound();
  }

  return (
    <AppShell
      title={data.summary.title}
      subtitle="Dashboard Visión 360 de contacto"
      canViewGlobal={user.can_view_global_dashboard}
    >
      <Dashboard360Detail
        summary={data.summary}
        knowledge={data.knowledge}
        pipeline={data.pipeline}
        timeline={data.timeline}
        decisions={data.decisions}
        documents={data.documents}
        nextAction={data.nextAction}
        responsibles={data.responsibles}
        relationships={data.relationships}
        relationshipsTitle="Compañía vinculada"
        quickActions={[
          { label: "Abrir CRM", href: `/contacts/${encodeURIComponent(params.id)}`, icon: "overview" },
          { label: "Nueva tarea", href: `/actividades?section=new&contact_id=${encodeURIComponent(params.id)}`, icon: "task" },
          { label: "Compañía", href: data.summary.relationHref ?? undefined, icon: "companies" },
          { label: "LinkedIn", href: data.knowledge.find((item) => item.label === "LinkedIn")?.href, icon: "linkedin", external: true }
        ]}
      />
    </AppShell>
  );
}
