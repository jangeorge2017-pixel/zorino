const askCommand = require("../commands/ask");
const { scanProject } = require("../project/scanner");
const findCommand = require("../commands/find");
const helpCommand = require("../commands/help");
const openCommand = require("../commands/open");
const analyzeCommand = require("../commands/analyze");
const planCommand = require("../commands/plan");
const workspaceCommand = require("../commands/workspace");
const projectCommand = require("../commands/project");
const exitCommand = require("../commands/exit");
const traceCommand = require("../commands/trace");
const reviewCommand = require("../commands/review");
const patchCommand = require("../commands/patch");
const memoryCommand = require("../commands/memory");
const gitCommand = require("../commands/git");
const doctorCommand = require("../commands/doctor");

async function executePlan(plan, workspace) {
    let output = null;
    const context = {
        command: plan.command,
        workspace,
        fileTarget: plan.fileTarget || null,
        searchQuery: plan.searchQuery || null
    };

    for (const step of plan.steps) {
        try {
            switch (step.type) {
                case "scan": output = scanProject(workspace); break;
                case "impact": console.log("Analyzing impact..."); break;
                case "patch": console.log("Applying patch..."); break;
                case "refactor": console.log("Refactoring..."); break;
                case "verify": console.log("Verifying..."); break;
                case "execute": {
                    const commands = {
                        ask: askCommand, find: findCommand, help: helpCommand,
                        open: openCommand, analyze: analyzeCommand, plan: planCommand,
                        workspace: workspaceCommand, project: projectCommand, trace: traceCommand, patch: patchCommand,
                        review: reviewCommand, memory: memoryCommand, git: gitCommand, doctor: doctorCommand, exit: exitCommand
                    };
                    const handler = commands[plan.action];
                    if (!handler) {
                        throw new Error("Unknown command action: " + plan.action);
                    }
                    output = await handler(context);
                    if (output && output.success === false) {
                        throw new Error(output.message || (plan.action + " command failed."));
                    }
                    break;
                }
                default:
                    throw new Error("Unknown plan step: " + step.type);
            }
        } catch (error) {
            error.message = "[Executor] " + step.type + " failed: " + error.message;
            throw error;
        }
    }

    return output;
}

module.exports = { executePlan };
