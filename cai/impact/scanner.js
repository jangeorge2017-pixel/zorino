const fs = require("fs");

function scanImpact(files) {

    const result = [];

    if (!Array.isArray(files)) {
        return result;
    }

    for (const file of files) {

        try {

            const stats = fs.statSync(file);

            result.push({

                file,

                size: stats.size,

                modified: stats.mtime,

                exists: true

            });

        }
        catch {

            result.push({

                file,

                size: 0,

                modified: null,

                exists: false

            });

        }

    }

    return result;

}

module.exports = {
    scanImpact
};