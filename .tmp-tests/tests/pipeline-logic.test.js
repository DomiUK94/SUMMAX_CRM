"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const pipeline_logic_1 = require("../src/lib/db/pipeline-logic");
function run(name, fn) {
    try {
        fn();
        console.log(`PASS ${name}`);
    }
    catch (error) {
        console.error(`FAIL ${name}`);
        throw error;
    }
}
run("lead conversion only works for open leads in conversion state", () => {
    strict_1.default.doesNotThrow(() => (0, pipeline_logic_1.assertLeadCanConvert)({
        resolution: "open",
        isConversionState: true
    }));
    strict_1.default.throws(() => (0, pipeline_logic_1.assertLeadCanConvert)({
        resolution: "converted",
        isConversionState: true
    }), /Solo se pueden convertir leads abiertos/);
    strict_1.default.throws(() => (0, pipeline_logic_1.assertLeadCanConvert)({
        resolution: "open",
        isConversionState: false
    }), /estado convertible/);
});
run("task execution computes state transition and terminal closure for opportunities", () => {
    const result = (0, pipeline_logic_1.buildTaskTransitionResult)({
        entityType: "opportunity",
        currentStateId: "state-contrato",
        taskStateId: "state-contrato",
        targetStateId: "state-ingreso",
        targetStateCode: "ingreso_cuenta",
        targetStateIsTerminal: true,
        currentResolution: "open"
    });
    strict_1.default.equal(result.stateChanged, true);
    strict_1.default.equal(result.nextResolution, "won");
    strict_1.default.equal(result.shouldSetClosedAt, true);
    strict_1.default.equal(result.terminalEventType, "won");
});
run("task execution rejects tasks bound to another current state", () => {
    strict_1.default.throws(() => (0, pipeline_logic_1.buildTaskTransitionResult)({
        entityType: "lead",
        currentStateId: "state-en-contacto",
        taskStateId: "state-nda",
        targetStateId: "state-nda",
        targetStateCode: "nda",
        targetStateIsTerminal: false,
        currentResolution: "open"
    }), /estado actual del lead/);
});
run("terminal closure helpers map discarded and won states correctly", () => {
    strict_1.default.equal((0, pipeline_logic_1.getLeadResolutionForState)("descartado", true), "discarded");
    strict_1.default.equal((0, pipeline_logic_1.getLeadResolutionForState)("nda", false), "open");
    strict_1.default.equal((0, pipeline_logic_1.getOpportunityResolutionForState)("descartado", true), "lost");
    strict_1.default.equal((0, pipeline_logic_1.getOpportunityResolutionForState)("ingreso_cuenta", true), "won");
    strict_1.default.equal((0, pipeline_logic_1.getTerminalPipelineEventType)({
        entityType: "lead",
        stateCode: "descartado",
        isTerminal: true
    }), "discarded");
    strict_1.default.equal((0, pipeline_logic_1.getTerminalPipelineEventType)({
        entityType: "opportunity",
        stateCode: "ingreso_cuenta",
        isTerminal: true
    }), "won");
});
run("manual state changes only allow adjacent moves or discarded", () => {
    strict_1.default.equal((0, pipeline_logic_1.isAllowedManualStateChange)({
        currentStateId: "state-documentacion",
        currentPreviousStateId: "state-en-contacto",
        targetStateId: "state-nda",
        targetPreviousStateId: "state-documentacion",
        targetCode: "nda"
    }), true);
    strict_1.default.equal((0, pipeline_logic_1.isAllowedManualStateChange)({
        currentStateId: "state-documentacion",
        currentPreviousStateId: "state-en-contacto",
        targetStateId: "state-descartado",
        targetPreviousStateId: null,
        targetCode: "descartado"
    }), true);
    strict_1.default.equal((0, pipeline_logic_1.isAllowedManualStateChange)({
        currentStateId: "state-en-contacto",
        currentPreviousStateId: "state-pendiente",
        targetStateId: "state-contrato",
        targetPreviousStateId: "state-pagina-web",
        targetCode: "contrato"
    }), false);
});
console.log("All pipeline logic tests passed");
