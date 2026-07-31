const fs = require("fs");
const path = require("path");

function normalizePathInput(input) {
    let value = String(input || "").trim();

    if (
        value.length >= 2 &&
        ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'")))
    ) {
        value = value.slice(1, -1);
    }

    return value.replace(/[\\/]+/g, path.sep);
}

function looksLikeWorkspacePath(input) {
    const value = String(input || "").trim();
    if (!value || /\s/.test(value)) {
        return false;
    }

    const normalized = value.replace(/[\\/]+/g, "/");
    return normalized.includes("/") ||
        normalized.startsWith(".") ||
        /\.[A-Za-z0-9_-]+$/.test(normalized);
}

function isWithinWorkspace(workspaceRoot, targetPath) {
    const relativePath = path.relative(workspaceRoot, targetPath);

    return (
        relativePath !== "" &&
        relativePath !== ".." &&
        !relativePath.startsWith(`..${path.sep}`) &&
        !path.isAbsolute(relativePath)
    );
}

function resolveWorkspaceFile(workspace, input) {
    if (!workspace || !workspace.root) {
        return null;
    }

    const candidate = normalizePathInput(input);

    if (!candidate) {
        return null;
    }

    const workspaceRoot = path.resolve(workspace.root);
    const absolutePath = path.resolve(workspaceRoot, candidate);

    if (!isWithinWorkspace(workspaceRoot, absolutePath)) {
        return null;
    }

    try {
        if (!fs.statSync(absolutePath).isFile()) {
            return null;
        }
    } catch {
        return null;
    }

    return {
        absolutePath,
        relativePath: path.relative(workspaceRoot, absolutePath)
    };
}

module.exports = {
    normalizePathInput,
    looksLikeWorkspacePath,
    resolveWorkspaceFile
};
