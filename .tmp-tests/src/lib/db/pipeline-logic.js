"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertLeadCanConvert = assertLeadCanConvert;
exports.getLeadResolutionForState = getLeadResolutionForState;
exports.getOpportunityResolutionForState = getOpportunityResolutionForState;
exports.getTerminalPipelineEventType = getTerminalPipelineEventType;
exports.isAllowedManualStateChange = isAllowedManualStateChange;
exports.buildTaskTransitionResult = buildTaskTransitionResult;
function assertLeadCanConvert(params) {
    if (params.resolution !== "open") {
        throw new Error("Solo se pueden convertir leads abiertos");
    }
    if (!params.isConversionState) {
        throw new Error("El lead no esta en un estado convertible");
    }
}
function getLeadResolutionForState(stateCode, isTerminal) {
    if (!isTerminal)
        return "open";
    if (stateCode === "descartado")
        return "discarded";
    return "closed";
}
function getOpportunityResolutionForState(stateCode, isTerminal) {
    if (!isTerminal)
        return "open";
    if (stateCode === "descartado")
        return "lost";
    if (stateCode === "ingreso_cuenta")
        return "won";
    return "cancelled";
}
function getTerminalPipelineEventType(params) {
    if (!params.isTerminal)
        return null;
    if (params.stateCode === "descartado") {
        return params.entityType === "lead" ? "discarded" : "lost";
    }
    if (params.entityType === "opportunity" && params.stateCode === "ingreso_cuenta") {
        return "won";
    }
    return null;
}
function isAllowedManualStateChange(params) {
    if (params.targetStateId === params.currentStateId)
        return false;
    if (params.targetCode === "descartado")
        return true;
    if (params.targetPreviousStateId === params.currentStateId)
        return true;
    if (params.currentPreviousStateId === params.targetStateId)
        return true;
    return false;
}
function buildTaskTransitionResult(params) {
    if (params.currentStateId !== params.taskStateId) {
        throw new Error(params.entityType === "lead"
            ? "La tarea no corresponde al estado actual del lead"
            : "La tarea no corresponde al estado actual de la opportunity");
    }
    const nextResolution = params.entityType === "lead"
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
