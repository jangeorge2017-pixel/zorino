const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { analyzeProject } = require("./analyzer");

test("analyzer detects real Next.js project structure from the current index", () => {
    const root = path.resolve(__dirname, "..", "..");
    const originalLog = console.log;
    console.log = () => {};
    try {
        const report = analyzeProject({ root });
        assert.ok(report, "real project index should be readable");
        assert.equal(report.framework, "Next.js");
        assert.ok(report.pages > 0, "should detect app pages");
        assert.ok(report.layouts > 0, "should detect app layouts");
        assert.ok(report.components > 0, "should detect components");
    } finally {
        console.log = originalLog;
    }
});
