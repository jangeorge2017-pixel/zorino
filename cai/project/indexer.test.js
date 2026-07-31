const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { buildIndex } = require("./indexer");

test("reuses unchanged file analysis in the persistent project index", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "cai-indexer-"));
    const file = path.join(root, "app", "page.tsx");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "export default function Page() {}", "utf8");
    const workspace = { root, name: "test" };
    try {
        const first = buildIndex({ files: [file], folders: [root, path.dirname(file)] }, workspace);
        const second = buildIndex({ files: [file], folders: [root, path.dirname(file)] }, workspace);
        assert.equal(first.metrics.analyzedFiles, 1);
        assert.equal(second.metrics.reusedFiles, 1);
        assert.deepEqual(second.intelligence.pages, [path.join("app", "page.tsx")]);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
