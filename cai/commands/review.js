const fs = require("fs");
const path = require("path");

const IGNORED_SEGMENTS = new Set(["node_modules", ".git", ".next", ".next-local", "dist", "build", ".turbo"]);
const IGNORED_PREFIXES = ["cai/data/", "cai/models/"];

function shouldReview(relativePath) {
    const normalized = relativePath.replace(/\\/g, "/");
    return !normalized.split("/").some((segment) => IGNORED_SEGMENTS.has(segment))
        && !IGNORED_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function reviewCommand(context) {
    const indexFile = path.join(context.workspace.root, "cai", "data", "index.json");
    if (!fs.existsSync(indexFile)) return { success: false, message: "Project index not found. Run: scan" };
    const index = JSON.parse(fs.readFileSync(indexFile, "utf8"));
    const findings = [];
    for (const file of index.files || []) {
        if (!/\.(js|jsx|ts|tsx)$/i.test(file.path) || !shouldReview(file.path)) continue;
        const absolutePath = path.join(context.workspace.root, file.path);
        try {
            const source = fs.readFileSync(absolutePath, "utf8");
            for (const [pattern, severity, message] of [
                [/\bTODO\b|\bFIXME\b/g, "info", "Unresolved TODO/FIXME"],
                [/console\.log\(/g, "info", "Console logging in source"],
                [/\beval\(/g, "high", "Use of eval"],
                [/catch\s*\{\s*\}/g, "medium", "Empty catch block"]
            ]) {
                if (pattern.test(source)) findings.push({ file: file.path, severity, message });
            }
        } catch (error) {
            console.warn("[Review] Could not read " + file.path + ": " + error.message);
        }
    }
    const result = { success: true, findings, total: findings.length };
    console.log("[Review]", JSON.stringify(result, null, 2));
    return result;
}

module.exports = reviewCommand;
module.exports.shouldReview = shouldReview;
