const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { readProjectMemory, recordRun, memoryFile } = require("./project-memory");

test("project memory persists bounded command history outside the project index", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "cai-memory-"));
    try {
        assert.deepEqual(readProjectMemory(root).history, []);
        recordRun(root, { command: "scan", success: true, plan: { action: "scan" }, timestamp: "2026-01-01T00:00:00.000Z" });
        const memory = readProjectMemory(root);
        assert.equal(memory.history.length, 1);
        assert.deepEqual(memory.history[0], { command: "scan", success: true, action: "scan", timestamp: "2026-01-01T00:00:00.000Z" });
        assert.equal(fs.existsSync(memoryFile(root)), true);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
