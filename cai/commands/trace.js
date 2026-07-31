const fs = require("fs");
const path = require("path");
const { resolveWorkspaceFile } = require("../project/path-resolver");

function traceCommand(context) {
    const targetInput = context.command.replace(/^trace\s+/i, "").trim();
    const target = resolveWorkspaceFile(context.workspace, targetInput);
    if (!target) return { success: false, message: "Trace target was not found: " + targetInput };

    const indexFile = path.join(context.workspace.root, "cai", "data", "index.json");
    const index = JSON.parse(fs.readFileSync(indexFile, "utf8"));
    const normalizePath = (value) => String(value).replace(/\\/g, "/");
    const relativePath = normalizePath(target.relativePath);
    const file = (index.files || []).find((item) => normalizePath(item.path) === relativePath);
    const importedBy = Object.entries(index.dependencies || {})
        .filter(([specifier]) => String(specifier).includes(path.basename(relativePath, path.extname(relativePath))))
        .flatMap(([, files]) => files);
    const result = { success: true, file: relativePath, imports: file?.imports || [], exports: file?.exports || [], importedBy: [...new Set(importedBy.map(normalizePath))] };
    console.log("[Trace]", JSON.stringify(result, null, 2));
    return result;
}

module.exports = traceCommand;
