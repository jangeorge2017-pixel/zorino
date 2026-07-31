const fs = require("fs");

function validatePatch(request) {

    const result = {

        valid: false,

        message: ""

    };

    if (!request) {

        result.message = "Invalid patch request.";
        return result;

    }

    if (!request.valid) {

        result.message = "Patch request is incomplete.";
        return result;

    }

    if (!request.target) {

        result.message = "Target file is missing.";
        return result;

    }

    if (!fs.existsSync(request.target)) {

        result.message = "Target file not found.";
        return result;

    }

    result.valid = true;
    result.message = "OK";

    return result;

}

module.exports = {
    validatePatch
};