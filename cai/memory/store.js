const memory = {

    workspace: null,

    project: null,

    currentFeature: null,

    currentTask: null,

    currentFile: null,

    lastPlan: null,

    lastAnalysis: null,

    lastSearch: null,

    lastOpen: null,

    bookmarks: [],

    todos: [],

    notes: [],

    decisions: [],

    history: []

};

function getMemory() {

    return memory;

}

function resetMemory() {

    memory.workspace = null;
    memory.project = null;

    memory.currentFeature = null;
    memory.currentTask = null;
    memory.currentFile = null;

    memory.lastPlan = null;
    memory.lastAnalysis = null;
    memory.lastSearch = null;
    memory.lastOpen = null;

    memory.bookmarks = [];
    memory.todos = [];
    memory.notes = [];
    memory.decisions = [];
    memory.history = [];

}

module.exports = {
    getMemory,
    resetMemory
};