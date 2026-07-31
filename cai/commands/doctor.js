const fs = require("fs");
const path = require("path");
const provider = require("../providers/provider");

async function doctorCommand(context) {
    const indexFile = path.join(context.workspace.root, "cai", "data", "index.json");
    const checks = {
        projectDetected: Boolean(context.workspace.getProject()),
        workspaceReadable: fs.existsSync(context.workspace.root),
        indexPresent: fs.existsSync(indexFile),
        provider: await provider.getStatus()
    };
    const available = Object.values(checks.provider.providers).some((item) => item.available);
    const result = { success: checks.projectDetected && checks.workspaceReadable && available, checks };
    console.log("[Doctor]", JSON.stringify(result, null, 2));
    return result;
}

module.exports = doctorCommand;
