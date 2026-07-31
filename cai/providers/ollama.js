const Provider = require("./base");

class OllamaProvider extends Provider {
    constructor(config, options = {}) {
        super({ id: "ollama", model: config.model });
        this.config = config;
        this.createClient = options.createClient || ((settings) => new (require("ollama").Ollama)(settings));
        this.client = null;
    }

    getClient() {
        if (!this.client) {
            this.client = this.createClient({ host: this.config.host });
        }
        return this.client;
    }

    async isAvailable() {
        try {
            const response = await this.getClient().list();
            return (response.models || []).some((model) => model.name === this.config.model || model.model === this.config.model);
        } catch {
            return false;
        }
    }

    async ask(prompt) {
        if (typeof prompt !== "string" || !prompt.trim()) {
            throw new Error("Provider prompt must be a non-empty string.");
        }

        const startedAt = performance.now();
        let firstTokenAt = null;
        let response = "";
        let finalPart = null;
        let stream;
        let timedOut = false;
        const timer = setTimeout(() => {
            timedOut = true;
            stream?.abort?.();
        }, this.config.promptTimeoutMs);

        try {
            console.log("[Ollama] Calling generate for", this.config.model + "...");
            stream = await this.getClient().generate({
                model: this.config.model,
                prompt,
                stream: true,
                keep_alive: this.config.keepAlive,
                options: {
                    num_ctx: this.config.contextSize,
                    num_batch: this.config.batchSize,
                    num_predict: this.config.maxTokens,
                    temperature: this.config.temperature
                }
            });

            for await (const part of stream) {
                if (firstTokenAt === null && part.response) firstTokenAt = performance.now();
                response += part.response || "";
                if (part.done) finalPart = part;
            }

            if (timedOut) throw new Error("Ollama prompt timed out after " + this.config.promptTimeoutMs + "ms.");

            this.lastMetrics = {
                provider: "ollama",
                model: this.config.model,
                promptCharacters: prompt.length,
                promptTokens: finalPart?.prompt_eval_count ?? null,
                loadMs: finalPart ? Math.round(finalPart.load_duration / 1e6) : null,
                promptEvalMs: finalPart ? Math.round(finalPart.prompt_eval_duration / 1e6) : null,
                firstTokenMs: firstTokenAt === null ? null : Math.round(firstTokenAt - startedAt),
                generatedTokens: finalPart?.eval_count ?? null,
                generationMs: finalPart ? Math.round(finalPart.eval_duration / 1e6) : null,
                totalMs: Math.round(performance.now() - startedAt)
            };
            console.log("[Ollama] Metrics:", JSON.stringify(this.lastMetrics));
            return response;
        } finally {
            clearTimeout(timer);
        }
    }
}

module.exports = OllamaProvider;
