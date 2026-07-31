function createSummary(feature, files, dependencies, entryPoints) {

    return {

        feature,

        totalFiles: files.length,

        totalDependencies: dependencies.reduce(
            (count, item) => count + item.imports.length,
            0
        ),

        totalEntryPoints: entryPoints.length,

        generatedAt: new Date().toISOString(),

        files,

        dependencies,

        entryPoints

    };

}

module.exports = {
    createSummary
};