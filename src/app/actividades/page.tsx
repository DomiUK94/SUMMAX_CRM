import { ActivitiesWorkspace } from "@/components/activities-workspace";

export default function ActividadesPage({
  searchParams
}: {
  searchParams?: {
    section?: string;
    contact_id?: string;
    history_contact_id?: string;
    created_task_name?: string;
    created_contact_name?: string;
  };
}) {
  return <ActivitiesWorkspace searchParams={searchParams} />;
}
