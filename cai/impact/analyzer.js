const fs = require("fs");

function analyzeImpact(files, keyword) {

    const result = [];

    if (!Array.isArray(files)) {
        return result;
    }

    const search = keyword.toLowerCase();

    for (const file of files) {

        try {

            const content = fs.readFileSync(
                file,
                "utf8"
            );

            const lines = content.split(/\r?\n/);

            const matches = [];

            for (let i = 0; i < lines.length; i++) {

                if (
                    lines[i]
                        .toLowerCase()
                        .includes(search)
                ) {

                    matches.push({

                        line: i + 1,
                        text: lines[i].trim()

                    });

                }

            }

            if (matches.length > 0) {

                result.push({

                    file,
                    matches

                });

            }

        }
        catch {

        }

    }

    return result;

}

module.exports = {
    analyzeImpact
};