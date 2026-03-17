import { createFactServerClient } from "@/lib/supabase/fact";
import { createDimServerClient } from "@/lib/supabase/dim";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";
import { createOpportunity, getOpportunityById, updateOpportunityState, type OpportunityRecord } from "@/lib/db/opportunities";
import { getLeadById, updateLeadState, type LeadRecord } from "@/lib/db/leads";
import {
  assertLeadCanConvert,
  buildTaskTransitionResult,
  getLeadResolutionForState,
  getOpportunityResolutionForState,
  getTerminalPipelineEventType,
  isAllowedManualStateChange
} from "@/lib/db/pipeline-logic";
import { normalizeOptionalText, requireText } from "@/lib/validation/crm";

export type PipelineEntityType = "lead" | "opportunity";
export type PipelineEventType = "state_entered" | "task_logged" | "converted" | "won" | "lost" | "discarded" | "note";

export type PipelineEventRecord = {
  id: string;
  entity_type: PipelineEntityType;
  lead_id: string | null;
  opportunity_id: string | null;
  company_id: number;
  contact_id: number;
  product_id: string | null;
  state_id: string | null;
  task_id: string | null;
  event_type: PipelineEventType;
  occurred_at: string;
  actor_user_id: string | null;
  actor_email: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type LogPipelineEventInput = {
  entity_type: PipelineEntityType;
  lead_id?: string | null;
  opportunity_id?: string | null;
  company_id: number | string;
  contact_id: number | string;
  product_id?: string | null;
  state_id?: string | null;
  task_id?: string | null;
  event_type: PipelineEventType;
  occurred_at?: string;
  actor_user_id?: string | null;
  actor_email?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
};

export type ConvertLeadToOpportunityInput = {
  lead_id: string;
  product_id: string;
  opportunity_state_id: string;
  opportunity_name?: string;
  owner_user_id?: string | null;
  owner_email?: string | null;
  actor_user_id?: string | null;
  actor_email?: string | null;
  estimated_amount?: number | string | null;
  notes?: string | null;
  occurred_at?: string;
};

export type CompletePipelineTaskInput = {
  entity_type: PipelineEntityType;
  lead_id?: string;
  opportunity_id?: string;
  task_id: string;
  actor_user_id?: string | null;
  actor_email?: string | null;
  notes?: string | null;
  occurred_at?: string;
};

export type ChangePipelineStateInput = {
  entity_type: PipelineEntityType;
  lead_id?: string;
  opportunity_id?: string;
  target_state_id: string;
  actor_user_id?: string | null;
  actor_email?: string | null;
  notes?: string | null;
  occurred_at?: string;
};

function normalizeBigint(value: number | string, label: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} no válido`);
  }
  return Math.trunc(parsed);
}

function shouldFallbackToLegacyRpc(error: { code?: string; message?: string } | null, functionName: string) {
  if (!error) return false;
  const message = String(error.message ?? "");
  return error.code === "PGRST202" || (message.includes(functionName) && (message.includes("schema cache") || message.includes("not found")));
}

export async function logPipelineEvent(input: LogPipelineEventInput) {
  const db = createFactServerClient();
  const payload = {
    entity_type: input.entity_type,
    lead_id: input.lead_id ?? null,
    opportunity_id: input.opportunity_id ?? null,
    company_id: normalizeBigint(input.company_id, "Compañía"),
    contact_id: normalizeBigint(input.contact_id, "Contacto"),
    product_id: input.product_id ?? null,
    state_id: input.state_id ?? null,
    task_id: input.task_id ?? null,
    event_type: input.event_type,
    occurred_at: normalizeOptionalText(input.occurred_at, 64) ?? new Date().toISOString(),
    actor_user_id: input.actor_user_id ?? null,
    actor_email: input.actor_email ?? null,
    notes: input.notes === undefined ? null : normalizeOptionalText(input.notes, 4000),
    metadata: input.metadata ?? {}
  };

  const result = await db
    .from("pipeline_event")
    .insert(payload)
    .select("id, entity_type, lead_id, opportunity_id, company_id, contact_id, product_id, state_id, task_id, event_type, occurred_at, actor_user_id, actor_email, notes, metadata, created_at")
    .single();

  if (result.error) throw result.error;
  return result.data as PipelineEventRecord;
}

export async function logStateEvent(input: Omit<LogPipelineEventInput, "event_type" | "task_id">) {
  return logPipelineEvent({
    ...input,
    event_type: "state_entered",
    task_id: null
  });
}

export async function logTaskEvent(input: Omit<LogPipelineEventInput, "event_type">) {
  return logPipelineEvent({
    ...input,
    event_type: "task_logged"
  });
}

export async function convertLeadToOpportunity(input: ConvertLeadToOpportunityInput): Promise<{
  lead: LeadRecord;
  opportunity: OpportunityRecord;
}> {
  const occurredAt = normalizeOptionalText(input.occurred_at, 64) ?? new Date().toISOString();
  const source = createSourceCrmServerClient();
  const rpcResult = await source.rpc("pipeline_convert_lead_to_opportunity", {
    p_lead_id: requireText(input.lead_id, "Lead", 120),
    p_product_id: requireText(input.product_id, "Producto", 120),
    p_opportunity_state_id: requireText(input.opportunity_state_id, "Estado inicial opportunity", 120),
    p_opportunity_name: normalizeOptionalText(input.opportunity_name, 180),
    p_owner_user_id: input.owner_user_id ?? null,
    p_owner_email: input.owner_email ?? null,
    p_actor_user_id: input.actor_user_id ?? null,
    p_actor_email: input.actor_email ?? null,
    p_estimated_amount: input.estimated_amount ?? null,
    p_notes: input.notes ?? null,
    p_occurred_at: occurredAt
  });

  if (!rpcResult.error) {
    const rpcRow = Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data;
    if (rpcRow?.lead_id && rpcRow?.opportunity_id) {
      const [leadFromRpc, opportunityFromRpc] = await Promise.all([
        getLeadById(String(rpcRow.lead_id)),
        getOpportunityById(String(rpcRow.opportunity_id))
      ]);

      if (leadFromRpc && opportunityFromRpc) {
        return {
          lead: leadFromRpc,
          opportunity: opportunityFromRpc
        };
      }
    }
  } else if (!shouldFallbackToLegacyRpc(rpcResult.error, "pipeline_convert_lead_to_opportunity")) {
    throw rpcResult.error;
  }

  const lead = await getLeadById(requireText(input.lead_id, "Lead", 120));
  if (!lead) {
    throw new Error("Lead no encontrado");
  }
  const dim = createDimServerClient();
  const stateRes = await dim
    .from("state")
    .select("id, is_conversion_state")
    .eq("id", lead.current_state_id)
    .maybeSingle();

  if (stateRes.error) throw stateRes.error;
  assertLeadCanConvert({
    resolution: lead.resolution,
    isConversionState: Boolean(stateRes.data?.is_conversion_state)
  });
  if (!stateRes.data?.is_conversion_state) {
    throw new Error("El lead no está en un estado convertible");
  }

  const opportunity = await createOpportunity({
    lead_id: lead.id,
    company_id: lead.company_id,
    contact_id: lead.contact_id,
    product_id: requireText(input.product_id, "Producto", 120),
    current_state_id: requireText(input.opportunity_state_id, "Estado inicial opportunity", 120),
    name: input.opportunity_name ?? lead.name ?? undefined,
    owner_user_id: input.owner_user_id ?? lead.owner_user_id ?? undefined,
    owner_email: input.owner_email ?? lead.owner_email ?? undefined,
    created_by_user_id: input.actor_user_id ?? lead.created_by_user_id ?? undefined,
    created_by_email: input.actor_email ?? lead.created_by_email ?? undefined,
    opened_at: occurredAt,
    estimated_amount: input.estimated_amount ?? null,
    notes: input.notes ?? lead.notes ?? undefined
  });

  const updatedLead = await updateLeadState({
    lead_id: lead.id,
    current_state_id: lead.current_state_id,
    resolution: "converted",
    converted_at: occurredAt
  });

  await logPipelineEvent({
    entity_type: "lead",
    lead_id: lead.id,
    company_id: lead.company_id,
    contact_id: lead.contact_id,
    state_id: lead.current_state_id,
    event_type: "converted",
    occurred_at: occurredAt,
    actor_user_id: input.actor_user_id ?? null,
    actor_email: input.actor_email ?? null,
    notes: input.notes ?? null,
    metadata: {
      opportunity_id: opportunity.id,
      product_id: opportunity.product_id
    }
  });

  await logPipelineEvent({
    entity_type: "opportunity",
    opportunity_id: opportunity.id,
    company_id: opportunity.company_id,
    contact_id: opportunity.contact_id,
    product_id: opportunity.product_id,
    state_id: opportunity.current_state_id,
    event_type: "state_entered",
    occurred_at: occurredAt,
    actor_user_id: input.actor_user_id ?? null,
    actor_email: input.actor_email ?? null,
    notes: "Opportunity creada desde lead",
    metadata: {
      lead_id: lead.id
    }
  });

  return {
    lead: updatedLead,
    opportunity
  };
}

export async function completePipelineTask(input: CompletePipelineTaskInput) {
  const source = createSourceCrmServerClient();
  const dim = createDimServerClient();
  const taskId = requireText(input.task_id, "Tarea", 120);
  const occurredAt = normalizeOptionalText(input.occurred_at, 64) ?? new Date().toISOString();
  const rpcResult = await source.rpc("pipeline_complete_task", {
    p_entity_type: input.entity_type,
    p_lead_id: input.lead_id ?? null,
    p_opportunity_id: input.opportunity_id ?? null,
    p_task_id: taskId,
    p_actor_user_id: input.actor_user_id ?? null,
    p_actor_email: input.actor_email ?? null,
    p_notes: input.notes ?? null,
    p_occurred_at: occurredAt
  });

  if (!rpcResult.error) {
    const rpcRow = Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data;
    if (rpcRow) {
      if (input.entity_type === "lead") {
        const lead = await getLeadById(requireText(input.lead_id, "Lead", 120));
        if (!lead) throw new Error("Lead no encontrado");
        return {
          entity_type: "lead" as const,
          task_name: String(rpcRow.task_name ?? ""),
          resulting_state_name: String(rpcRow.resulting_state_name ?? ""),
          lead
        };
      }

      const opportunity = await getOpportunityById(requireText(input.opportunity_id, "Opportunity", 120));
      if (!opportunity) throw new Error("Opportunity no encontrada");
      return {
        entity_type: "opportunity" as const,
        task_name: String(rpcRow.task_name ?? ""),
        resulting_state_name: String(rpcRow.resulting_state_name ?? ""),
        opportunity
      };
    }
  } else if (!shouldFallbackToLegacyRpc(rpcResult.error, "pipeline_complete_task")) {
    throw rpcResult.error;
  }

  const taskRes = await dim
    .from("task")
    .select("id, name, entity_type, state_id, resulting_state_id")
    .eq("id", taskId)
    .maybeSingle();

  if (taskRes.error) throw taskRes.error;
  if (!taskRes.data) {
    throw new Error("Tarea no encontrada");
  }

  const task = taskRes.data as {
    id: string;
    name: string;
    entity_type: PipelineEntityType | "both";
    state_id: string;
    resulting_state_id: string | null;
  };

  if (task.entity_type !== "both" && task.entity_type !== input.entity_type) {
    throw new Error("La tarea no aplica a esta entidad");
  }

  const targetStateId = task.resulting_state_id ?? task.state_id;

  const stateRes = await dim
    .from("state")
    .select("id, code, name, is_terminal")
    .eq("id", targetStateId)
    .maybeSingle();

  if (stateRes.error) throw stateRes.error;
  if (!stateRes.data) {
    throw new Error("Estado destino no encontrado");
  }

  const targetState = stateRes.data as {
    id: string;
    code: string;
    name: string;
    is_terminal: boolean;
  };

  if (input.entity_type === "lead") {
    const leadId = requireText(input.lead_id, "Lead", 120);
    const lead = await getLeadById(leadId);

    if (!lead) {
      throw new Error("Lead no encontrado");
    }
    const transition = buildTaskTransitionResult({
      entityType: "lead",
      currentStateId: lead.current_state_id,
      taskStateId: task.state_id,
      targetStateId: targetState.id,
      targetStateCode: targetState.code,
      targetStateIsTerminal: targetState.is_terminal,
      currentResolution: lead.resolution
    });

    await logTaskEvent({
      entity_type: "lead",
      lead_id: lead.id,
      company_id: lead.company_id,
      contact_id: lead.contact_id,
      state_id: lead.current_state_id,
      task_id: task.id,
      occurred_at: occurredAt,
      actor_user_id: input.actor_user_id ?? null,
      actor_email: input.actor_email ?? null,
      notes: input.notes ?? null,
      metadata: {
        task_name: task.name,
        resulting_state_id: targetState.id
      }
    });

    const nextClosedAt = transition.shouldSetClosedAt ? occurredAt : null;

    const updatedLead = transition.stateChanged
      ? await updateLeadState({
          lead_id: lead.id,
          current_state_id: targetState.id,
          resolution: transition.nextResolution as LeadRecord["resolution"] | undefined,
          closed_at: nextClosedAt
        })
      : lead;

    if (transition.stateChanged) {
      await logStateEvent({
        entity_type: "lead",
        lead_id: lead.id,
        company_id: lead.company_id,
        contact_id: lead.contact_id,
        state_id: updatedLead.current_state_id,
        occurred_at: occurredAt,
        actor_user_id: input.actor_user_id ?? null,
        actor_email: input.actor_email ?? null,
        notes: `Estado actualizado por tarea: ${task.name}`,
        metadata: {
          task_id: task.id,
          previous_state_id: lead.current_state_id,
          resulting_state_id: targetState.id
        }
      });

      if (transition.terminalEventType) {
        await logPipelineEvent({
          entity_type: "lead",
          lead_id: lead.id,
          company_id: lead.company_id,
          contact_id: lead.contact_id,
          state_id: updatedLead.current_state_id,
          event_type: transition.terminalEventType,
          occurred_at: occurredAt,
          actor_user_id: input.actor_user_id ?? null,
          actor_email: input.actor_email ?? null,
          notes: input.notes ?? null,
          metadata: {
            task_id: task.id
          }
        });
      }
    }

    return {
      entity_type: "lead" as const,
      task_name: task.name,
      resulting_state_name: targetState.name,
      lead: updatedLead
    };
  }

  const opportunityId = requireText(input.opportunity_id, "Opportunity", 120);
  const opportunity = await getOpportunityById(opportunityId);

  if (!opportunity) {
    throw new Error("Opportunity no encontrada");
  }
  const transition = buildTaskTransitionResult({
    entityType: "opportunity",
    currentStateId: opportunity.current_state_id,
    taskStateId: task.state_id,
    targetStateId: targetState.id,
    targetStateCode: targetState.code,
    targetStateIsTerminal: targetState.is_terminal,
    currentResolution: opportunity.resolution
  });

  await logTaskEvent({
    entity_type: "opportunity",
    opportunity_id: opportunity.id,
    company_id: opportunity.company_id,
    contact_id: opportunity.contact_id,
    product_id: opportunity.product_id,
    state_id: opportunity.current_state_id,
    task_id: task.id,
    occurred_at: occurredAt,
    actor_user_id: input.actor_user_id ?? null,
    actor_email: input.actor_email ?? null,
    notes: input.notes ?? null,
    metadata: {
      task_name: task.name,
      resulting_state_id: targetState.id
    }
  });

  const nextClosedAt = transition.shouldSetClosedAt ? occurredAt : null;

  const updatedOpportunity = transition.stateChanged
    ? await updateOpportunityState({
        opportunity_id: opportunity.id,
        current_state_id: targetState.id,
        resolution: transition.nextResolution as OpportunityRecord["resolution"] | undefined,
        closed_at: nextClosedAt
      })
    : opportunity;

  if (transition.stateChanged) {
    await logStateEvent({
      entity_type: "opportunity",
      opportunity_id: opportunity.id,
      company_id: opportunity.company_id,
      contact_id: opportunity.contact_id,
      product_id: opportunity.product_id,
      state_id: updatedOpportunity.current_state_id,
      occurred_at: occurredAt,
      actor_user_id: input.actor_user_id ?? null,
      actor_email: input.actor_email ?? null,
      notes: `Estado actualizado por tarea: ${task.name}`,
      metadata: {
        task_id: task.id,
        previous_state_id: opportunity.current_state_id,
        resulting_state_id: targetState.id
      }
    });

    if (transition.terminalEventType) {
      await logPipelineEvent({
        entity_type: "opportunity",
        opportunity_id: opportunity.id,
        company_id: opportunity.company_id,
        contact_id: opportunity.contact_id,
        product_id: opportunity.product_id,
        state_id: updatedOpportunity.current_state_id,
        event_type: transition.terminalEventType,
        occurred_at: occurredAt,
        actor_user_id: input.actor_user_id ?? null,
        actor_email: input.actor_email ?? null,
        notes: input.notes ?? null,
        metadata: {
          task_id: task.id
        }
      });
    }
  }

  return {
    entity_type: "opportunity" as const,
    task_name: task.name,
    resulting_state_name: targetState.name,
    opportunity: updatedOpportunity
  };
}

export async function changePipelineState(input: ChangePipelineStateInput) {
  const source = createSourceCrmServerClient();
  const dim = createDimServerClient();
  const targetStateId = requireText(input.target_state_id, "Estado destino", 120);
  const occurredAt = normalizeOptionalText(input.occurred_at, 64) ?? new Date().toISOString();
  const rpcResult = await source.rpc("pipeline_change_state", {
    p_entity_type: input.entity_type,
    p_lead_id: input.lead_id ?? null,
    p_opportunity_id: input.opportunity_id ?? null,
    p_target_state_id: targetStateId,
    p_actor_user_id: input.actor_user_id ?? null,
    p_actor_email: input.actor_email ?? null,
    p_notes: input.notes ?? null,
    p_occurred_at: occurredAt
  });

  if (!rpcResult.error) {
    const rpcRow = Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data;
    if (rpcRow) {
      if (input.entity_type === "lead") {
        const lead = await getLeadById(requireText(input.lead_id, "Lead", 120));
        if (!lead) throw new Error("Lead no encontrado");
        return {
          entity_type: "lead" as const,
          resulting_state_name: String(rpcRow.resulting_state_name ?? ""),
          lead
        };
      }

      const opportunity = await getOpportunityById(requireText(input.opportunity_id, "Opportunity", 120));
      if (!opportunity) throw new Error("Opportunity no encontrada");
      return {
        entity_type: "opportunity" as const,
        resulting_state_name: String(rpcRow.resulting_state_name ?? ""),
        opportunity
      };
    }
  } else if (!shouldFallbackToLegacyRpc(rpcResult.error, "pipeline_change_state")) {
    throw rpcResult.error;
  }

  if (input.entity_type === "lead") {
    const leadId = requireText(input.lead_id, "Lead", 120);
    const lead = await getLeadById(leadId);

    if (!lead) {
      throw new Error("Lead no encontrado");
    }

    const [currentStateRes, targetStateRes] = await Promise.all([
      dim
        .from("state")
        .select("id, code, name, entity_type, previous_state_id, is_terminal")
        .eq("id", lead.current_state_id)
        .maybeSingle(),
      dim
        .from("state")
        .select("id, code, name, entity_type, previous_state_id, is_terminal")
        .eq("id", targetStateId)
        .maybeSingle()
    ]);

    if (currentStateRes.error) throw currentStateRes.error;
    if (targetStateRes.error) throw targetStateRes.error;
    if (!currentStateRes.data || !targetStateRes.data) {
      throw new Error("No se ha podido resolver la transicion de estado");
    }

    const currentState = currentStateRes.data as {
      id: string;
      code: string;
      name: string;
      entity_type: PipelineEntityType | "both";
      previous_state_id: string | null;
      is_terminal: boolean;
    };
    const targetState = targetStateRes.data as typeof currentState;

    if (targetState.entity_type !== "lead" && targetState.entity_type !== "both") {
      throw new Error("El estado destino no aplica a leads");
    }
    if (
      !isAllowedManualStateChange({
        currentStateId: currentState.id,
        currentPreviousStateId: currentState.previous_state_id,
        targetStateId: targetState.id,
        targetPreviousStateId: targetState.previous_state_id,
        targetCode: targetState.code
      })
    ) {
      throw new Error("La transicion manual no es valida para este lead");
    }

    const nextResolution = getLeadResolutionForState(targetState.code, targetState.is_terminal);
    const updatedLead = await updateLeadState({
      lead_id: lead.id,
      current_state_id: targetState.id,
      resolution: nextResolution,
      closed_at: targetState.is_terminal ? occurredAt : null
    });

    await logStateEvent({
      entity_type: "lead",
      lead_id: lead.id,
      company_id: lead.company_id,
      contact_id: lead.contact_id,
      state_id: targetState.id,
      occurred_at: occurredAt,
      actor_user_id: input.actor_user_id ?? null,
      actor_email: input.actor_email ?? null,
      notes: input.notes ?? `Cambio manual a ${targetState.name}`,
      metadata: {
        previous_state_id: currentState.id,
        change_mode: "manual"
      }
    });

    const terminalEventType = getTerminalPipelineEventType({
      entityType: "lead",
      stateCode: targetState.code,
      isTerminal: targetState.is_terminal
    });

    if (terminalEventType) {
      await logPipelineEvent({
        entity_type: "lead",
        lead_id: lead.id,
        company_id: lead.company_id,
        contact_id: lead.contact_id,
        state_id: targetState.id,
        event_type: terminalEventType,
        occurred_at: occurredAt,
        actor_user_id: input.actor_user_id ?? null,
        actor_email: input.actor_email ?? null,
        notes: input.notes ?? null,
        metadata: {
          previous_state_id: currentState.id,
          change_mode: "manual"
        }
      });
    }

    return {
      entity_type: "lead" as const,
      resulting_state_name: targetState.name,
      lead: updatedLead
    };
  }

  const opportunityId = requireText(input.opportunity_id, "Opportunity", 120);
  const opportunity = await getOpportunityById(opportunityId);

  if (!opportunity) {
    throw new Error("Opportunity no encontrada");
  }

  const [currentStateRes, targetStateRes] = await Promise.all([
    dim
      .from("state")
      .select("id, code, name, entity_type, previous_state_id, is_terminal")
      .eq("id", opportunity.current_state_id)
      .maybeSingle(),
    dim
      .from("state")
      .select("id, code, name, entity_type, previous_state_id, is_terminal")
      .eq("id", targetStateId)
      .maybeSingle()
  ]);

  if (currentStateRes.error) throw currentStateRes.error;
  if (targetStateRes.error) throw targetStateRes.error;
  if (!currentStateRes.data || !targetStateRes.data) {
    throw new Error("No se ha podido resolver la transicion de estado");
  }

  const currentState = currentStateRes.data as {
    id: string;
    code: string;
    name: string;
    entity_type: PipelineEntityType | "both";
    previous_state_id: string | null;
    is_terminal: boolean;
  };
  const targetState = targetStateRes.data as typeof currentState;

  if (targetState.entity_type !== "opportunity" && targetState.entity_type !== "both") {
    throw new Error("El estado destino no aplica a opportunities");
  }
  if (
    !isAllowedManualStateChange({
      currentStateId: currentState.id,
      currentPreviousStateId: currentState.previous_state_id,
      targetStateId: targetState.id,
      targetPreviousStateId: targetState.previous_state_id,
      targetCode: targetState.code
    })
  ) {
    throw new Error("La transicion manual no es valida para esta opportunity");
  }

  const nextResolution = getOpportunityResolutionForState(targetState.code, targetState.is_terminal);
  const updatedOpportunity = await updateOpportunityState({
    opportunity_id: opportunity.id,
    current_state_id: targetState.id,
    resolution: nextResolution,
    closed_at: targetState.is_terminal ? occurredAt : null
  });

  await logStateEvent({
    entity_type: "opportunity",
    opportunity_id: opportunity.id,
    company_id: opportunity.company_id,
    contact_id: opportunity.contact_id,
    product_id: opportunity.product_id,
    state_id: targetState.id,
    occurred_at: occurredAt,
    actor_user_id: input.actor_user_id ?? null,
    actor_email: input.actor_email ?? null,
    notes: input.notes ?? `Cambio manual a ${targetState.name}`,
    metadata: {
      previous_state_id: currentState.id,
      change_mode: "manual"
    }
  });

  const terminalEventType = getTerminalPipelineEventType({
    entityType: "opportunity",
    stateCode: targetState.code,
    isTerminal: targetState.is_terminal
  });

  if (terminalEventType) {
    await logPipelineEvent({
      entity_type: "opportunity",
      opportunity_id: opportunity.id,
      company_id: opportunity.company_id,
      contact_id: opportunity.contact_id,
      product_id: opportunity.product_id,
      state_id: targetState.id,
      event_type: terminalEventType,
      occurred_at: occurredAt,
      actor_user_id: input.actor_user_id ?? null,
      actor_email: input.actor_email ?? null,
      notes: input.notes ?? null,
      metadata: {
        previous_state_id: currentState.id,
        change_mode: "manual"
      }
    });
  }

  return {
    entity_type: "opportunity" as const,
    resulting_state_name: targetState.name,
    opportunity: updatedOpportunity
  };
}

export async function listPipelineEvents(params: {
  entity_type: PipelineEntityType;
  lead_id?: string;
  opportunity_id?: string;
  page?: number;
  pageSize?: number;
}) {
  const db = createFactServerClient();
  const page = !Number.isFinite(params.page) || (params.page ?? 0) < 1 ? 1 : Math.trunc(params.page as number);
  const pageSize = !Number.isFinite(params.pageSize) || (params.pageSize ?? 0) < 1 ? 25 : Math.min(100, Math.trunc(params.pageSize as number));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = db
    .from("pipeline_event")
    .select("id, entity_type, lead_id, opportunity_id, company_id, contact_id, product_id, state_id, task_id, event_type, occurred_at, actor_user_id, actor_email, notes, metadata, created_at", { count: "exact" })
    .eq("entity_type", params.entity_type)
    .order("occurred_at", { ascending: false });

  if (params.entity_type === "lead" && params.lead_id) {
    query = query.eq("lead_id", params.lead_id);
  }
  if (params.entity_type === "opportunity" && params.opportunity_id) {
    query = query.eq("opportunity_id", params.opportunity_id);
  }

  const result = await query.range(from, to);
  if (result.error) throw result.error;

  return {
    rows: (result.data ?? []) as PipelineEventRecord[],
    totalCount: result.count ?? 0
  };
}
