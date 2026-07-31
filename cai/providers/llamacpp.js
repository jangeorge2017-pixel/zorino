const fs = require("fs");
const config = require("../config/config").llamaCpp;
const Provider = require("./base");

class LlamaCppProvider extends Provider {
    constructor(options = {}) {
        const providerConfig = options.config || config;
        super({ id: "llamacpp", model: providerConfig.model || providerConfig.modelPath });
        this.config = providerConfig;
        this.importModule = options.importModule || (() => import("node-llama-cpp"));
        this.llama = null;
        this.model = null;
        this.context = null;
        this.session = null;
        this.loaded = false;
        this.loadPromise = null;
        this.promptQueue = Promise.resolve();
    }

    async load() {
        if (this.loaded) {
            return;
        }
        if (!this.loadPromise) {
            this.loadPromise = this.initialize().catch((error) => {
                this.resetResources();
                throw error;
            }).finally(() => {
                this.loadPromise = null;
            });
        }
        return this.loadPromise;
    }

    async isAvailable() {
        return fs.existsSync(this.config.modelPath);
    }

    async initialize() {
        if (!fs.existsSync(this.config.modelPath)) {
            throw new Error("Model file not found: " + this.config.modelPath);
        }

        console.time("[Provider] Total Load");
        try {
            console.log("[Provider] Importing node-llama-cpp...");
            const { getLlama, LlamaChatSession } = await this.importModule();

            console.log("[Provider] Creating Llama...");
            console.time("[Provider] Create Llama");
            this.llama = await getLlama();
            console.timeEnd("[Provider] Create Llama");

            console.log("[Provider] Loading model...");
            console.time("[Provider] Load Model");
            const loadController = new AbortController();
            let loadTimedOut = false;
            let lastProgress = -10;
            const loadTimer = setTimeout(() => {
                loadTimedOut = true;
                loadController.abort(new Error("Provider model load timed out after " + this.config.loadTimeoutMs + "ms."));
            }, this.config.loadTimeoutMs);
            try {
                this.model = await this.llama.loadModel({
                    modelPath: this.config.modelPath,
                    useMmap: this.config.useMmap,
                    gpuLayers: this.config.gpuLayers ?? 0,
                    loadSignal: loadController.signal,
                    onLoadProgress: (progress) => {
                        const percent = Math.floor(progress * 100);
                        if (percent >= lastProgress + 10 || percent === 100) {
                            lastProgress = percent;
                            console.log("[Provider] Model load: " + percent + "%");
                        }
                    }
                });
                if (loadTimedOut) {
                    throw new Error("Provider model load timed out after " + this.config.loadTimeoutMs + "ms.");
                }
            } finally {
                clearTimeout(loadTimer);
                console.timeEnd("[Provider] Load Model");
            }

            console.log("[Provider] Creating context (" + this.config.contextSize + " tokens)...");
            console.time("[Provider] Create Context");
            this.context = await this.model.createContext({
                contextSize: this.config.contextSize,
                sequences: 1,
                batchSize: this.config.batchSize,
                threads: this.config.threads
            });
            console.timeEnd("[Provider] Create Context");

            this.session = new LlamaChatSession({ contextSequence: this.context.getSequence() });
            this.loaded = true;
            console.log("[Provider] Runtime:", JSON.stringify({
                gpuLayers: this.model.gpuLayers,
                contextSize: this.context.contextSize,
                batchSize: this.context.batchSize,
                threads: this.context.threads,
                idealThreads: this.context.idealThreads,
                cpuMathCores: this.llama.cpuMathCores
            }));
            console.log("[Provider] Ready.");
        } finally {
            console.timeEnd("[Provider] Total Load");
        }
    }

    ask(prompt, options = {}) {
        const job = this.promptQueue.then(() => this.askNow(prompt, options));
        // Keep the session serialized without permanently poisoning the queue.
        this.promptQueue = job.catch(() => undefined);
        return job;
    }

    async askNow(prompt, options = {}) {
        if (typeof prompt !== "string" || !prompt.trim()) {
            throw new Error("Provider prompt must be a non-empty string.");
        }

        await this.load();
        if (options.resetHistory && typeof this.session.resetChatHistory === "function") {
            this.session.resetChatHistory();
        }
        this.lastMetrics = null;
        const startedAt = performance.now();
        const tokenizationStartedAt = performance.now();
        const promptTokens = typeof this.model.tokenize === "function"
            ? this.model.tokenize(prompt).length
            : null;
        const tokenizationMs = performance.now() - tokenizationStartedAt;
        const historyItems = typeof this.session.getChatHistory === "function"
            ? this.session.getChatHistory().length
            : null;
        let firstTokenAt = null;
        let generatedTokens = 0;
        let tokenCallbacks = 0;
        const controller = new AbortController();
        let timedOut = false;
        const timer = setTimeout(() => {
            timedOut = true;
            controller.abort(new Error("Provider prompt timed out after " + this.config.promptTimeoutMs + "ms."));
        }, this.config.promptTimeoutMs);

        console.log("[Provider] Prompt metrics:", JSON.stringify({
            characters: prompt.length,
            promptTokens,
            tokenizationMs: Number(tokenizationMs.toFixed(2)),
            historyItems,
            contextSize: this.context.contextSize,
            batchSize: this.context.batchSize,
            threads: this.context.threads,
            gpuLayers: this.model.gpuLayers,
            maxTokens: this.config.maxTokens,
            temperature: this.config.temperature
        }));
        console.log("[Provider] Generating response...");
        console.time("[Provider] Inference");
        try {
            console.log("[Provider] Calling session.prompt...");
            const sessionPromptStartedAt = performance.now();
            const response = await this.session.prompt(prompt, {
                maxTokens: this.config.maxTokens,
                temperature: this.config.temperature,
                signal: controller.signal,
                stopOnAbortSignal: true,
                onToken: (tokens) => {
                    if (firstTokenAt === null) {
                        firstTokenAt = performance.now();
                    }
                    generatedTokens += tokens.length;
                    tokenCallbacks++;
                }
            });

            if (timedOut) {
                throw new Error("Provider prompt timed out after " + this.config.promptTimeoutMs + "ms.");
            }

            console.log("[Provider] session.prompt finished.");
            this.lastMetrics = {
                promptTokens,
                generatedTokens,
                tokenCallbacks,
                firstTokenMs: firstTokenAt === null ? null : Math.round(firstTokenAt - startedAt),
                totalMs: Math.round(performance.now() - startedAt),
                tokensPerSecond: firstTokenAt === null || generatedTokens === 0
                    ? 0
                    : Number((generatedTokens / ((performance.now() - firstTokenAt) / 1000)).toFixed(2)),
                beforeSessionPromptMs: Math.round(sessionPromptStartedAt - startedAt),
                sessionPromptMs: Math.round(performance.now() - sessionPromptStartedAt)
            };
            console.log("[Provider] Inference metrics:", JSON.stringify(this.lastMetrics));
            return response;
        } catch (error) {
            console.error("[Provider] Inference failed: " + error.message);
            throw error;
        } finally {
            clearTimeout(timer);
            if (!this.lastMetrics || this.lastMetrics.totalMs === undefined) {
                console.log("[Provider] Inference ended after " + Math.round(performance.now() - startedAt) + "ms" + (firstTokenAt === null ? " before the first token." : "."));
            }
            console.timeEnd("[Provider] Inference");
        }
    }

    resetResources() {
        const dispose = (resource, options) => {
            if (resource && !resource.disposed && typeof resource.dispose === "function") {
                Promise.resolve(resource.dispose(options)).catch(() => undefined);
            }
        };
        dispose(this.session, { disposeSequence: true });
        dispose(this.context);
        dispose(this.model);
        dispose(this.llama);
        this.llama = null;
        this.model = null;
        this.context = null;
        this.session = null;
        this.loaded = false;
    }
}

module.exports = LlamaCppProvider;
