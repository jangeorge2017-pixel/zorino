const { openFile } = require("../project/opener");

async function openCommand(context) {
    const keyword = context.fileTarget
        ? context.fileTarget.relativePath
        : context.command.replace(/^open\s+/i, "").trim();

    if (!keyword) {
        console.log("\nUsage:\nopen <keyword>\n");
        return { success: false, message: "Missing file target." };
    }

    return openFile(context.workspace, keyword, { workspace: context.workspace });
}

module.exports = openCommand;
