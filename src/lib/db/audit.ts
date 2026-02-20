
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";

type AuditAction = "create" | "update" | "delete" | "merge" | "assign" | "status_change";
type AuditEntity = "contact" | "investor" | "deal" | "activity" | "saved_view" | "tag";

export async function writeAuditEntry(params: {
  entityType: AuditEntity;
  entityId: string;
  action: AuditAction;
  changedByUserId: string;
  changedByEmail: string;
  field?: string;
  oldValue?: string | null;
  newValue?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const db = createSourceCrmServerClient();
  const { error } = await db.from("audit_log").insert({
    entity_type: params.entityType,
    entity_id: params.entityId,
    action: params.action,
    field: params.field ?? null,
    old_value: params.oldValue ?? null,
    new_value: params.newValue ?? null,
    changed_by_user_id: params.changedByUserId,
    changed_by_email: params.changedByEmail,
    metadata: params.metadata ?? {}
  });

  if (error) {
    throw error;
  }
}
