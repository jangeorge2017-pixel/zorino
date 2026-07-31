const state = {

    workspace: null,

    project: null,

    currentFeature: null,

    currentFile: null,

    selectedFiles: [],

    openedFiles: [],

    recentCommands: [],

    lastPlan: null,

    lastAnalysis: null,

    lastScan: null,

    lastSearch: null,

    cache: {},

    flags: {

        indexed: false,
        analyzed: false,
        planning: false,
        busy: false

    }

};

function getState() {
    return state;
}

function resetState() {

    state.workspace = null;
    state.project = null;

    state.currentFeature = null;
    state.currentFile = null;

    state.selectedFiles = [];
    state.openedFiles = [];

    state.recentCommands = [];

    state.lastPlan = null;
    state.lastAnalysis = null;
    state.lastScan = null;
    state.lastSearch = null;

    state.cache = {};

    state.flags.indexed = false;
    state.flags.analyzed = false;
    state.flags.planning = false;
    state.flags.busy = false;

}

module.exports = {
    getState,
    resetState
};