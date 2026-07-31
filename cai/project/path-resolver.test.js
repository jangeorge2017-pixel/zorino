const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createPlan } = require("../planner/planner");
const { resolveWorkspaceFile } = require("./path-resolver");
const { openFile } = require("./opener");

function withWorkspace(callback) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "cai-path-resolver-"));
    const directTarget = path.join(root, "src", "app", "page.tsx");
    const indexTarget = path.join(root, "cai", "data", "index.json");
    fs.mkdirSync(path.dirname(directTarget), { recursive: true });
    fs.mkdirSync(path.dirname(indexTarget), { recursive: true });
    fs.writeFileSync(directTarget, "export default function Page() {}", "utf8");
    fs.writeFileSync(indexTarget, JSON.stringify({ files: [
        { path: path.join("src", "app", "page.tsx"), name: "page.tsx" },
        { path: path.join("cai", "data", "index.json"), name: "index.json" }
    ] }), "utf8");

    const workspace = {
        root,
        name: path.basename(root),
        project: null,
        currentFile: null,
        getProject() { return this.project; },
        getIndex() { return null; },
        setCurrentFile(file) { this.currentFile = file; }
    };

    try { return callback(workspace, { directTarget, indexTarget }); }
    finally { fs.rmSync(root, { recursive: true, force: true }); }
}

test("resolves existing workspace files with both separator styles", () => withWorkspace((workspace, targets) => {
    const result = resolveWorkspaceFile(workspace, "src/app/page.tsx");
    assert.ok(result);
    assert.equal(result.absolutePath, targets.directTarget);
    assert.equal(resolveWorkspaceFile(workspace, "src\\app\\page.tsx").absolutePath, targets.directTarget);
}));

test("rejects missing files and paths outside the workspace", () => withWorkspace((workspace) => {
    assert.equal(resolveWorkspaceFile(workspace, "src/app/missing.tsx"), null);
    assert.equal(resolveWorkspaceFile(workspace, "../outside.tsx"), null);
}));

test("existing paths always plan as open and never as provider ask", () => withWorkspace((workspace) => {
    for (const input of ["src/app/page.tsx", "cai/data/index.json"]) {
        const plan = createPlan(input, workspace);
        assert.equal(plan.action, "open", input);
        assert.ok(plan.fileTarget, input);
        assert.equal(plan.steps.some((step) => step.type === "scan"), false, input);
    }
    assert.equal(createPlan("unmatched natural language request", workspace).action, "ask");
}));

test("a path-shaped request stays local even when the file is missing", () => withWorkspace((workspace) => {
    const plan = createPlan("src/app/missing-page.tsx", workspace);
    assert.equal(plan.action, "open");
    assert.equal(plan.fileTarget, null);
    assert.match(plan.pipeline[0].reason, /must not invoke the provider/);
}));

test("an indexed search happens before the provider fallback", () => withWorkspace((workspace) => {
    const plan = createPlan("page", workspace);
    assert.equal(plan.action, "find");
    assert.equal(plan.searchQuery, "page");
}));

test("open launches an existing file and records a successful result", async () => withWorkspace(async (workspace, targets) => {
    let launchedPath;
    const result = await openFile(workspace, "src/app/page.tsx", {
        workspace,
        launch: async (filePath) => { launchedPath = filePath; }
    });
    assert.deepEqual(result, { success: true, file: path.join("src", "app", "page.tsx") });
    assert.equal(launchedPath, targets.directTarget);
    assert.equal(workspace.currentFile.absolutePath, targets.directTarget);
}));
