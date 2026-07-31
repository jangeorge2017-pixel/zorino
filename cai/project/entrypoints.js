const fs = require("fs");
const path = require("path");

function findEntryPoints(workspace, files) {

    const result = [];

    if (!Array.isArray(files)) {
        return result;
    }

    const entryNames = [

        "index",
        "main",
        "app",
        "layout",
        "page",
        "route",
        "server",
        "client"

    ];

    for (const file of files) {

        const name = path
            .basename(file)
            .toLowerCase()
            .replace(path.extname(file), "");

        if (entryNames.includes(name)) {

            result.push({
                file,
                reason: "Entry filename"
            });

            continue;

        }

        try {

            const source = fs.readFileSync(
                file,
                "utf8"
            );

            if (
                source.includes("export default") ||
                source.includes("createRoot(") ||
                source.includes("ReactDOM") ||
                source.includes("NextResponse") ||
                source.includes("NextRequest")
            ) {

                result.push({
                    file,
                    reason: "Application entry"
                });

            }

        }
        catch {

        }

    }

    return result;

}

module.exports = {
    findEntryPoints
};