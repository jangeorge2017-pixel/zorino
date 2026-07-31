const { parseRefactor } = require("./parser");
const { validateRefactor } = require("./validator");
const { renameTarget } = require("./renamer");
const { moveTarget } = require("./mover");
const { extractToFile } = require("./extractor");
const { printRefactorReport } = require("./report");

function executeRefactor(command) {

    const request = parseRefactor(command);

    const validation = validateRefactor(request);

    if (!validation.valid) {

        printRefactorReport({

            success: false,
            action: request.action,
            source: request.target,
            destination: request.destination,
            message: validation.message

        });

        return false;

    }

    let result = null;

    switch (request.action) {

        case "rename":

            result = renameTarget(
                request.target,
                request.name
            );

            break;

        case "move":

            result = moveTarget(
                request.target,
                request.destination
            );

            break;

        case "extract":

            result = extractToFile(
                request.target,
                request.destination,
                ""
            );

            break;

        default:

            result = false;

    }

    printRefactorReport({

        success: !!result,
        action: request.action,
        source: request.target,
        destination: result,
        message: result
            ? "Refactor completed successfully."
            : "Refactor failed."

    });

    return !!result;

}

module.exports = {
    executeRefactor
};