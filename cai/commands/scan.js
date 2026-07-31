const { scanProject } = require("../project/scanner");

function scanCommand(context) {
    const index = scanProject(context.workspace);
    return { success: true, files: index.files.length, folders: index.folders.length, metrics: index.metrics, intelligence: index.intelligence };
}

module.exports = scanCommand;
