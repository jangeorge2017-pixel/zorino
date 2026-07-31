const { getState } = require("./state");

function startSession(workspace) {

    const state = getState();

    state.workspace = workspace.root;
    state.project = workspace.name;

    state.currentFeature = null;
    state.currentFile = null;

    state.selectedFiles = [];
    state.openedFiles = [];

    state.recentCommands = [];

    state.lastPlan = null;
    state.lastAnalysis = null;
    state.lastScan = null;
    state.lastSearch = null;

    state.flags.busy = false;

    return state;

}

function getSession() {
    return getState();
}

function endSession() {

    const state = getState();

    state.currentFeature = null;
    state.currentFile = null;

    state.selectedFiles = [];
    state.openedFiles = [];

    state.recentCommands = [];

}

module.exports = {
    startSession,
    getSession,
    endSession
};