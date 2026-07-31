const fs = require("fs");
const path = require("path");

function findDependencies(workspace, targetFile) {

    const result = {
        imports: [],
        importedBy: []
    };

    if (!fs.existsSync(targetFile)) {
        return result;
    }

    const source = fs.readFileSync(
        targetFile,
        "utf8"
    );

    const importRegex =
        /(?:import\s+.?\s+from\s+['"](.?)['"]|require\(['"](.*?)['"]\))/g;

    let match;

    while ((match = importRegex.exec(source)) !== null) {

        const dependency = match[1] || match[2];

        if (!dependency) {
            continue;
        }

        result.imports.push(dependency);

    }

    const indexFile = path.join(
        workspace.root,
        "cai",
        "data",
        "index.json"
    );

    if (!fs.existsSync(indexFile)) {
        return result;
    }

    const index = JSON.parse(
        fs.readFileSync(indexFile, "utf8")
    );

    for (const file of index.files) {

        if (file === targetFile) {
            continue;
        }

        try {

            const content = fs.readFileSync(
                file,
                "utf8"
            );

            const relativeName = path
                .basename(targetFile)
                .replace(path.extname(targetFile), "");

            if (
                content.includes(relativeName) ||
                content.includes(targetFile)
            ) {
                result.importedBy.push(file);
            }

        }
        catch {

        }

    }

    return result;

}

module.exports = {
    findDependencies
};