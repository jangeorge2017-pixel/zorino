const assert = require("node:assert/strict");
const test = require("node:test");
const { ProviderManager } = require("./provider");
const Provider = require("./base");

function settings(defaultProvider = "ollama") {
    return {
        default: defaultProvider,
        fallbackOrder: ["ollama", "llamacpp"],
        ollama: { enabled: true },
        llamacpp: { enabled: true }
    };
}

test("uses the configured default provider", async () => {
    const manager = new ProviderManager(settings(), { factories: {
        ollama: () => ({ isAvailable: async () => true, ask: async () => "ollama" }),
        llamacpp: () => ({ isAvailable: async () => true, ask: async () => "llama" })
    }});
    assert.equal(await manager.ask("test"), "ollama");
    assert.equal(manager.getActiveName(), "ollama");
});

test("falls back when the configured provider is unavailable", async () => {
    const manager = new ProviderManager(settings(), { factories: {
        ollama: () => ({ isAvailable: async () => false, ask: async () => "never" }),
        llamacpp: () => ({ isAvailable: async () => true, ask: async () => "llama" })
    }});
    assert.equal(await manager.ask("test"), "llama");
    assert.equal(manager.getActiveName(), "llamacpp");
});

test("provider contract exposes stable identity and metrics", () => {
    const provider = new Provider({ id: "test", model: "model" });
    assert.deepEqual(provider.getStatus(), { id: "test", model: "model", metrics: null });
});
