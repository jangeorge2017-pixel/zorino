function printImpactReport(results) {

    console.log("");

    console.log("========= IMPACT REPORT =========");

    console.log("");

    if (!results || results.length === 0) {

        console.log("No impacted files found.");

    } else {

        for (const item of results) {

            console.log(item.file);

            if (item.matches) {

                for (const match of item.matches) {

                    console.log(
                        "  Line",
                        match.line + ":",
                        match.text
                    );

                }

            }

            console.log("");

        }

    }

    console.log("======= END OF REPORT =======");

    console.log("");

}

module.exports = {
    printImpactReport
};