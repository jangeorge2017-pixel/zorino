function parsePatchRequest(command) {

    const result = {

        action: null,

        target: null,

        search: null,

        replace: null,

        valid: false

    };

    if (!command) {
        return result;
    }

    const parts = command.trim().split(/\s+/);

    result.action = parts.shift();

    switch (result.action) {

        case "replace":

            result.target = parts.shift();
            result.search = parts.shift();
            result.replace = parts.join(" ");

            result.valid =
                !!result.target &&
                !!result.search &&
                result.replace !== "";

            break;

        case "insert":

            result.target = parts.shift();
            result.replace = parts.join(" ");

            result.valid =
                !!result.target &&
                result.replace !== "";

            break;

        case "delete":

            result.target = parts.shift();
            result.search = parts.join(" ");

            result.valid =
                !!result.target &&
                result.search !== "";

            break;

        default:

            result.valid = false;

    }

    return result;

}

module.exports = {
    parsePatchRequest
};