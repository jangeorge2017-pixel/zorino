const fs = require("fs");
const path = require("path");

function analyzeProject(workspace) {
    const startedAt = performance.now();
    const indexFile = path.join(workspace.root, "cai", "data", "index.json");
    if (!fs.existsSync(indexFile)) {
        console.error("[Analyzer] Project index not found. Run: scan");
        return;
    }

    let index;
    let indexReadMs;
    let indexParseMs;
    try {
        const readStartedAt = performance.now();
        const content = fs.readFileSync(indexFile, "utf8");
        indexReadMs = performance.now() - readStartedAt;
        const parseStartedAt = performance.now();
        index = JSON.parse(content);
        indexParseMs = performance.now() - parseStartedAt;
    } catch (error) {
        console.error("[Analyzer] Could not read project index: " + error.message);
        return;
    }

    const files = Array.isArray(index.files) ? index.files : [];
    const report = {
        project: index.project, root: index.root, framework: "Unknown", totalFiles: files.length,
        javascript: 0, typescript: 0, react: 0, css: 0, json: 0, images: 0, markdown: 0,
        pages: 0, layouts: 0, components: 0, apiRoutes: 0, hooks: 0, services: 0,
        nextjs: false, tailwind: false
    };

    for (const file of files) {
        const rawPath = typeof file === "string" ? file : file && (file.path || file.file || file.relativePath || "");
        if (!rawPath) continue;
        const normalized = "/" + String(rawPath).replace(/[\\/]+/g, "/").replace(/^\/+/, "").toLowerCase();
        const ext = path.extname(normalized);
        const isAppFile = normalized.includes("/app/");
        if (["/next.config.js", "/next.config.mjs", "/next.config.ts"].includes(normalized) || isAppFile) report.nextjs = true;
        if (normalized.includes("tailwind")) report.tailwind = true;
        if (isAppFile && /\/page\.(?:js|jsx|ts|tsx)$/.test(normalized)) report.pages++;
        if (isAppFile && /\/layout\.(?:js|jsx|ts|tsx)$/.test(normalized)) report.layouts++;
        if (normalized.includes("/components/")) report.components++;
        if ((isAppFile && /\/route\.(?:js|ts)$/.test(normalized)) || normalized.includes("/pages/api/")) report.apiRoutes++;
        if (normalized.includes("/hooks/")) report.hooks++;
        if (normalized.includes("/services/")) report.services++;
        switch (ext) {
            case ".js": report.javascript++; break;
            case ".jsx": report.javascript++; report.react++; break;
            case ".ts": report.typescript++; break;
            case ".tsx": report.typescript++; report.react++; break;
            case ".css": report.css++; break;
            case ".json": report.json++; break;
            case ".png": case ".jpg": case ".jpeg": case ".svg": case ".webp": case ".gif": report.images++; break;
            case ".md": report.markdown++; break;
        }
    }

    report.framework = report.nextjs ? "Next.js" : "Unknown";
    report.metrics = {
        scanMs: 0,
        indexSource: "disk-cache",
        indexReadMs: Number(indexReadMs.toFixed(2)),
        indexParseMs: Number(indexParseMs.toFixed(2)),
        analyzeMs: Number((performance.now() - startedAt).toFixed(2))
    };
    console.log("[Analyzer] Metrics:", JSON.stringify(report.metrics));
    return report;
}

module.exports = { analyzeProject };
