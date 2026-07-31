function printOrchestratorReport(info) {
    console.log("\n====== ORCHESTRATOR REPORT ======\n");
    if (info.project) console.log("Project :", info.project);
    if (info.command) console.log("Command :", info.command);
    console.log("Status  :", info.success ? "Success" : "Failed");
    if (info.message) console.log("Message :", info.message);
    if (info.failure) {
        console.log("Stage   :", info.failure.stage);
        console.log("Cause   :", info.failure.rootCause);
        console.log("Recovery:", info.failure.suggestedRecovery);
    }
    console.log("\n======== END OF REPORT =========\n");
}

module.exports = { printOrchestratorReport };
