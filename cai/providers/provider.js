const config = require("../config/config").providers;
const OllamaProvider = require("./ollama");
const LlamaCppProvider = require("./llamacpp");

class ProviderManager {
    constructor(settings = config, options = {}) {
        this.settings = settings;
        const factories = options.factories || {
            ollama: () => new OllamaProvider(settings.ollama),
            llamacpp: () => new LlamaCppProvider({ config: settings.llamacpp })
        };
        this.providers = Object.fromEntries(Object.entries(factories).map(([name, factory]) => [name, factory()]));
        this.activeName = null;
    }

    candidates() {
        return [...new Set([this.settings.default, ...(this.settings.fallbackOrder || [])])]
            .filter((name) => this.settings[name]?.enabled !== false && this.providers[name]);
    }

    async resolve() {
        for (const name of this.candidates()) {
            const provider = this.providers[name];
            if (await provider.isAvailable()) {
                if (this.activeName !== name) console.log("[Provider] Active provider:", name);
                this.activeName = name;
                return provider;
            }
            console.warn("[Provider] Unavailable:", name);
        }
        throw new Error("No configured provider is available. Check CAI_PROVIDER and provider configuration.");
    }

    async ask(prompt, options) {
        const tried = new Set();
        while (tried.size < this.candidates().length) {
            const provider = await this.resolve();
            tried.add(this.activeName);
            try {
                return await provider.ask(prompt, options);
            } catch (error) {
                // A runtime connectivity failure may occur after availability
                // checking; try the next configured provider once.
                console.warn("[Provider] " + this.activeName + " failed: " + error.message);
                this.settings = { ...this.settings, default: this.candidates().find((name) => !tried.has(name)) };
                if (!this.settings.default) throw error;
            }
        }
        throw new Error("All configured providers failed.");
    }

    getActiveName() { return this.activeName; }

    async getStatus() {
        const status = {};
        for (const [name, provider] of Object.entries(this.providers)) {
            status[name] = {
                ...(typeof provider.getStatus === "function" ? provider.getStatus() : { id: name }),
                available: await provider.isAvailable()
            };
        }
        return { active: this.activeName, providers: status };
    }
}

const provider = new ProviderManager();
module.exports = provider;
module.exports.ProviderManager = ProviderManager;
