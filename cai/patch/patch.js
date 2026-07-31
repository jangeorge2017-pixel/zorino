const { parsePatchRequest } = require("./parser");
const { validatePatch } = require("./validator");
const { createBackup } = require("./backup");
const { applyPatch } = require("./editor");
const { printPatchReport } = require("./report");

function executePatch(command) {

    const request = parsePatchRequest(command);

    const validation = validatePatch(request);

    if (!validation.valid) {

        printPatchReport({

            success: false,
            action: request.action,
            file: request.target,
            message: validation.message

        });

        return false;

    }

    createBackup(request.target);

    const success = applyPatch(request);

    printPatchReport({

        success,
        action: request.action,
        file: request.target,
        message: success
            ? "Patch applied successfully."
            : "Patch failed."

    });

    return success;

}

module.exports = {
    executePatch
};