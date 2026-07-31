const assert = require("node:assert/strict");
const test = require("node:test");
const LlamaCppProvider = require("./llamacpp");

function createProvider(prompt) {
    let imports = 0;
    class FakeSession {
        constructor() {}
        prompt(value, options) { return prompt(value, options); }
    }
    const provider = new LlamaCppProvider({
        config: {
            modelPath: __filename,
            contextSize: 512,
            loadTimeoutMs: 100,
            promptTimeoutMs: 25,
            useMmap: true,
            maxTokens: 8,
            temperature: 0
        },
        importModule: async () => {
            imports++;
            return {
                getLlama: async () => ({
                    loadModel: async () => ({
                        createContext: async () => ({ getSequence: () => ({}) })
                    })
                }),
                LlamaChatSession: FakeSession
            };
        }
    });
    return { provider, imports: () => imports };
}

test("provider performs concurrent initialization only once", async () => {
    const fixture = createProvider(async () => "ok");
    await Promise.all([fixture.provider.load(), fixture.provider.load(), fixture.provider.load()]);
    assert.equal(fixture.imports(), 1);
    assert.equal(fixture.provider.loaded, true);
});

test("provider aborts a prompt that exceeds its configured timeout", async () => {
    const fixture = createProvider((_value, options) => new Promise((resolve, reject) => {
        options.signal.addEventListener("abort", () => reject(options.signal.reason));
    }));
    await assert.rejects(fixture.provider.ask("wait forever"), /timed out after 25ms/);
});
