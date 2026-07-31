const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { normalizePathInput, resolveWorkspaceFile } = require("./path-resolver");

async function openFile(workspace, keyword, options = {}) {
    let target = resolveWorkspaceFile(workspace, keyword);

    if (!target) {
        const indexFile = path.join(workspace.root, "cai", "data", "index.json");
        if (!fs.existsSync(indexFile)) {
            console.error("[Open] Project index not found. Run: scan");
            return { success: false, message: "Project index not found." };
        }

        let index;
        try {
            index = JSON.parse(fs.readFileSync(indexFile, "utf8"));
        } catch (error) {
            console.error("[Open] Could not read project index: " + error.message);
            return { success: false, message: "Could not read project index." };
        }

        const normalizedKeyword = normalizePathInput(keyword)
            .split(path.sep).join("/").toLowerCase();
        const match = (index.files || []).find((file) => {
            const filePath = String(file.path || "").replace(/[\\/]+/g, "/").toLowerCase();
            const fileName = String(file.name || "").toLowerCase();
            return filePath.includes(normalizedKeyword) || fileName.includes(normalizedKeyword);
        });

        if (!match || !(target = resolveWorkspaceFile(workspace, match.path))) {
            console.error("[Open] File not found: " + keyword);
            return { success: false, message: "File not found." };
        }
    }

    return openInEditor(target, options);
}

function openInEditor(target, options = {}) {
    console.log("\nOpening:\n" + target.relativePath + "\n");
    const launch = options.launch || launchEditor;

    return launch(target.absolutePath).then(() => {
        if (options.workspace) {
            options.workspace.setCurrentFile(target);
        }
        return { success: true, file: target.relativePath };
    }).catch((error) => {
        const message = "Failed to open file: " + error.message;
        console.error("[Open] " + message);
        return { success: false, message, file: target.relativePath };
    });
}

function launchEditor(filePath) {
    const command = resolveEditorCommand();

    if (!command) {
        return Promise.reject(new Error("VS Code CLI (code.cmd) is not installed."));
    }

    const launch = () => new Promise((resolve, reject) => {
        const executable = process.platform === "win32" ? (process.env.ComSpec || "cmd.exe") : command;
        const args = process.platform === "win32"
            ? ["/d", "/s", "/c", "call \"" + command + "\" \"" + filePath + "\""]
            : [filePath];
        const child = spawn(executable, args, {
            shell: false,
            stdio: "ignore",
            windowsHide: true
        });

        child.once("error", reject);
        // VS Code normally remains running. Waiting for `close` therefore
        // blocks CAI even though the editor accepted the open request.
        child.once("spawn", resolve);
    });

    return launch();
}

function resolveEditorCommand() {
    if (process.platform !== "win32") {
        return "code";
    }

    const candidates = [
        process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Programs", "Microsoft VS Code", "bin", "code.cmd"),
        process.env.ProgramFiles && path.join(process.env.ProgramFiles, "Microsoft VS Code", "bin", "code.cmd"),
        process.env["ProgramFiles(x86)"] && path.join(process.env["ProgramFiles(x86)"], "Microsoft VS Code", "bin", "code.cmd")
    ].filter(Boolean);

    return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

module.exports = { openFile, openInEditor, launchEditor, resolveEditorCommand };
