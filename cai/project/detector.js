const fs = require("fs");
const path = require("path");

function isProjectRoot(root) {
    return ["package.json", "src", "app", "pages", ".git"].some((entry) =>
        fs.existsSync(path.join(root, entry))
    );
}

function detectProjectRoot(startDirectory) {
    let current = path.resolve(startDirectory);

    // CAI is normally installed as <project>/cai. Running `npm start` from
    // that directory must still target the enclosing project.
    if (path.basename(current).toLowerCase() === "cai" && isProjectRoot(path.dirname(current))) {
        current = path.dirname(current);
    }

    while (true) {
        if (isProjectRoot(current)) {
            return current;
        }

        const parent = path.dirname(current);
        if (parent === current) {
            return null;
        }
        current = parent;
    }
}

function detectProject(startDirectory) {
    const root = detectProjectRoot(startDirectory);
    if (!root) {
        return null;
    }

    return {
        root,
        name: path.basename(root),
        detectedAt: new Date().toISOString()
    };
}

module.exports = { detectProject, detectProjectRoot, isProjectRoot };
