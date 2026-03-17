import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { canManageCrmBulkEdits } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { createSignedDownloadUrl, formatFileSize } from "@/lib/db/entity-files";
import { getProductFamilyLabel, type ProductRecord } from "@/lib/db/products";
import { createDimServerClient } from "@/lib/supabase/dim";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";

type SearchProps = {
  searchParams?: {
    q?: string;
  };
};

type EntityFileSearchRow = {
  id: string;
  entity_type: "contact" | "investor";
  entity_id: string;
  file_name: string;
  storage_bucket: string;
  storage_path: string;
  uploaded_by_email: string | null;
  created_at: string;
  size_bytes: number;
};

type DraftFileSearchRow = {
  id: string;
  file_name: string;
  storage_bucket: string;
  storage_path: string;
  uploaded_by_email: string | null;
  created_at: string;
  size_bytes: number;
  language: "es" | "en";
};

type BusinessSearchRow = {
  id: string;
  name: string | null;
  owner_email: string | null;
  resolution: string;
  updated_at: string;
  business_type: "lead" | "opportunity";
};

type TaskSearchRow = {
  id: string;
  name: string;
  entity_type: "lead" | "opportunity" | "both";
  task_kind: "action" | "feedback";
  updated_at: string;
};

export default async function SearchPage({ searchParams }: SearchProps) {
  const user = await requireUser();
  const canReadDraftFiles = canManageCrmBulkEdits(user);
  const q = String(searchParams?.q ?? "").trim();
  const db = createSourceCrmServerClient();
  const dim = createDimServerClient();
  const pattern = `%${q}%`;

  const [contactsRes, investorsRes, productsRes, leadsRes, opportunitiesRes, tasksRes, entityFilesRes, draftFilesRes] =
    q.length >= 2
      ? await Promise.all([
          db
            .from("contactos")
            .select("contact_id, persona_contacto, compania, email")
            .or(`persona_contacto.ilike.${pattern},compania.ilike.${pattern},email.ilike.${pattern}`)
            .limit(20),
          db
            .from("inversion")
            .select("company_id, compania, vertical")
            .or(`compania.ilike.${pattern},vertical.ilike.${pattern},web.ilike.${pattern}`)
            .limit(20),
          dim
            .from("product")
            .select("id, code, name, product_family, amount_min, amount_max, default_multiplier, requires_amount, requires_multiplier, requires_company_valuation, requires_country, active, created_at, updated_at")
            .or(`code.ilike.${pattern},name.ilike.${pattern},product_family.ilike.${pattern}`)
            .limit(20),
          db
            .from("leads")
            .select("id, name, owner_email, resolution, updated_at")
            .or(`name.ilike.${pattern},owner_email.ilike.${pattern},notes.ilike.${pattern}`)
            .limit(20),
          db
            .from("opportunities")
            .select("id, name, owner_email, resolution, updated_at")
            .or(`name.ilike.${pattern},owner_email.ilike.${pattern},notes.ilike.${pattern}`)
            .limit(20),
          dim
            .from("task")
            .select("id, name, entity_type, task_kind, updated_at")
            .or(`name.ilike.${pattern},code.ilike.${pattern},task_kind.ilike.${pattern}`)
            .limit(20),
          db
            .from("entity_files")
            .select("id, entity_type, entity_id, file_name, storage_bucket, storage_path, uploaded_by_email, created_at, size_bytes")
            .or(`file_name.ilike.${pattern},uploaded_by_email.ilike.${pattern}`)
            .order("created_at", { ascending: false })
            .limit(20),
          canReadDraftFiles
            ? db
            .from("draft_files")
            .select("id, file_name, storage_bucket, storage_path, uploaded_by_email, created_at, size_bytes, language")
            .or(`file_name.ilike.${pattern},uploaded_by_email.ilike.${pattern}`)
            .order("created_at", { ascending: false })
            .limit(20)
            : Promise.resolve({ data: [] as DraftFileSearchRow[] })
        ])
      : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const entityFiles = (entityFilesRes.data ?? []) as EntityFileSearchRow[];
  const draftFiles = (draftFilesRes.data ?? []) as DraftFileSearchRow[];
  const products = (productsRes.data ?? []) as ProductRecord[];
  const business = [
    ...((leadsRes.data ?? []).map((row) => ({ ...(row as Omit<BusinessSearchRow, "business_type">), business_type: "lead" as const }))),
    ...((opportunitiesRes.data ?? []).map((row) => ({
      ...(row as Omit<BusinessSearchRow, "business_type">),
      business_type: "opportunity" as const
    })))
  ].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  const tasks = (tasksRes.data ?? []) as TaskSearchRow[];
  const contactIds = Array.from(new Set(entityFiles.filter((file) => file.entity_type === "contact").map((file) => file.entity_id)));
  const investorIds = Array.from(new Set(entityFiles.filter((file) => file.entity_type === "investor").map((file) => file.entity_id)));

  const [fileContactsRes, fileInvestorsRes] =
    q.length >= 2
      ? await Promise.all([
          contactIds.length > 0
            ? db.from("contactos").select("contact_id, persona_contacto").in("contact_id", contactIds.map((value) => Number(value)))
            : Promise.resolve({ data: [] as { contact_id: string; persona_contacto: string | null }[] }),
          investorIds.length > 0
            ? db.from("inversion").select("company_id, compania").in("company_id", investorIds.map((value) => Number(value)))
            : Promise.resolve({ data: [] as { company_id: string; compania: string | null }[] })
        ])
      : [{ data: [] as { contact_id: string; persona_contacto: string | null }[] }, { data: [] as { company_id: string; compania: string | null }[] }];

  const contactNameById = new Map((fileContactsRes.data ?? []).map((row) => [String(row.contact_id), row.persona_contacto ?? "Contacto"]));
  const investorNameById = new Map((fileInvestorsRes.data ?? []).map((row) => [String(row.company_id), row.compania ?? "Compania"]));
  const fileUrlByKey = new Map<string, string>();

  await Promise.all([
    ...entityFiles.map(async (file) => {
      const signedUrl = await createSignedDownloadUrl(file.storage_bucket, file.storage_path);
      if (signedUrl) fileUrlByKey.set(`entity:${file.id}`, signedUrl);
    }),
    ...draftFiles.map(async (file) => {
      const signedUrl = await createSignedDownloadUrl(file.storage_bucket, file.storage_path);
      if (signedUrl) fileUrlByKey.set(`draft:${file.id}`, signedUrl);
    })
  ]);

  const totalFiles = entityFiles.length + draftFiles.length;

  return (
    <AppShell
      title="Busqueda global"
      subtitle="Contactos, Compania, Negocios, Productos, Tareas y Archivos"
      canViewGlobal={user.can_view_global_dashboard}
    >
      <div className="stack">
        <div className="card">
          <form method="get" className="entity-toolbar">
            <input className="toolbar-search" name="q" defaultValue={q} placeholder="Escribe al menos 2 caracteres..." />
            <button type="submit">Buscar</button>
          </form>
        </div>

        <div className="card">
          <h3>Contactos ({contactsRes.data?.length ?? 0})</h3>
          <div className="stack">
            {(contactsRes.data ?? []).map((contact) => (
              <Link key={contact.contact_id} href={`/contacts/${contact.contact_id}`}>
                {contact.persona_contacto ?? "(sin nombre)"} | {contact.compania ?? "--"} | {contact.email ?? "--"}
              </Link>
            ))}
            {q.length >= 2 && (contactsRes.data ?? []).length === 0 ? <p className="muted">Sin resultados.</p> : null}
          </div>
        </div>

        <div className="card">
          <h3>Companias ({investorsRes.data?.length ?? 0})</h3>
          <div className="stack">
            {(investorsRes.data ?? []).map((investor) => (
              <Link key={investor.company_id} href={`/investors/${investor.company_id}`}>
                {investor.compania} | {investor.vertical ?? "--"}
              </Link>
            ))}
            {q.length >= 2 && (investorsRes.data ?? []).length === 0 ? <p className="muted">Sin resultados.</p> : null}
          </div>
        </div>

        <div className="card">
          <h3>Negocios ({business.length})</h3>
          <div className="stack">
            {business.map((item) => (
              <Link
                key={`${item.business_type}-${item.id}`}
                href={item.business_type === "lead" ? `/acuerdos/leads/${item.id}` : `/acuerdos/opportunities/${item.id}`}
              >
                {item.name ?? "(sin nombre)"} | {item.business_type === "lead" ? "Lead" : "Opportunity"} | {item.resolution ?? "--"} |{" "}
                {item.owner_email ?? "--"}
              </Link>
            ))}
            {q.length >= 2 && business.length === 0 ? <p className="muted">Sin resultados.</p> : null}
          </div>
        </div>

        <div className="card">
          <h3>Productos ({products.length})</h3>
          <div className="stack">
            {products.map((product) => (
              <Link key={product.id} href="/acuerdos">
                {product.name} | {product.code} | {getProductFamilyLabel(product.product_family)}
              </Link>
            ))}
            {q.length >= 2 && products.length === 0 ? <p className="muted">Sin resultados.</p> : null}
          </div>
        </div>

        <div className="card">
          <h3>Tareas ({tasks.length})</h3>
          <div className="stack">
            {tasks.map((task) => (
              <p key={task.id}>
                {task.name} | {task.entity_type} | {task.task_kind}
              </p>
            ))}
            {q.length >= 2 && tasks.length === 0 ? <p className="muted">Sin resultados.</p> : null}
          </div>
        </div>

        <div className="card">
          <h3>Archivos ({totalFiles})</h3>
          <div className="stack">
            {entityFiles.map((file) => {
              const entityName =
                file.entity_type === "contact"
                  ? contactNameById.get(file.entity_id) ?? `Contacto ${file.entity_id}`
                  : investorNameById.get(file.entity_id) ?? `Compania ${file.entity_id}`;
              const entityHref = file.entity_type === "contact" ? `/contacts/${file.entity_id}` : `/investors/${file.entity_id}`;
              const fileHref = fileUrlByKey.get(`entity:${file.id}`);
              return (
                <p key={`entity-${file.id}`}>
                  {fileHref ? (
                    <a href={fileHref} target="_blank" rel="noreferrer">
                      {file.file_name}
                    </a>
                  ) : (
                    file.file_name
                  )}{" "}
                  | <Link href={entityHref}>{entityName}</Link> | {file.entity_type === "contact" ? "Contacto" : "Compania"} |{" "}
                  {formatFileSize(file.size_bytes)}
                </p>
              );
            })}

            {draftFiles.map((file) => {
              const fileHref = fileUrlByKey.get(`draft:${file.id}`);
              return (
                <p key={`draft-${file.id}`}>
                  {fileHref ? (
                    <a href={fileHref} target="_blank" rel="noreferrer">
                      {file.file_name}
                    </a>
                  ) : (
                    file.file_name
                  )}{" "}
                  | Borrador {file.language === "en" ? "Ingles" : "Espanol"} | {formatFileSize(file.size_bytes)} |{" "}
                  <Link href="/archivos?section=drafts">Ver borradores</Link>
                </p>
              );
            })}

            {q.length >= 2 && totalFiles === 0 ? <p className="muted">Sin resultados.</p> : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
