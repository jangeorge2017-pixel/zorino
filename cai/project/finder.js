const fs = require("fs");
const path = require("path");

function getIndexedMatches(workspace, keyword) {
    const indexFile = path.join(workspace.root, "cai", "data", "index.json");

    if (!fs.existsSync(indexFile)) {
        return null;
    }

    const index = JSON.parse(fs.readFileSync(indexFile, "utf8"));
    const search = String(keyword || "").toLowerCase();

    if (!search) {
        return [];
    }

    const results = [];

    for (const file of index.files || []) {
        if (
            String(file.path || "").toLowerCase().includes(search) ||
            String(file.name || "").toLowerCase().includes(search)
        ) {
            results.push(file.path);
        }
    }

    if (index.dependencies && index.dependencies[keyword]) {
        for (const file of index.dependencies[keyword]) {
            if (!results.includes(file)) {
                results.push(file);
            }
        }
    }

    return results;
}

function findFiles(workspace, keyword) {
    const results = getIndexedMatches(workspace, keyword);

    if (results === null) {
        console.log("\nProject index not found.\nRun: scan\n");
        return;
    }

    console.log("\nResults:", results.length, "");
    for (const file of results) {
        console.log(file);
    }
    console.log("");

    return results;
}

module.exports = {
    findFiles,
    getIndexedMatches
};
