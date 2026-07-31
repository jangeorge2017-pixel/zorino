const assert = require("node:assert/strict");
const test = require("node:test");
const { getGitSummary } = require("./git");

test("git service rejects unapproved modes without executing a command", () => {
    assert.deepEqual(getGitSummary(process.cwd(), "push"), { success: false, message: "Unsupported git view: push" });
});
