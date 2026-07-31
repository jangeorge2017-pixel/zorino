const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { detectProjectRoot } = require("./detector");

test("detects an enclosing project when CAI starts from its own directory", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "cai-project-detection-"));
    fs.writeFileSync(path.join(root, "package.json"), "{}", "utf8");
    fs.mkdirSync(path.join(root, "cai"));
    try {
        assert.equal(detectProjectRoot(path.join(root, "cai")), root);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
