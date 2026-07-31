function printPatchReport(result) {

    console.log("");

    console.log("========== PATCH REPORT ==========");

    console.log("");

    console.log("Status :", result.success ? "SUCCESS" : "FAILED");

    if (result.file) {
        console.log("File   :", result.file);
    }

    if (result.action) {
        console.log("Action :", result.action);
    }

    if (result.message) {
        console.log("Message:", result.message);
    }

    console.log("");

    console.log("=========== END REPORT ===========");

    console.log("");

}

module.exports = {
    printPatchReport
};