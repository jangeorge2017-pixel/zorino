const path = require("path");
const { getWorkspace } = require("./memory");
const { detectProject } = require("../project/detector");

function getCurrentWorkspace() {
    const workspace = getWorkspace();

    if (!workspace.root) {
        workspace.reset(process.cwd());
    }

    const project = detectProject(workspace.root);
    if (project) {
        workspace.root = project.root;
        workspace.name = project.name;
        workspace.setProject(project);
    } else {
        workspace.root = path.resolve(workspace.root);
        workspace.name = path.basename(workspace.root);
        workspace.setProject(null);
    }

    return workspace;
}

module.exports = {
    getCurrentWorkspace
};
