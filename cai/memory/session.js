const { getMemory } = require("./store");

function startSession(workspace) {

    const memory = getMemory();

    memory.workspace = workspace.root;
    memory.project = workspace.name;

    memory.currentFeature = null;
    memory.currentTask = null;
    memory.currentFile = null;

    memory.lastPlan = null;
    memory.lastAnalysis = null;
    memory.lastSearch = null;
    memory.lastOpen = null;

    return memory;

}

function endSession() {

    const memory = getMemory();

    memory.currentFeature = null;
    memory.currentTask = null;
    memory.currentFile = null;

}

function getSession() {

    return getMemory();

}

module.exports = {
    startSession,
    endSession,
    getSession
};