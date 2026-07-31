function printRefactorReport(result) {

    console.log("");

    console.log("======== REFACTOR REPORT ========");

    console.log("");

    console.log("Status :", result.success ? "SUCCESS" : "FAILED");

    if (result.action) {
        console.log("Action :", result.action);
    }

    if (result.source) {
        console.log("Source :", result.source);
    }

    if (result.destination) {
        console.log("Target :", result.destination);
    }

    if (result.message) {
        console.log("Message:", result.message);
    }

    console.log("");

    console.log("========== END REPORT ==========");

    console.log("");

}

module.exports = {
    printRefactorReport
};