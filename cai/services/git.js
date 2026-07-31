const { execFileSync } = require("child_process");

function runGit(root, args) {
    try {
        return { success: true, output: execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim() };
    } catch (error) {
        return { success: false, message: (error.stderr || error.message || "Git command failed.").toString().trim() };
    }
}

function getGitSummary(root, mode = "status") {
    const commands = {
        status: ["status", "--short", "--branch"],
        diff: ["diff", "--stat"],
        log: ["log", "-5", "--oneline"]
    };
    if (!commands[mode]) return { success: false, message: "Unsupported git view: " + mode };
    return { ...runGit(root, commands[mode]), mode };
}

module.exports = { getGitSummary, runGit };
