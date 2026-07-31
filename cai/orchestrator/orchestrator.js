const { getCurrentWorkspace } = require("../workspace/current");
const { printOrchestratorReport } = require("./report");
const { createPlan } = require("../planner/planner");
const { executePlan } = require("../executor/executor");
const { recordRun } = require("../memory/project-memory");

function describeFailure(error) {
    const message = error instanceof Error ? error.message : String(error);
    const stage = /^\[Executor\]\s+([^\s]+)\s+failed:/.exec(message)?.[1] || "orchestrator";
    const rootCause = message.replace(/^\[Executor\]\s+[^\s]+\s+failed:\s*/, "");
    const suggestedRecovery = /timed out|timeout/i.test(rootCause)
        ? "Retry after checking the provider or operation timeout."
        : /not found|missing/i.test(rootCause)
            ? "Check the requested path, command arguments, and detected workspace."
            : /provider|ollama|llama/i.test(rootCause)
                ? "Run doctor to verify configured providers, then retry or select the fallback provider."
                : "Review the diagnostic stack, correct the reported input or environment issue, and retry.";
    return { stage, rootCause, suggestedRecovery, diagnostic: error?.stack || message };
}

async function orchestrate(command) {
    const workspace = getCurrentWorkspace();
    workspace.setCurrentCommand(command);
    let result;

    try {
        const plan = createPlan(command, workspace);
        console.log("[Pipeline] Project detection:", workspace.getProject() ? "project found" : "no project found");
        console.log("[Pipeline] Intent:", plan.pipeline[0].decision + " — " + plan.pipeline[0].reason);
        const output = await executePlan(plan, workspace);
        result = { success: true, command, workspace: workspace.name, plan, output, timestamp: new Date().toISOString() };
    } catch (error) {
        const failure = describeFailure(error);
        result = {
            success: false,
            command,
            workspace: workspace.name,
            message: failure.rootCause,
            failure,
            error: failure.diagnostic,
            timestamp: new Date().toISOString()
        };
        console.error("[Orchestrator] " + error.message);
    }

    workspace.setLastResult(result);
    try {
        recordRun(workspace.root, result);
    } catch (error) {
        console.warn("[Memory] Could not persist command history: " + error.message);
    }
    printOrchestratorReport(result);
    return result;
}

module.exports = { orchestrate };
module.exports.describeFailure = describeFailure;
