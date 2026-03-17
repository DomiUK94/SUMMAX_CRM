import assert from "node:assert/strict";
import {
  assertLeadCanConvert,
  buildTaskTransitionResult,
  getLeadResolutionForState,
  getOpportunityResolutionForState,
  getTerminalPipelineEventType,
  isAllowedManualStateChange
} from "../src/lib/db/pipeline-logic";

function run(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

run("lead conversion only works for open leads in conversion state", () => {
  assert.doesNotThrow(() =>
    assertLeadCanConvert({
      resolution: "open",
      isConversionState: true
    })
  );

  assert.throws(
    () =>
      assertLeadCanConvert({
        resolution: "converted",
        isConversionState: true
      }),
    /Solo se pueden convertir leads abiertos/
  );

  assert.throws(
    () =>
      assertLeadCanConvert({
        resolution: "open",
        isConversionState: false
      }),
    /estado convertible/
  );
});

run("task execution computes state transition and terminal closure for opportunities", () => {
  const result = buildTaskTransitionResult({
    entityType: "opportunity",
    currentStateId: "state-contrato",
    taskStateId: "state-contrato",
    targetStateId: "state-ingreso",
    targetStateCode: "ingreso_cuenta",
    targetStateIsTerminal: true,
    currentResolution: "open"
  });

  assert.equal(result.stateChanged, true);
  assert.equal(result.nextResolution, "won");
  assert.equal(result.shouldSetClosedAt, true);
  assert.equal(result.terminalEventType, "won");
});

run("task execution rejects tasks bound to another current state", () => {
  assert.throws(
    () =>
      buildTaskTransitionResult({
        entityType: "lead",
        currentStateId: "state-en-contacto",
        taskStateId: "state-nda",
        targetStateId: "state-nda",
        targetStateCode: "nda",
        targetStateIsTerminal: false,
        currentResolution: "open"
      }),
    /estado actual del lead/
  );
});

run("terminal closure helpers map discarded and won states correctly", () => {
  assert.equal(getLeadResolutionForState("descartado", true), "discarded");
  assert.equal(getLeadResolutionForState("nda", false), "open");
  assert.equal(getOpportunityResolutionForState("descartado", true), "lost");
  assert.equal(getOpportunityResolutionForState("ingreso_cuenta", true), "won");
  assert.equal(
    getTerminalPipelineEventType({
      entityType: "lead",
      stateCode: "descartado",
      isTerminal: true
    }),
    "discarded"
  );
  assert.equal(
    getTerminalPipelineEventType({
      entityType: "opportunity",
      stateCode: "ingreso_cuenta",
      isTerminal: true
    }),
    "won"
  );
});

run("manual state changes only allow adjacent moves or discarded", () => {
  assert.equal(
    isAllowedManualStateChange({
      currentStateId: "state-documentacion",
      currentPreviousStateId: "state-en-contacto",
      targetStateId: "state-nda",
      targetPreviousStateId: "state-documentacion",
      targetCode: "nda"
    }),
    true
  );

  assert.equal(
    isAllowedManualStateChange({
      currentStateId: "state-documentacion",
      currentPreviousStateId: "state-en-contacto",
      targetStateId: "state-descartado",
      targetPreviousStateId: null,
      targetCode: "descartado"
    }),
    true
  );

  assert.equal(
    isAllowedManualStateChange({
      currentStateId: "state-en-contacto",
      currentPreviousStateId: "state-pendiente",
      targetStateId: "state-contrato",
      targetPreviousStateId: "state-pagina-web",
      targetCode: "contrato"
    }),
    false
  );
});

console.log("All pipeline logic tests passed");
