function buildAnalysisPrompt(analysis) {
    const startedAt = performance.now();
    if (!analysis) {
        return { prompt: "No project analysis is available.", metrics: { promptBuildMs: 0, promptCharacters: 33 } };
    }

    // Keep the reasoning payload compact: all detailed project discovery stays local.
    const lines = [
        "Analyze this " + analysis.framework + " project.",
        "Files " + analysis.totalFiles + "; TS " + analysis.typescript + "; JS " + analysis.javascript + "; React " + analysis.react + ".",
        "Pages " + analysis.pages + "; layouts " + analysis.layouts + "; components " + analysis.components + "; API routes " + analysis.apiRoutes + "; services " + analysis.services + ".",
        "Return architecture, key risks, and one highest-value next step."
    ];
    const prompt = lines.join("\n");
    return {
        prompt,
        metrics: {
            promptBuildMs: Number((performance.now() - startedAt).toFixed(2)),
            promptCharacters: prompt.length
        }
    };
}

module.exports = { buildAnalysisPrompt };
