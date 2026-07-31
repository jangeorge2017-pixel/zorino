const { readWorkspace } = require("../filesystem/reader");
const { buildIndex } = require("./indexer");
const { getWorkspace } = require("../workspace/memory");

function scanProject(workspace) {

    console.log("");
    console.log("Scanning project...");
    console.log("");

    let result;
    try {
        result = readWorkspace(workspace.root);
    } catch (error) {
        console.error("[Scanner] " + error.message);
        throw error;
    }

    console.log("Folders :", result.folders.length);
    console.log("Files   :", result.files.length);
    console.log("");

    console.log("Building index...");
    console.log("");

    let index;
    try {
        index = buildIndex(result, workspace);
    } catch (error) {
        console.error("[Scanner] Failed to build index: " + error.message);
        throw error;
    }

    console.log("[Scanner] Index metrics:", JSON.stringify(index.metrics));

    const session = getWorkspace();

    session.setProject({
        root: workspace.root,
        name: workspace.name
    });

    session.setIndex(index);

    console.log("Scanner project =", session.getProject());

    console.log("Project loaded into workspace.");
    console.log("");

    console.log("Scan complete.");
    console.log("");

    return index;

}

module.exports = {
    scanProject
};
