const Workspace = require("./workspace");

let workspace = new Workspace();

function getWorkspace() {
    return workspace;
}

function setWorkspace(instance) {
    workspace = instance;
    return workspace;
}

function resetWorkspace(root) {
    workspace.reset(root);
    return workspace;
}

module.exports = {
    getWorkspace,
    setWorkspace,
    resetWorkspace
};