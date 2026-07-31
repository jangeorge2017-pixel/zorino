function printExecutionReport(result) {

    console.log("");
    console.log("Execution Report");
    console.log("----------------");

    console.log("Success :", result.success);
    console.log("Steps   :", result.completedSteps.length);

    if (result.errors.length) {

        console.log("");
        console.log("Errors:");

        for (const error of result.errors) {
            console.log("-", error);
        }

    }

    console.log("");

}

module.exports = {
    printExecutionReport
};