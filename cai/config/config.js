const path = require("path");

const llamaCpp = {
    modelPath: process.env.CAI_LLAMA_MODEL_PATH || path.join(
        __dirname, "..", "models", "Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf"
    ),
    contextSize: Number(process.env.CAI_CONTEXT_SIZE || 1024),
    gpuLayers: Number(process.env.CAI_GPU_LAYERS || 15),
    batchSize: Number(process.env.CAI_BATCH_SIZE || 128),
    threads: Number(process.env.CAI_THREADS || 4),
    loadTimeoutMs: Number(process.env.CAI_LOAD_TIMEOUT_MS || 120000),
    promptTimeoutMs: Number(process.env.CAI_PROMPT_TIMEOUT_MS || 120000),
    useMmap: true,
    maxTokens: Number(process.env.CAI_MAX_TOKENS || 128),
    temperature: Number(process.env.CAI_TEMPERATURE || 0.2)
};

module.exports = {
    providers: {
        default: process.env.CAI_PROVIDER || "ollama",
        fallbackOrder: ["ollama", "llamacpp"],
        ollama: {
            enabled: true,
            host: process.env.CAI_OLLAMA_HOST || "http://127.0.0.1:11434",
            model: process.env.CAI_OLLAMA_MODEL || "qwen2.5:3b",
            contextSize: Number(process.env.CAI_CONTEXT_SIZE || 1024),
            batchSize: Number(process.env.CAI_BATCH_SIZE || 128),
            promptTimeoutMs: Number(process.env.CAI_PROMPT_TIMEOUT_MS || 120000),
            keepAlive: process.env.CAI_OLLAMA_KEEP_ALIVE || "5m",
            maxTokens: Number(process.env.CAI_MAX_TOKENS || 128),
            temperature: Number(process.env.CAI_TEMPERATURE || 0.2)
        },
        llamacpp: {
            enabled: true,
            model: "Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf",
            ...llamaCpp
        }
    },
    // Compatibility export for the existing optional advanced provider.
    llamaCpp
};
