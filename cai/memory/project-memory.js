const fs = require("fs");
const path = require("path");

const MAX_ENTRIES = 100;

function memoryFile(root) {
    return path.join(root, ".cai", "memory.json");
}

function readProjectMemory(root) {
    try {
        const parsed = JSON.parse(fs.readFileSync(memoryFile(root), "utf8"));
        return { version: 1, history: Array.isArray(parsed.history) ? parsed.history.slice(-MAX_ENTRIES) : [] };
    } catch (error) {
        if (error.code === "ENOENT") return { version: 1, history: [] };
        throw new Error("Could not read project memory: " + error.message);
    }
}

function writeProjectMemory(root, memory) {
    const file = memoryFile(root);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ version: 1, history: memory.history.slice(-MAX_ENTRIES) }, null, 2), "utf8");
}

function recordRun(root, result) {
    const memory = readProjectMemory(root);
    memory.history.push({
        command: result.command,
        success: result.success,
        action: result.plan?.action || null,
        timestamp: result.timestamp
    });
    writeProjectMemory(root, memory);
    return memory;
}

module.exports = { readProjectMemory, recordRun, memoryFile };
