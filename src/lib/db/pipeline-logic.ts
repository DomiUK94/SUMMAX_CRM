export type PipelineEntityType = "lead" | "opportunity";
export type LeadPipelineResolution = "open" | "converted" | "discarded" | "closed";
export type OpportunityPipelineResolution = "open" | "won" | "lost" | "cancelled";
export type TerminalPipelineEventType = "won" | "lost" | "discarded" | null;

export function assertLeadCanConvert(params: {
  resolution: LeadPipelineResolution;
  isConversionState: boolean;
}) {
  if (params.resolution !== "open") {
    throw new Error("Solo se pueden convertir leads abiertos");
  }
  if (!params.isConversionState) {
    throw new Error("El lead no esta en un estado convertible");
  }
}

export function getLeadResolutionForState(
  stateCode: string,
  isTerminal: boolean
): LeadPipelineResolution | undefined {
  if (!isTerminal) return "open";
  if (stateCode === "descartado") return "discarded";
  return "closed";
}

export function getOpportunityResolutionForState(
  stateCode: string,
  isTerminal: boolean
): OpportunityPipelineResolution | undefined {
  if (!isTerminal) return "open";
  if (stateCode === "descartado") return "lost";
  if (stateCode === "ingreso_cuenta") return "won";
  return "cancelled";
}

export function getTerminalPipelineEventType(params: {
  entityType: PipelineEntityType;
  stateCode: string;
  isTerminal: boolean;
}): TerminalPipelineEventType {
  if (!params.isTerminal) return null;
  if (params.stateCode === "descartado") {
    return params.entityType === "lead" ? "discarded" : "lost";
  }
  if (params.entityType === "opportunity" && params.stateCode === "ingreso_cuenta") {
    return "won";
  }
  return null;
}

export function isAllowedManualStateChange(params: {
  currentStateId: string;
  currentPreviousStateId: string | null;
  targetStateId: string;
  targetPreviousStateId: string | null;
  targetCode: string;
}) {
  if (params.targetStateId === params.currentStateId) return false;
  if (params.targetCode === "descartado") return true;
  if (params.targetPreviousStateId === params.currentStateId) return true;
  if (params.currentPreviousStateId === params.targetStateId) return true;
  return false;
}

export function buildTaskTransitionResult(params: {
  entityType: PipelineEntityType;
  currentStateId: string;
  taskStateId: string;
  targetStateId: string;
  targetStateCode: string;
  targetStateIsTerminal: boolean;
  currentResolution: LeadPipelineResolution | OpportunityPipelineResolution;
}) {
  if (params.currentStateId !== params.taskStateId) {
    throw new Error(
      params.entityType === "lead"
        ? "La tarea no corresponde al estado actual del lead"
        : "La tarea no corresponde al estado actual de la opportunity"
    );
  }

  const nextResolution =
    params.entityType === "lead"
      ? getLeadResolutionForState(params.targetStateCode, params.targetStateIsTerminal)
      : getOpportunityResolutionForState(params.targetStateCode, params.targetStateIsTerminal);

  return {
    nextResolution,
    stateChanged: params.currentStateId !== params.targetStateId || params.currentResolution !== nextResolution,
    shouldSetClosedAt: params.targetStateIsTerminal,
    terminalEventType: getTerminalPipelineEventType({
      entityType: params.entityType,
      stateCode: params.targetStateCode,
      isTerminal: params.targetStateIsTerminal
    })
  };
}
