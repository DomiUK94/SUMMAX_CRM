import { redirect } from "next/navigation";

type SearchParams = {
  investor_id?: string;
  contact_id?: string;
};

export default async function NewActivityPage({
  searchParams
}: {
  searchParams?: SearchParams;
}) {
  const contactId = String(searchParams?.contact_id ?? "").trim();

  redirect(contactId ? `/actividades?section=new&contact_id=${encodeURIComponent(contactId)}` : "/actividades?section=new");
}
