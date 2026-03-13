import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";
import { ENTITY_FILES_BUCKET, normalizeEntityFileError, uploadEntityFile } from "@/lib/db/entity-files";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";

type SearchProps = {
  searchParams?: {
    ok?: string;
    error?: string;
    section?: string;
    draft_action?: string;
    attach_action?: string;
    filter_user?: string;
    filter_file?: string;
    filter_type?: string;
    filter_entity?: string;
  };
};

type FileRow = {
  id: string;
  entity_type: "contact" | "investor";
  entity_id: string;
  file_name: string;
  storage_path: string;
  uploaded_by_email: string | null;
  created_at: string;
  size_bytes: number;
};

type DraftFileRow = {
  id: string;
  file_name: string;
  storage_path: string;
  uploaded_by_email: string | null;
  created_at: string;
  size_bytes: number;
  language: "es" | "en";
};

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function normalizeSection(value: string | undefined) {
  return value === "drafts" || value === "attachments" ? value : "drafts";
}

function buildDraftStoragePath(language: "es" | "en", fileName: string) {
  const safeName = fileName
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120) || "draft";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `drafts/${language}/${stamp}-${crypto.randomUUID()}-${safeName}`;
}

export default async function ArchivosPage({ searchParams }: SearchProps) {
  const user = await requireUser();
  const db = createSourceCrmServerClient();
  const storage = createSupabaseServerClient().storage.from(ENTITY_FILES_BUCKET);
  const activeSection = normalizeSection(searchParams?.section);
  const showDraftUpload = activeSection === "drafts" && searchParams?.draft_action === "upload";
  const showAttachmentUpload = activeSection === "attachments" && searchParams?.attach_action === "upload";

  async function uploadDraftFileAction(formData: FormData) {
    "use server";
    const actor = await requireUser();
    const file = formData.get("file");
    const language = String(formData.get("language") ?? "es") === "en" ? "en" : "es";

    if (!(file instanceof File) || file.size === 0) {
      redirect("/archivos?section=drafts&draft_action=upload&error=file_missing");
    }

    if (file.size > 25 * 1024 * 1024) {
      redirect("/archivos?section=drafts&draft_action=upload&error=file_too_large");
    }

    const storagePath = buildDraftStoragePath(language, file.name);
    const supabase = createSupabaseServerClient();
    const draftStorage = supabase.storage.from(ENTITY_FILES_BUCKET);

    const uploadResult = await draftStorage.upload(storagePath, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type || "application/octet-stream",
      upsert: false
    });

    if (uploadResult.error) {
      redirect("/archivos?section=drafts&draft_action=upload&error=file_upload_failed");
    }

    const insertResult = await createSourceCrmServerClient()
      .from("draft_files")
      .insert({
        file_name: file.name,
        storage_bucket: ENTITY_FILES_BUCKET,
        storage_path: storagePath,
        mime_type: file.type || null,
        size_bytes: file.size,
        uploaded_by_user_id: actor.id,
        uploaded_by_email: actor.email,
        language
      });

    if (insertResult.error) {
      await draftStorage.remove([storagePath]);
      redirect("/archivos?section=drafts&draft_action=upload&error=file_upload_failed");
    }

    revalidatePath("/archivos");
    redirect("/archivos?section=drafts&ok=draft_uploaded");
  }

  async function uploadGeneralFileAction(formData: FormData) {
    "use server";
    const actor = await requireUser();
    const targetValue = String(formData.get("target") ?? "").trim();
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      redirect("/archivos?section=attachments&attach_action=upload&error=file_missing");
    }

    const [entityType, entityId] = targetValue.split(":");
    if (!entityType || !entityId || (entityType !== "contact" && entityType !== "investor")) {
      redirect("/archivos?section=attachments&attach_action=upload&error=invalid_target");
    }

    try {
      await uploadEntityFile({
        entityType,
        entityId,
        file,
        actorUserId: actor.id,
        actorEmail: actor.email
      });
    } catch (error) {
      redirect(`/archivos?section=attachments&attach_action=upload&error=${normalizeEntityFileError(error)}`);
    }

    revalidatePath("/archivos");
    revalidatePath(entityType === "contact" ? `/contacts/${entityId}` : `/investors/${entityId}`);
    redirect("/archivos?section=attachments&ok=file_uploaded");
  }

  const [draftsRes, filesRes, contactsRes, investorsRes] = await Promise.all([
    db
      .from("draft_files")
      .select("id, file_name, storage_path, uploaded_by_email, created_at, size_bytes, language")
      .order("created_at", { ascending: false })
      .limit(200),
    db
      .from("entity_files")
      .select("id, entity_type, entity_id, file_name, storage_path, uploaded_by_email, created_at, size_bytes")
      .order("created_at", { ascending: false })
      .limit(200),
    db.from("contactos").select("contact_id, persona_contacto").order("persona_contacto", { ascending: true }).limit(200),
    db.from("inversion").select("company_id, compania").order("compania", { ascending: true }).limit(200)
  ]);

  const drafts = (draftsRes.data ?? []) as DraftFileRow[];
  const files = (filesRes.data ?? []) as FileRow[];
  const filterUser = String(searchParams?.filter_user ?? "").trim().toLowerCase();
  const filterFile = String(searchParams?.filter_file ?? "").trim().toLowerCase();
  const filterType = String(searchParams?.filter_type ?? "").trim().toLowerCase();
  const filterEntity = String(searchParams?.filter_entity ?? "").trim().toLowerCase();
  const contacts = contactsRes.data ?? [];
  const investors = investorsRes.data ?? [];
  const draftsEs = drafts.filter((draft) => draft.language === "es");
  const draftsEn = drafts.filter((draft) => draft.language === "en");

  const contactNameById = new Map(contacts.map((contact) => [String(contact.contact_id), contact.persona_contacto ?? "Contacto"]));
  const investorNameById = new Map(investors.map((investor) => [String(investor.company_id), investor.compania ?? "Compania"]));

  const filteredFiles = files.filter((file) => {
    const entityLabel = file.entity_type === "contact"
      ? contactNameById.get(file.entity_id) ?? `Contacto ${file.entity_id}`
      : investorNameById.get(file.entity_id) ?? `Compania ${file.entity_id}`;
    const userValue = (file.uploaded_by_email ?? "").toLowerCase();
    const fileValue = file.file_name.toLowerCase();
    const typeValue = (file.entity_type === "contact" ? "contacto" : "compania").toLowerCase();
    const entityValue = entityLabel.toLowerCase();

    if (filterUser && !userValue.includes(filterUser)) return false;
    if (filterFile && !fileValue.includes(filterFile)) return false;
    if (filterType && !typeValue.includes(filterType)) return false;
    if (filterEntity && !entityValue.includes(filterEntity)) return false;
    return true;
  });

  const draftLinks = new Map<string, string>();
  const fileLinks = new Map<string, string>();
  await Promise.all([
    ...drafts.map(async (file) => {
      const signed = await storage.createSignedUrl(file.storage_path, 60 * 60);
      if (signed.data?.signedUrl) draftLinks.set(file.id, signed.data.signedUrl);
    }),
    ...files.map(async (file) => {
      const signed = await storage.createSignedUrl(file.storage_path, 60 * 60);
      if (signed.data?.signedUrl) fileLinks.set(file.id, signed.data.signedUrl);
    })
  ]);

  return (
    <AppShell title="Archivos" subtitle="Borradores, adjuntos y carga centralizada" canViewGlobal={user.can_view_global_dashboard}>
      <div className="stack">
        <div className="smart-tabs-row" role="tablist" aria-label="Secciones de archivos">
          <Link href="/archivos?section=drafts" className={activeSection === "drafts" ? "smart-tab smart-tab-active" : "smart-tab"}>Borrador Archivos</Link>
          <Link href="/archivos?section=attachments" className={activeSection === "attachments" ? "smart-tab smart-tab-active" : "smart-tab"}>Archivos Adjuntos</Link>
        </div>

        {searchParams?.ok === "draft_uploaded" ? <div className="notice notice-success">Borrador subido correctamente.</div> : null}
        {searchParams?.ok === "file_uploaded" ? <div className="notice notice-success">Archivo subido correctamente.</div> : null}
        {searchParams?.error === "file_missing" ? <div className="notice notice-error">Selecciona un archivo.</div> : null}
        {searchParams?.error === "file_too_large" ? <div className="notice notice-error">El archivo supera el limite permitido.</div> : null}
        {searchParams?.error === "invalid_target" ? <div className="notice notice-error">Selecciona una compania o un contacto.</div> : null}
        {searchParams?.error === "file_upload_failed" ? <div className="notice notice-error">No se pudo subir el archivo.</div> : null}

        {activeSection === "drafts" ? (
          <section className="card stack draft-files-shell">
            <div className="draft-files-hero">
              <div>
                <h3>Borradores internos separados por idioma</h3>
                <p className="muted">Estos archivos solo viven aqui y no quedan asociados a contactos ni companias.</p>
              </div>
              <div className="draft-files-hero-actions">
                <Link href={showDraftUpload ? "/archivos?section=drafts" : "/archivos?section=drafts&draft_action=upload"} className="smart-tab smart-tab-active">
                  {showDraftUpload ? "Cerrar subida" : "Subir borrador"}
                </Link>
              </div>
            </div>

            {showDraftUpload ? (
              <div className="draft-files-upload-popover-wrap">
                <form action={uploadDraftFileAction} className="draft-files-upload-popover">
                  <label className="form-field">
                    <span>Idioma</span>
                    <select name="language" defaultValue="es">
                      <option value="es">{"Espa\u00F1ol"}</option>
                      <option value="en">Ingles</option>
                    </select>
                  </label>
                  <label className="form-field">
                    <span>Archivo borrador</span>
                    <input type="file" name="file" required />
                  </label>
                  <div className="draft-files-upload-submit">
                    <button type="submit">Subir borrador</button>
                  </div>
                </form>
              </div>
            ) : null}

            <div className="draft-files-grid">
              <section className="draft-language-card draft-language-card-es">
                <div className="draft-language-head">
                  <div>
                    <p className="workspace-kicker">{"Espa\u00F1ol"}</p>
                    <h4>{draftsEs.length} borradores</h4>
                  </div>
                  <div className="draft-language-badge"><span className="draft-flag draft-flag-es" aria-hidden="true" /><span className="crm-chip">ES</span></div>
                </div>
                <div className="draft-language-list">
                  {draftsEs.length > 0 ? draftsEs.map((draft) => {
                    const downloadHref = draftLinks.get(draft.id);
                    return (
                      <article key={draft.id} className="draft-language-item">
                        <div>
                          {downloadHref ? <a href={downloadHref} target="_blank" rel="noreferrer"><strong>{draft.file_name}</strong></a> : <strong>{draft.file_name}</strong>}
                          <span>{draft.uploaded_by_email ?? "Sin usuario"} | {new Date(draft.created_at).toLocaleString("es-ES")}</span>
                        </div>
                        <small>{formatFileSize(draft.size_bytes)}</small>
                      </article>
                    );
                  }) : <p className="muted">{"Sin borradores en Espa\u00F1ol."}</p>}
                </div>
              </section>

              <section className="draft-language-card draft-language-card-en">
                <div className="draft-language-head">
                  <div>
                    <p className="workspace-kicker">Ingles</p>
                    <h4>{draftsEn.length} borradores</h4>
                  </div>
                  <div className="draft-language-badge"><span className="draft-flag draft-flag-uk" aria-hidden="true" /><span className="crm-chip">EN</span></div>
                </div>
                <div className="draft-language-list">
                  {draftsEn.length > 0 ? draftsEn.map((draft) => {
                    const downloadHref = draftLinks.get(draft.id);
                    return (
                      <article key={draft.id} className="draft-language-item">
                        <div>
                          {downloadHref ? <a href={downloadHref} target="_blank" rel="noreferrer"><strong>{draft.file_name}</strong></a> : <strong>{draft.file_name}</strong>}
                          <span>{draft.uploaded_by_email ?? "Sin usuario"} | {new Date(draft.created_at).toLocaleString("es-ES")}</span>
                        </div>
                        <small>{formatFileSize(draft.size_bytes)}</small>
                      </article>
                    );
                  }) : <p className="muted">Sin borradores en Ingles.</p>}
                </div>
              </section>
            </div>
          </section>
        ) : null}

        {activeSection === "attachments" ? (
          <section className="card stack">
            <div className="draft-files-hero">
              <div>
                <h3>Archivos existentes por usuario</h3>
              </div>
              <div className="draft-files-hero-actions">
                <Link href={showAttachmentUpload ? "/archivos?section=attachments" : "/archivos?section=attachments&attach_action=upload"} className="smart-tab smart-tab-active">
                  {showAttachmentUpload ? "Cerrar subida" : "A\u00F1adir"}
                </Link>
              </div>
            </div>

            {showAttachmentUpload ? (
              <form action={uploadGeneralFileAction} className="entity-files-admin-form">
                <label className="form-field">
                  <span>Seleccionar destino</span>
                  <select name="target" defaultValue="">
                    <option value="">Elegir compania o contacto</option>
                    {investors.map((investor) => (
                      <option key={`investor-${investor.company_id}`} value={`investor:${investor.company_id}`}>
                        {`Compania | ${investor.compania ?? `#${investor.company_id}`}`}
                      </option>
                    ))}
                    {contacts.map((contact) => (
                      <option key={`contact-${contact.contact_id}`} value={`contact:${contact.contact_id}`}>
                        {`Contacto | ${contact.persona_contacto ?? `#${contact.contact_id}`}`}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  <span>Archivo</span>
                  <input type="file" name="file" required />
                </label>
                <div>
                  <button type="submit">Subir archivo</button>
                </div>
              </form>
            ) : null}
            <div className="companies-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Archivo</th>
                    <th>Tipo</th>
                    <th>Entidad</th>
                    <th>Fecha</th>
                    <th>{"Tama\u00F1o"}</th>
                  </tr>
                  <tr>
                    <th><input name="filter_user" form="attachments-filters" defaultValue={searchParams?.filter_user ?? ""} placeholder="Filtrar" /></th>
                    <th><input name="filter_file" form="attachments-filters" defaultValue={searchParams?.filter_file ?? ""} placeholder="Filtrar" /></th>
                    <th><input name="filter_type" form="attachments-filters" defaultValue={searchParams?.filter_type ?? ""} placeholder="Filtrar" /></th>
                    <th><input name="filter_entity" form="attachments-filters" defaultValue={searchParams?.filter_entity ?? ""} placeholder="Filtrar" /></th>
                    <th colSpan={2}>
                      <form id="attachments-filters" method="get" className="attachments-filters-actions">
                        <input type="hidden" name="section" value="attachments" />
                        <button type="submit">Filtrar</button>
                        <Link href="/archivos?section=attachments" className="quick-pill quick-pill-ghost">Limpiar</Link>
                      </form>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFiles.length > 0 ? filteredFiles.map((file) => {
                    const entityLabel = file.entity_type === "contact"
                      ? contactNameById.get(file.entity_id) ?? `Contacto ${file.entity_id}`
                      : investorNameById.get(file.entity_id) ?? `Compania ${file.entity_id}`;
                    const entityHref = file.entity_type === "contact" ? `/contacts/${file.entity_id}` : `/investors/${file.entity_id}`;
                    const downloadHref = fileLinks.get(file.id);

                    return (
                      <tr key={file.id}>
                        <td>{file.uploaded_by_email ?? "Sin usuario"}</td>
                        <td>{downloadHref ? <a href={downloadHref} target="_blank" rel="noreferrer">{file.file_name}</a> : file.file_name}</td>
                        <td>{file.entity_type === "contact" ? "Contacto" : "Compania"}</td>
                        <td><Link href={entityHref}>{entityLabel}</Link></td>
                        <td>{new Date(file.created_at).toLocaleString("es-ES")}</td>
                        <td>{formatFileSize(file.size_bytes)}</td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={6} className="muted">Sin archivos que coincidan con el filtro.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}


      </div>
    </AppShell>
  );
}
