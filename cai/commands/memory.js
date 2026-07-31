const { readProjectMemory } = require("../memory/project-memory");

function memoryCommand(context) {
    const memory = readProjectMemory(context.workspace.root);
    const result = { success: true, entries: memory.history.length, recent: memory.history.slice(-10).reverse() };
    console.log("[Memory]", JSON.stringify(result, null, 2));
    return result;
}

module.exports = memoryCommand;
