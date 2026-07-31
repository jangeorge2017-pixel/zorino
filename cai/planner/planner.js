const { resolveWorkspaceFile, looksLikeWorkspacePath } = require("../project/path-resolver");
const { getIndexedMatches } = require("../project/finder");

function createPlan(command, workspace) {
    if (typeof command !== "string") {
        throw new TypeError("Planner command must be a string.");
    }

    console.log("[Planner] Project =", workspace.getProject());

    const parts = command.trim().split(/\s+/);
    let action = parts[0].toLowerCase();
    let fileTarget = null;
    let searchQuery = null;
    const pipeline = [{
        stage: "intent-detection",
        input: command,
        decision: null,
        reason: null
    }];
    const builtInCommands = new Set([
        "help", "ask", "find", "open", "analyze", "plan", "workspace",
        "project", "scan", "patch", "refactor", "trace", "review", "memory", "git", "doctor", "exit", "quit"
    ]);

    // A real workspace file always wins, even if its path begins with a command.
    fileTarget = resolveWorkspaceFile(workspace, command);
    if (fileTarget) {
        action = "open";
        pipeline[0].decision = "open";
        pipeline[0].reason = "Input resolves to an existing workspace file.";
    } else if (looksLikeWorkspacePath(command)) {
        // A path-shaped request is always handled locally. Returning a clear
        // Open error is safer and more predictable than sending a typo or a
        // wrongly rooted path to the LLM.
        action = "open";
        pipeline[0].decision = "open";
        pipeline[0].reason = "Input is a workspace path; it must not invoke the provider.";
    } else if (!builtInCommands.has(action)) {
        const matches = getIndexedMatches(workspace, command);
        if (matches && matches.length > 0) {
            action = "find";
            searchQuery = command;
            pipeline[0].decision = "find";
            pipeline[0].reason = "Indexed local files match the input.";
        } else {
            action = "ask";
            pipeline[0].decision = "ask";
            pipeline[0].reason = "No local file, command, or indexed match was found.";
        }
    } else {
        pipeline[0].decision = action;
        pipeline[0].reason = "Recognized local command.";
    }

    const plan = {
        command,
        action,
        fileTarget,
        searchQuery,
        pipeline,
        workspace: workspace.name,
        project: workspace.getProject(),
        index: workspace.getIndex(),
        steps: [],
        createdAt: new Date().toISOString()
    };

    const needsIndex = action === "find" || action === "analyze";
    if (!workspace.getProject() && needsIndex) {
        plan.steps.push({ type: "scan", description: "Load project" });
    }

    switch (action) {
        case "scan":
            plan.steps.push({ type: "scan", description: "Scan project" });
            break;
        case "patch":
            plan.steps.push({ type: "execute", description: "Validate, back up, apply, and verify patch" });
            break;
        case "refactor":
            plan.steps.push({ type: "impact", description: "Analyze impact" });
            plan.steps.push({ type: action, description: "Refactor code" });
            plan.steps.push({ type: "verify", description: "Verify refactor" });
            break;
        default:
            plan.steps.push({ type: "execute", description: "Execute command" });
            break;
    }

    return plan;
}

module.exports = { createPlan };
