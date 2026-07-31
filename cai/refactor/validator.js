const fs = require("fs");

function validateRefactor(request) {

    const result = {

        valid: false,

        message: ""

    };

    if (!request) {

        result.message = "Invalid refactor request.";
        return result;

    }

    if (!request.action) {

        result.message = "Missing action.";
        return result;

    }

    if (!request.target) {

        result.message = "Missing target.";
        return result;

    }

    if (!fs.existsSync(request.target)) {

        result.message = "Target not found.";
        return result;

    }

    result.valid = true;
    result.message = "OK";

    return result;

}

module.exports = {
    validateRefactor
};