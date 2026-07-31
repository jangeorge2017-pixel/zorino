const fs = require("fs");
const path = require("path");

const IGNORE = new Set([
    "node_modules",
    ".git",
    ".next",
    ".next-local",
    ".cai",
    "dist",
    "build",
    ".turbo"
]);

function readWorkspace(root) {

    const files = [];
    const folders = [];

    walk(root);

    return {
        files,
        folders
    };

    function walk(dir) {

        folders.push(dir);

        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch (error) {
            throw new Error("Cannot read directory " + dir + ": " + error.message);
        }

        for (const entry of entries) {

            if (IGNORE.has(entry.name)) {
                continue;
            }

            const fullPath = path.join(dir, entry.name);

            // CAI's own generated index changes on every scan. Excluding its
            // internal cache prevents a perpetual self-invalidating index.
            if (path.resolve(fullPath) === path.resolve(root, "cai", "data")) {
                continue;
            }

            if (entry.isDirectory()) {

                walk(fullPath);

            } else {

                files.push(fullPath);

            }

        }

    }

}

module.exports = {
    readWorkspace
};
