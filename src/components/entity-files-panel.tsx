import Link from "next/link";
import { CrmIcon } from "@/components/ui/crm-icon";
import { formatFileSize, type EntityFileEntityType, type EntityFileView } from "@/lib/db/entity-files";

type Theme = "contact" | "company";

type Props = {
  theme: Theme;
  entityType: EntityFileEntityType;
  entityId: string;
  files: EntityFileView[];
  uploadAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
  searchParams?: { ok?: string; error?: string };
};

function cls(theme: string, suffix: string) {
  return `${theme}-record-${suffix}`;
}

function feedbackMessage(searchParams: Props["searchParams"]) {
  switch (searchParams?.error) {
    case "file_missing":
      return { type: "error", text: "Selecciona un archivo." };
    case "file_too_large":
      return { type: "error", text: "El archivo supera el limite permitido." };
    case "file_upload_failed":
      return { type: "error", text: "No se pudo subir el archivo." };
    case "file_delete_failed":
      return { type: "error", text: "No se pudo eliminar el archivo." };
    case "file_not_found":
      return { type: "error", text: "Archivo no encontrado." };
    default:
      return null;
  }
}

export function EntityFilesPanel({ theme, entityType, entityId, files, uploadAction, deleteAction, searchParams }: Props) {
  const prefix = theme === "contact" ? "contact" : "company";
  const message = feedbackMessage(searchParams);

  return (
    <details className={cls(prefix, "mini-panel")}>
      <summary className={cls(prefix, "mini-summary")}>
        <div className={cls(prefix, "mini-title")}>
          <CrmIcon name="chevron_down" className="crm-icon" />
          <span>Archivos ({files.length})</span>
        </div>
        <div className={cls(prefix, "mini-actions")}>
          <span className={cls(prefix, "mini-action")}>Subir</span>
        </div>
      </summary>
      <div className={cls(prefix, "mini-body")}>
        <form action={uploadAction} className="entity-files-upload-form stack">
          <input type="hidden" name="entity_type" value={entityType} />
          <input type="hidden" name="entity_id" value={entityId} />
          <label className="form-field">
            <span>Seleccionar archivo</span>
            <input type="file" name="file" required />
          </label>
          <button type="submit">Subir archivo</button>
          {searchParams?.ok === "file_uploaded" ? <p className="crm-inline-success">Archivo subido.</p> : null}
          {searchParams?.ok === "file_deleted" ? <p className="crm-inline-success">Archivo eliminado.</p> : null}
          {message ? <p className={message.type === "error" ? "crm-inline-error" : "crm-inline-success"}>{message.text}</p> : null}
        </form>

        {files.length > 0 ? (
          files.map((file) => (
            <div key={file.id} className={`${cls(prefix, "mini-item")} entity-file-row`}>
              <div className="entity-file-copy">
                {file.downloadUrl ? (
                  <Link href={file.downloadUrl} target="_blank" rel="noreferrer" className="entity-file-link">
                    <strong>{file.file_name}</strong>
                  </Link>
                ) : (
                  <strong>{file.file_name}</strong>
                )}
                <span>
                  {formatFileSize(file.size_bytes)} | {file.uploaded_by_email ?? "Sin autor"} | {new Date(file.created_at).toLocaleString("es-ES")}
                </span>
              </div>
              <form action={deleteAction}>
                <input type="hidden" name="entity_type" value={entityType} />
                <input type="hidden" name="entity_id" value={entityId} />
                <input type="hidden" name="file_id" value={file.id} />
                <button type="submit" className="entity-file-delete-button">Eliminar</button>
              </form>
            </div>
          ))
        ) : (
          <p className="muted">Sin archivos guardados.</p>
        )}
      </div>
    </details>
  );
}
