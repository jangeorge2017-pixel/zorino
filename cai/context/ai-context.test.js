const assert = require("node:assert/strict");
const test = require("node:test");
const { buildAnalysisPrompt } = require("./ai-context");

test("builds a compact local analysis prompt", () => {
    const result = buildAnalysisPrompt({
        framework: "Next.js", totalFiles: 1189, typescript: 521, javascript: 124,
        react: 205, pages: 40, layouts: 3, components: 204, apiRoutes: 14, services: 46
    });
    assert.equal(result.metrics.promptCharacters, result.prompt.length);
    assert.ok(result.prompt.length < 250);
    assert.match(result.prompt, /architecture, key risks/i);
});
