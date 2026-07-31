const fs = require("fs");
const path = require("path");

function getFileType(extension) {

    switch (extension.toLowerCase()) {

        case ".js":
        case ".jsx":
            return "javascript";

        case ".ts":
        case ".tsx":
            return "typescript";

        case ".json":
            return "json";

        case ".css":
        case ".scss":
        case ".sass":
            return "style";

        case ".html":
            return "html";

        case ".md":
            return "markdown";

        case ".png":
        case ".jpg":
        case ".jpeg":
        case ".gif":
        case ".svg":
        case ".webp":
        case ".ico":
            return "image";

        default:
            return "file";

    }

}

function extractImports(content) {

    const imports = [];

    const regex =
        /import[\s\S]*?from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/g;

    let match;

    while ((match = regex.exec(content)) !== null) {

        imports.push(match[1] || match[2]);

    }

    return [...new Set(imports)];

}

function extractExports(content) {

    const exports = [];

    const regexes = [

        /export\s+default/g,

        /export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/g,

        /export\s+class\s+([A-Za-z0-9_$]+)/g,

        /export\s+(?:const|let|var)\s+([A-Za-z0-9_$]+)/g,

        /export\s+interface\s+([A-Za-z0-9_$]+)/g,

        /export\s+type\s+([A-Za-z0-9_$]+)/g,

        /export\s*\{\s*([^}]+)\s*\}/g

    ];

    for (const regex of regexes) {

        let match;

        while ((match = regex.exec(content)) !== null) {

            if (regex.source.startsWith("export\\s*\\{")) {

                match[1]
                    .split(",")
                    .map(item => item.trim())
                    .filter(Boolean)
                    .forEach(item => exports.push(item));

            } else if (match[1]) {

                exports.push(match[1]);

            } else {

                exports.push("default");

            }

        }

    }

    return [...new Set(exports)];

}

function analyseFile(file) {

    const extension = path.extname(file).toLowerCase();

    if (![".js", ".jsx", ".ts", ".tsx"].includes(extension)) {

        return {

            imports: [],

            exports: []

        };

    }

    try {

        const content = fs.readFileSync(file, "utf8");

        return {

            imports: extractImports(content),

            exports: extractExports(content)

        };

    } catch {

        return {

            imports: [],

            exports: []

        };

    }

}
function buildDependencies(files) {

    const dependencies = {};

    for (const file of files) {

        if (!Array.isArray(file.imports)) {
            continue;
        }

        for (const imported of file.imports) {

            if (!dependencies[imported]) {
                dependencies[imported] = [];
            }

            dependencies[imported].push(file.path);

        }

    }

    for (const key of Object.keys(dependencies)) {

        dependencies[key] = [...new Set(dependencies[key])];

    }

    return dependencies;

}

function loadPreviousIndex(indexFile) {
    try {
        return JSON.parse(fs.readFileSync(indexFile, "utf8"));
    } catch {
        return null;
    }
}

function buildIndex(scanResult, workspace) {
    const startedAt = performance.now();
    const dataDir = path.join(workspace.root, "cai", "data");
    const indexFile = path.join(dataDir, "index.json");
    const previous = loadPreviousIndex(indexFile);
    const previousFiles = new Map((previous?.files || []).map((file) => [file.path, file]));
    let reusedFiles = 0;
    let analyzedFiles = 0;

    const files = scanResult.files.map(file => {

        let size = 0;

        let modifiedAt = null;
        try {
            const stats = fs.statSync(file);
            size = stats.size;
            modifiedAt = stats.mtimeMs;
        } catch {}

        const extension = path.extname(file);
        const relativePath = path.relative(workspace.root, file);
        const previousFile = previousFiles.get(relativePath);
        const unchanged = previousFile && previousFile.size === size && previousFile.modifiedAt === modifiedAt;
        const analysis = unchanged
            ? { imports: previousFile.imports || [], exports: previousFile.exports || [] }
            : analyseFile(file);
        if (unchanged) reusedFiles++;
        else analyzedFiles++;

        return {

            path: relativePath,

            name: path.basename(file),

            extension,

            type: getFileType(extension),

            size,

            modifiedAt,

            imports: analysis.imports,

            exports: analysis.exports

        };

    });

    const index = {

        project: workspace.name || path.basename(workspace.root),

        root: workspace.root,

        createdAt: new Date().toISOString(),

        folders: scanResult.folders.map(folder =>
            path.relative(workspace.root, folder)
        ),

        files,

        dependencies: buildDependencies(files)

    };
    index.intelligence = {
        framework: files.some((file) => /^next\.config\./i.test(file.path)) || files.some((file) => /(^|[\\/])app([\\/])/.test(file.path)) ? "Next.js" : "Unknown",
        packageManager: fs.existsSync(path.join(workspace.root, "pnpm-lock.yaml")) ? "pnpm" : fs.existsSync(path.join(workspace.root, "yarn.lock")) ? "yarn" : fs.existsSync(path.join(workspace.root, "package-lock.json")) ? "npm" : null,
        pages: files.filter((file) => /(^|[\\/])app[\\/].*page\.(js|jsx|ts|tsx)$/i.test(file.path)).map((file) => file.path),
        layouts: files.filter((file) => /(^|[\\/])app[\\/].*layout\.(js|jsx|ts|tsx)$/i.test(file.path)).map((file) => file.path),
        routes: files.filter((file) => /(^|[\\/])app[\\/].*route\.(js|ts)$/i.test(file.path)).map((file) => file.path),
        components: files.filter((file) => /(^|[\\/])components[\\/]/i.test(file.path)).map((file) => file.path)
    };
    index.metrics = {
        reusedFiles,
        analyzedFiles,
        indexingMs: Number((performance.now() - startedAt).toFixed(2))
    };

    if (!fs.existsSync(dataDir)) {

        fs.mkdirSync(dataDir, {
            recursive: true
        });

    }
    fs.writeFileSync(

        indexFile,

        JSON.stringify(index, null, 4),

        "utf8"

    );

    return index;

}

module.exports = {

    buildIndex

};
