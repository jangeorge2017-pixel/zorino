const fs = require("fs");
const path = require("path");
const { resolveWorkspaceFile } = require("../project/path-resolver");

function splitArguments(input) {
    const values = [];
    const pattern = /"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|(\S+)/g;
    let match;
    while ((match = pattern.exec(input))) values.push((match[1] ?? match[2] ?? match[3]).replace(/\\(["'\\nrt])/g, (_, character) => ({ n: "\n", r: "\r", t: "\t" }[character] || character)));
    return values;
}

function createBackup(workspaceRoot, relativePath, content) {
    const directory = path.join(workspaceRoot, ".cai", "backups");
    fs.mkdirSync(directory, { recursive: true });
    const name = relativePath.replace(/[\\/:]/g, "__") + "." + Date.now() + ".bak";
    const backup = path.join(directory, name);
    fs.writeFileSync(backup, content, "utf8");
    return path.relative(workspaceRoot, backup).replace(/\\/g, "/");
}

function parseRequest(command) {
    const input = command.replace(/^patch\s*/i, "").trim();
    const parts = splitArguments(input);
    const [action, target, ...argumentsList] = parts;
    return { action: action?.toLowerCase(), target, argumentsList, dryRun: argumentsList.includes("--dry-run") };
}

function patchCommand(context) {
    const request = parseRequest(context.command);
    if (!request.action || !request.target) {
        return { success: false, message: "Usage: patch replace <file> <search> <replacement> [--dry-run]; patch insert <file> <text>; or patch delete <file> <search>." };
    }
    if (!["replace", "insert", "delete"].includes(request.action)) {
        return { success: false, message: "Unsupported patch action: " + request.action };
    }

    const target = resolveWorkspaceFile(context.workspace, request.target);
    if (!target) return { success: false, message: "Patch target was not found in the workspace: " + request.target };

    const values = request.argumentsList.filter((value) => value !== "--dry-run");
    const source = fs.readFileSync(target.absolutePath, "utf8");
    let updated = source;
    let replacements = 0;
    if (request.action === "replace") {
        const [search, replacement] = values;
        if (values.length !== 2 || !search) return { success: false, message: "Replace requires exactly one search string and one replacement string." };
        replacements = source.split(search).length - 1;
        if (replacements !== 1) return { success: false, message: "Replace requires exactly one matching occurrence; found " + replacements + "." };
        updated = source.replace(search, replacement);
    } else if (request.action === "delete") {
        const [search] = values;
        if (values.length !== 1 || !search) return { success: false, message: "Delete requires exactly one search string." };
        replacements = source.split(search).length - 1;
        if (replacements !== 1) return { success: false, message: "Delete requires exactly one matching occurrence; found " + replacements + "." };
        updated = source.replace(search, "");
    } else {
        const [text] = values;
        if (values.length !== 1 || !text) return { success: false, message: "Insert requires exactly one text value." };
        updated = source + (source.endsWith("\n") ? "" : "\n") + text + "\n";
        replacements = 1;
    }

    if (updated === source) return { success: false, message: "Patch produced no change." };
    const result = { success: true, action: request.action, file: target.relativePath.replace(/\\/g, "/"), replacements, changedCharacters: Math.abs(updated.length - source.length), dryRun: request.dryRun };
    if (request.dryRun) return result;

    result.backup = createBackup(context.workspace.root, result.file, source);
    fs.writeFileSync(target.absolutePath, updated, "utf8");
    const verified = fs.readFileSync(target.absolutePath, "utf8") === updated;
    if (!verified) return { success: false, message: "Patch write verification failed. Backup: " + result.backup };
    console.log("[Patch]", JSON.stringify(result));
    return result;
}

module.exports = patchCommand;
module.exports.parseRequest = parseRequest;
