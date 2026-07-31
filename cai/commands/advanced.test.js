const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const trace = require("./trace");
const review = require("./review");
const patchCommand = require("./patch");

function createWorkspace() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "cai-commands-"));
    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    fs.mkdirSync(path.join(root, "cai", "data"), { recursive: true });
    fs.mkdirSync(path.join(root, ".next-local"), { recursive: true });
    fs.writeFileSync(path.join(root, "src", "page.tsx"), "// TODO: replace\nexport const page = 1;", "utf8");
    fs.writeFileSync(path.join(root, ".next-local", "generated.js"), "eval('generated');", "utf8");
    fs.writeFileSync(path.join(root, "cai", "data", "index.json"), JSON.stringify({
        files: [
            { path: "src/page.tsx", imports: ["./widget"], exports: ["page"] },
            { path: ".next-local/generated.js", imports: [], exports: [] }
        ],
        dependencies: { "./page": ["src/widget.tsx"] }
    }), "utf8");
    return root;
}

test("trace resolves an indexed workspace file locally", () => {
    const root = createWorkspace();
    try {
        const result = trace({ command: "trace src/page.tsx", workspace: { root } });
        assert.equal(result.success, true);
        assert.equal(result.file, "src/page.tsx");
        assert.deepEqual(result.imports, ["./widget"]);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test("review ignores generated output while reporting source findings", () => {
    const root = createWorkspace();
    try {
        const result = review({ workspace: { root } });
        assert.equal(result.success, true);
        assert.equal(result.total, 1);
        assert.deepEqual(result.findings[0], { file: "src/page.tsx", severity: "info", message: "Unresolved TODO/FIXME" });
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test("patch validates, backs up, writes, and verifies a unique workspace edit", () => {
    const root = createWorkspace();
    const target = path.join(root, "src", "page.tsx");
    try {
        const result = patchCommand({ command: 'patch replace src/page.tsx "page = 1" "page = 2"', workspace: { root } });
        assert.equal(result.success, true);
        assert.equal(result.dryRun, false);
        assert.match(fs.readFileSync(target, "utf8"), /page = 2/);
        assert.equal(fs.existsSync(path.join(root, result.backup)), true);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test("patch dry-run and ambiguous replacements do not write", () => {
    const root = createWorkspace();
    const target = path.join(root, "src", "page.tsx");
    const original = fs.readFileSync(target, "utf8");
    try {
        const dryRun = patchCommand({ command: 'patch replace src/page.tsx "page = 1" "page = 2" --dry-run', workspace: { root } });
        const ambiguous = patchCommand({ command: 'patch replace src/page.tsx " " "_"', workspace: { root } });
        assert.equal(dryRun.success, true);
        assert.equal(dryRun.dryRun, true);
        assert.equal(ambiguous.success, false);
        assert.equal(fs.readFileSync(target, "utf8"), original);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
