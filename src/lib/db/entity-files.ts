import { writeAuditEntry } from "@/lib/db/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";

export const ENTITY_FILES_BUCKET = "crm-files";
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

export type EntityFileEntityType = "contact" | "investor";

export type EntityFileRecord = {
  id: string;
  entity_type: EntityFileEntityType;
  entity_id: string;
  file_name: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number;
  uploaded_by_user_id: string | null;
  uploaded_by_email: string | null;
  created_at: string;
};

export type EntityFileView = EntityFileRecord & {
  downloadUrl: string | null;
};

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120) || "archivo";
}

function buildStoragePath(entityType: EntityFileEntityType, entityId: string, fileName: string) {
  const safeName = sanitizeFileName(fileName);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${entityType}/${entityId}/${stamp}-${crypto.randomUUID()}-${safeName}`;
}

export function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function normalizeEntityFileError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("25 MB")) return "file_too_large";
  if (message.includes("Selecciona un archivo")) return "file_missing";
  if (message.includes("Archivo no encontrado")) return "file_not_found";
  return "file_upload_failed";
}

export async function listEntityFiles(entityType: EntityFileEntityType, entityId: string): Promise<EntityFileRecord[]> {
  const db = createSourceCrmServerClient();
  const result = await db
    .from("entity_files")
    .select("id, entity_type, entity_id, file_name, storage_bucket, storage_path, mime_type, size_bytes, uploaded_by_user_id, uploaded_by_email, created_at")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false });

  if (result.error) {
    throw result.error;
  }

  return (result.data ?? []) as EntityFileRecord[];
}

export async function listEntityFilesWithUrls(entityType: EntityFileEntityType, entityId: string): Promise<EntityFileView[]> {
  const files = await listEntityFiles(entityType, entityId);
  if (files.length === 0) return [];

  const supabase = createSupabaseServerClient();
  const storage = supabase.storage.from(ENTITY_FILES_BUCKET);

  const signedUrls = await Promise.all(
    files.map(async (file) => {
      const result = await storage.createSignedUrl(file.storage_path, 60 * 60);
      return result.data?.signedUrl ?? null;
    })
  );

  return files.map((file, index) => ({
    ...file,
    downloadUrl: signedUrls[index] ?? null
  }));
}

export async function uploadEntityFile(params: {
  entityType: EntityFileEntityType;
  entityId: string;
  file: File;
  actorUserId: string;
  actorEmail: string;
}) {
  if (!params.file || params.file.size === 0) {
    throw new Error("Selecciona un archivo antes de subirlo");
  }

  if (params.file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("El archivo supera el limite de 25 MB");
  }

  const storagePath = buildStoragePath(params.entityType, params.entityId, params.file.name);
  const fileBuffer = Buffer.from(await params.file.arrayBuffer());
  const supabase = createSupabaseServerClient();
  const storage = supabase.storage.from(ENTITY_FILES_BUCKET);
  const uploadResult = await storage.upload(storagePath, fileBuffer, {
    contentType: params.file.type || "application/octet-stream",
    upsert: false
  });

  if (uploadResult.error) {
    throw uploadResult.error;
  }

  const db = createSourceCrmServerClient();
  const insertResult = await db
    .from("entity_files")
    .insert({
      entity_type: params.entityType,
      entity_id: params.entityId,
      file_name: params.file.name,
      storage_bucket: ENTITY_FILES_BUCKET,
      storage_path: storagePath,
      mime_type: params.file.type || null,
      size_bytes: params.file.size,
      uploaded_by_user_id: params.actorUserId,
      uploaded_by_email: params.actorEmail
    })
    .select("id")
    .single();

  if (insertResult.error) {
    await storage.remove([storagePath]);
    throw insertResult.error;
  }

  await writeAuditEntry({
    entityType: params.entityType,
    entityId: params.entityId,
    action: "update",
    field: "attachments",
    oldValue: null,
    newValue: params.file.name,
    changedByUserId: params.actorUserId,
    changedByEmail: params.actorEmail,
    metadata: {
      file_id: insertResult.data.id,
      file_name: params.file.name,
      size_bytes: params.file.size
    }
  });
}

export async function deleteEntityFile(params: {
  entityType: EntityFileEntityType;
  entityId: string;
  fileId: string;
  actorUserId: string;
  actorEmail: string;
}) {
  const db = createSourceCrmServerClient();
  const existing = await db
    .from("entity_files")
    .select("id, file_name, storage_path")
    .eq("id", params.fileId)
    .eq("entity_type", params.entityType)
    .eq("entity_id", params.entityId)
    .maybeSingle();

  if (existing.error) {
    throw existing.error;
  }

  if (!existing.data) {
    throw new Error("Archivo no encontrado");
  }

  const supabase = createSupabaseServerClient();
  const storage = supabase.storage.from(ENTITY_FILES_BUCKET);
  const removeStorageResult = await storage.remove([existing.data.storage_path]);
  if (removeStorageResult.error) {
    throw removeStorageResult.error;
  }

  const removeRowResult = await db.from("entity_files").delete().eq("id", params.fileId);
  if (removeRowResult.error) {
    throw removeRowResult.error;
  }

  await writeAuditEntry({
    entityType: params.entityType,
    entityId: params.entityId,
    action: "update",
    field: "attachments",
    oldValue: existing.data.file_name,
    newValue: null,
    changedByUserId: params.actorUserId,
    changedByEmail: params.actorEmail,
    metadata: {
      file_id: existing.data.id,
      file_name: existing.data.file_name
    }
  });
}
