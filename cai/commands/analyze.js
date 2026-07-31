const { analyzeProject } = require("../project/analyzer");
const { buildAnalysisPrompt, getState } = require("../context/context");
const provider = require("../providers/provider");

async function analyzeCommand(context) {
    const startedAt = performance.now();
    console.log("\nAnalyzing project...\n");
    const analysis = analyzeProject(context.workspace);
    if (!analysis) return { success: false, message: "Project analysis could not be created." };

    getState().lastAnalysis = analysis;
    const builtPrompt = buildAnalysisPrompt(analysis);
    console.log("[Analyze] Pipeline metrics:", JSON.stringify({
        analyzer: analysis.metrics,
        prompt: builtPrompt.metrics,
        beforeProviderMs: Number((performance.now() - startedAt).toFixed(2))
    }));
    console.log("Thinking...\n");
    // Project analysis is independent of chat history. Resetting history keeps
    // repeated analyses from growing the evaluated prompt window.
    const response = await provider.ask(builtPrompt.prompt, { resetHistory: true });
    console.log(response + "\n");
    console.log("[Analyze] Total execution ms:", Number((performance.now() - startedAt).toFixed(2)));
    return response;
}

module.exports = analyzeCommand;
