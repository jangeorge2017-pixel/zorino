const { getGitSummary } = require("../services/git");

function gitCommand(context) {
    const mode = context.command.split(/\s+/)[1]?.toLowerCase() || "status";
    const result = getGitSummary(context.workspace.root, mode);
    if (result.success) console.log("[Git] " + mode + "\n" + (result.output || "Working tree is clean."));
    return result;
}

module.exports = gitCommand;
