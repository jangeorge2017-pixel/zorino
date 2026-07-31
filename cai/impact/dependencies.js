const fs = require("fs");

function analyzeDependencies(files) {

    const result = [];

    if (!Array.isArray(files)) {
        return result;
    }

    const importRegex =
        /(?:import\s+.?\s+from\s+['"](.?)['"]|require\(['"](.*?)['"]\))/g;

    for (const file of files) {

        try {

            const source = fs.readFileSync(
                file,
                "utf8"
            );

            const imports = [];

            let match;

            while ((match = importRegex.exec(source)) !== null) {

                const dependency = match[1] || match[2];

                if (dependency) {
                    imports.push(dependency);
                }

            }

            result.push({

                file,
                imports

            });

        }
        catch {

            result.push({

                file,
                imports: []

            });

        }

    }

    return result;

}

module.exports = {
    analyzeDependencies
};