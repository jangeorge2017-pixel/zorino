function analyzeImpact(plan) {

    const impact = {
        safe: true,
        level: "low",
        files: [],
        warnings: []
    };

    for (const step of plan.steps) {

        if (step.type === "execute") {
            impact.level = "medium";
        }

        if (step.type === "patch") {
            impact.level = "high";
        }

    }

    return impact;

}

module.exports = {
    analyzeImpact
};