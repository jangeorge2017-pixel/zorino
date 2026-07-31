const { findFiles } = require("../project/finder");

function findCommand(context) {
    const keyword = context.searchQuery || context.command.split(" ").slice(1).join(" ").trim();

    if (!keyword) {
        console.log("\nUsage:\nfind <keyword>\n");
        return { success: false, message: "Missing search keyword." };
    }

    return findFiles(context.workspace, keyword);
}

module.exports = findCommand;
