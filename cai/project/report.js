function printReport(summary) {

    console.log("");
    console.log("========== PLAN REPORT ==========");
    console.log("");

    console.log("Feature           :", summary.feature);
    console.log("Files             :", summary.totalFiles);
    console.log("Dependencies      :", summary.totalDependencies);
    console.log("Entry Points      :", summary.totalEntryPoints);
    console.log("Generated At      :", summary.generatedAt);

    console.log("");

    if (summary.files.length > 0) {

        console.log("Files");
        console.log("-----");

        summary.files.forEach((file, index) => {
            console.log((index + 1) + ". " + file);
        });

        console.log("");

    }

    if (summary.entryPoints.length > 0) {

        console.log("Entry Points");
        console.log("------------");

        summary.entryPoints.forEach((entry, index) => {
            console.log((index + 1) + ". " + entry.file);
            console.log("   " + entry.reason);
        });

        console.log("");

    }

    console.log("========== END ==========");
    console.log("");

}

module.exports = {
    printReport
};