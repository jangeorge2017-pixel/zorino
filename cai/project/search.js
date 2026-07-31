const fs = require("fs");
const path = require("path");

function searchFiles(workspace, keyword) {

    const indexFile = path.join(
        workspace.root,
        "cai",
        "data",
        "index.json"
    );

    if (!fs.existsSync(indexFile)) {

        console.log("");
        console.log("No index found.");
        console.log("Run 'scan' first.");
        console.log("");

        return;

    }

    const index = JSON.parse(
        fs.readFileSync(indexFile, "utf8")
    );

    const query = keyword.toLowerCase();

    const results = index.files.filter(function (file) {

        const filePath = (file.path || "").toLowerCase();
        const fileName = (file.name || "").toLowerCase();

        return (
            filePath.includes(query) ||
            fileName.includes(query)
        );

    });

    console.log("");

    if (results.length === 0) {

        console.log("No files found.");

    } else {

        console.log(results.length + " file(s) found:");
        console.log("");

        results.forEach(function (file) {
            console.log(file.path);
        });

    }

    console.log("");

}

module.exports = {
    searchFiles
};